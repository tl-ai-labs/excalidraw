import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
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
  pagesIv?: Bytes;
  pagesCiphertext?: Bytes;
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

const encryptPages = async (
  key: string,
  pages: AppState["pages"],
): Promise<{ pagesCiphertext: ArrayBuffer; pagesIv: Uint8Array }> => {
  const json = JSON.stringify(pages);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { pagesCiphertext: encryptedBuffer, pagesIv: iv };
};

const decryptPages = async (
  pagesIv: Bytes,
  pagesCiphertext: Bytes,
  roomKey: string,
): Promise<AppState["pages"] | undefined> => {
  try {
    const ciphertext =
      pagesCiphertext.toUint8Array() as Uint8Array<ArrayBuffer>;
    const iv = pagesIv.toUint8Array() as Uint8Array<ArrayBuffer>;

    const decrypted = await decryptData(iv, ciphertext, roomKey);
    const decodedData = new TextDecoder("utf-8").decode(
      new Uint8Array(decrypted),
    );
    return JSON.parse(decodedData);
  } catch (error) {
    console.error("Failed to decrypt pages from Firebase", error);
    return undefined;
  }
};

const getPagesSignature = (pages: AppState["pages"] | undefined): string => {
  if (!pages) {
    return "";
  }
  return JSON.stringify(pages.map((p) => ({ id: p.id, name: p.name })));
};

class FirebaseSceneVersionCache {
  private static cache = new WeakMap<
    Socket,
    { sceneVersion: number; pagesSignature: string }
  >();
  static get = (socket: Socket) => {
    return FirebaseSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
    pages?: AppState["pages"],
  ) => {
    FirebaseSceneVersionCache.cache.set(socket, {
      sceneVersion: getSceneVersion(elements),
      pagesSignature: getPagesSignature(pages),
    });
  };
}

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
  appState?: Pick<AppState, "pages">,
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);
    const pagesSignature = getPagesSignature(appState?.pages);

    const cached = FirebaseSceneVersionCache.get(portal.socket);
    return (
      cached?.sceneVersion === sceneVersion &&
      cached?.pagesSignature === pagesSignature
    );
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
  pages?: AppState["pages"],
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  const { Bytes } = await _loadFirestore();
  const doc: FirebaseStoredScene = {
    sceneVersion,
    ciphertext: Bytes.fromUint8Array(new Uint8Array(ciphertext)),
    iv: Bytes.fromUint8Array(iv),
  };

  if (pages && pages.length > 0) {
    const { pagesCiphertext, pagesIv } = await encryptPages(roomKey, pages);
    doc.pagesCiphertext = Bytes.fromUint8Array(new Uint8Array(pagesCiphertext));
    doc.pagesIv = Bytes.fromUint8Array(pagesIv);
  }

  return doc;
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
    isSavedToFirebase(portal, elements, appState)
  ) {
    return null;
  }

  const { firestore, doc, runTransaction } = await _loadFirestore();
  const docRef = doc(firestore, "scenes", roomId);

  let storedPages: AppState["pages"] | undefined = appState.pages;

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

    if (prevStoredScene.pagesIv && prevStoredScene.pagesCiphertext) {
      const prevStoredPages = await decryptPages(
        prevStoredScene.pagesIv,
        prevStoredScene.pagesCiphertext,
        roomKey,
      );
      if (prevStoredPages && prevStoredPages.length > 0) {
        // reconcile or use current appState.pages if updated
        storedPages = appState.pages;
      }
    }

    const storedScene = await createFirebaseSceneDocument(
      reconciledElements,
      roomKey,
      storedPages,
    );

    transaction.update(docRef, storedScene);

    // Return the stored elements as the in memory `reconciledElements` could have mutated in the meantime
    return storedScene;
  });

  const storedElements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null),
  );

  if (storedPages) {
    (storedElements as any).pages = storedPages;
  }

  FirebaseSceneVersionCache.set(socket, storedElements, storedPages);

  return toBrandedType<RemoteExcalidrawElement[]>(storedElements);
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
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

  let pages: AppState["pages"] | undefined;
  if (storedScene.pagesIv && storedScene.pagesCiphertext) {
    pages = await decryptPages(
      storedScene.pagesIv,
      storedScene.pagesCiphertext,
      roomKey,
    );
    if (pages) {
      (elements as any).pages = pages;
    }
  }

  if (socket) {
    FirebaseSceneVersionCache.set(socket, elements, pages);
  }

  return elements;
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
