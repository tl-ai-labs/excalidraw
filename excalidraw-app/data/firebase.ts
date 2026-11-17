import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import {
  getPagesVersion,
  getSceneVersion,
  reconcilePages,
  restorePages,
} from "@excalidraw/element";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
  Page,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";
import type { Bytes } from "firebase/firestore";
import type { UploadMetadata } from "firebase/storage";

// private
// -----------------------------------------------------------------------------

let FIREBASE_CONFIG: Record<string, any>;
try {
  FIREBASE_CONFIG = JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG);
} catch (error: any) {
  console.warn(
    `Error JSON parsing firebase config. Supplied value: ${
      import.meta.env.VITE_APP_FIREBASE_CONFIG
    }`,
  );
  FIREBASE_CONFIG = {};
}

const lazy = <T>(load: () => Promise<T>) => {
  let promise: Promise<T> | null = null;
  return () =>
    (promise ??= load().catch((error) => {
      promise = null;
      throw error;
    }));
};

const _initializeFirebase = lazy(async () => {
  const sdk = await import("./firebaseSDK");
  return { sdk, app: sdk.initializeApp(FIREBASE_CONFIG) };
});

const _loadFirestore = lazy(async () => {
  const { sdk, app } = await _initializeFirebase();
  const { getFirestore, doc, getDoc, runTransaction, Bytes } = sdk;
  return { firestore: getFirestore(app), doc, getDoc, runTransaction, Bytes };
});

const _loadStorage = lazy(async () => {
  const { sdk, app } = await _initializeFirebase();
  const { getStorage, ref, uploadBytes } = sdk;
  return { storage: getStorage(app), ref, uploadBytes };
});

// -----------------------------------------------------------------------------

export const uploadBytesToFirebase = async (
  path: string,
  data: Blob | Uint8Array,
  metadata?: UploadMetadata,
) => {
  const { storage, ref, uploadBytes } = await _loadStorage();
  return uploadBytes(ref(storage, path), data, metadata);
};

type FirebaseStoredScene = {
  sceneVersion: number;
  iv: Bytes;
  ciphertext: Bytes;
  /**
   * Pages are stored in separate (optional) fields, so that clients which
   * don't know about pages keep reading/writing `ciphertext` as before.
   */
  pagesIv?: Bytes;
  pagesCiphertext?: Bytes;
};

const encryptPages = async (key: string, pages: readonly Page[]) => {
  const encoded = new TextEncoder().encode(JSON.stringify(pages));
  const { encryptedBuffer, iv } = await encryptData(key, encoded);
  return { ciphertext: encryptedBuffer, iv };
};

const decryptPages = async (
  data: FirebaseStoredScene,
  roomKey: string,
): Promise<Page[] | null> => {
  if (!data.pagesCiphertext || !data.pagesIv) {
    return null;
  }
  const decrypted = await decryptData(
    data.pagesIv.toUint8Array() as Uint8Array<ArrayBuffer>,
    data.pagesCiphertext.toUint8Array() as Uint8Array<ArrayBuffer>,
    roomKey,
  );
  const parsed = JSON.parse(
    new TextDecoder("utf-8").decode(new Uint8Array(decrypted)),
  );
  return Array.isArray(parsed) ? restorePages(parsed) : null;
};

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: FirebaseStoredScene,
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const ciphertext = data.ciphertext.toUint8Array() as Uint8Array<ArrayBuffer>;
  const iv = data.iv.toUint8Array() as Uint8Array<ArrayBuffer>;

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

class FirebaseSceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return FirebaseSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
    pages?: readonly Page[],
  ) => {
    FirebaseSceneVersionCache.cache.set(
      socket,
      getSceneVersion(elements) + getPagesVersion(pages),
    );
  };
}

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
  pages?: readonly Page[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements) + getPagesVersion(pages);

    return FirebaseSceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveFilesToFirebase = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  // failing to load the SDK must fail the whole save rather than be reported
  // per file as `erroredFiles` (which share links ignore, and collab never
  // retries)
  const { storage, ref, uploadBytes } = await _loadStorage();

  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const storageRef = ref(storage, `${prefix}/${id}`);
        await uploadBytes(storageRef, buffer, {
          cacheControl: `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
        });
        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

const createFirebaseSceneDocument = async (
  elements: readonly SyncableExcalidrawElement[],
  roomKey: string,
  pages?: readonly Page[],
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  const { Bytes } = await _loadFirestore();
  const doc: FirebaseStoredScene = {
    sceneVersion,
    ciphertext: Bytes.fromUint8Array(new Uint8Array(ciphertext)),
    iv: Bytes.fromUint8Array(iv),
  };
  if (pages) {
    const encryptedPages = await encryptPages(roomKey, pages);
    doc.pagesCiphertext = Bytes.fromUint8Array(
      new Uint8Array(encryptedPages.ciphertext),
    );
    doc.pagesIv = Bytes.fromUint8Array(encryptedPages.iv);
  }
  return doc;
};

export type FirebaseSceneData = {
  elements: readonly SyncableExcalidrawElement[];
  /** `null` if stored by a client which doesn't know about pages */
  pages: Page[] | null;
};

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // bail if no room exists as there's nothing we can do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToFirebase(portal, elements, appState.pages)
  ) {
    return null;
  }

  const { firestore, doc, runTransaction } = await _loadFirestore();
  const docRef = doc(firestore, "scenes", roomId);

  const storedScene = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(docRef);

    if (!snapshot.exists()) {
      const storedScene = await createFirebaseSceneDocument(
        elements,
        roomKey,
        appState.pages,
      );

      transaction.set(docRef, storedScene);

      return storedScene;
    }

    const prevStoredScene = snapshot.data() as FirebaseStoredScene;
    const prevStoredElements = getSyncableElements(
      restoreElements(await decryptElements(prevStoredScene, roomKey), null),
    );
    const reconciledElements = getSyncableElements(
      reconcileElements(
        elements,
        prevStoredElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
        appState,
      ),
    );

    const prevStoredPages = await decryptPages(prevStoredScene, roomKey);
    const reconciledPages = prevStoredPages
      ? reconcilePages(appState.pages, prevStoredPages)
      : appState.pages;

    const storedScene = await createFirebaseSceneDocument(
      reconciledElements,
      roomKey,
      reconciledPages,
    );

    transaction.update(docRef, storedScene);

    // Return the stored elements as the in memory `reconciledElements` could have mutated in the meantime
    return storedScene;
  });

  const storedElements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null),
  );

  const storedPages = await decryptPages(storedScene, roomKey);

  FirebaseSceneVersionCache.set(
    socket,
    storedElements,
    storedPages || undefined,
  );

  return {
    elements: toBrandedType<RemoteExcalidrawElement[]>(storedElements),
    pages: storedPages,
  };
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<FirebaseSceneData | null> => {
  const { firestore, doc, getDoc } = await _loadFirestore();
  const docRef = doc(firestore, "scenes", roomId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return null;
  }
  const storedScene = docSnap.data() as FirebaseStoredScene;
  const elements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null, {
      deleteInvisibleElements: true,
    }),
  );

  const pages = await decryptPages(storedScene, roomKey);

  if (socket) {
    FirebaseSceneVersionCache.set(socket, elements, pages || undefined);
  }

  return { elements, pages };
};

export const loadFilesFromFirebase = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const url = `https://firebasestorage.googleapis.com/v0/b/${
          FIREBASE_CONFIG.storageBucket
        }/o/${encodeURIComponent(prefix.replace(/^\//, ""))}%2F${id}`;
        const response = await fetch(`${url}?alt=media`);
        if (response.status < 400) {
          const arrayBuffer = await response.arrayBuffer();

          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
