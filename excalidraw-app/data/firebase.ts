import { reconcileElements, reconcilePages } from "@excalidraw/excalidraw";
import {
  DEFAULT_PAGE_ID,
  DEFAULT_PAGE_NAME,
  MIME_TYPES,
  toBrandedType,
} from "@excalidraw/common";
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
  ExcalidrawPage,
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
};

const FIREBASE_PAGES_SENTINEL_ID = "__excalidraw_pages__";

const getPagesKey = (pages: readonly ExcalidrawPage[] | undefined) =>
  pages ? JSON.stringify(pages.map((p) => [p.id, p.name])) : undefined;

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
  pages?: readonly ExcalidrawPage[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const isDefaultSinglePage =
    !pages ||
    (pages.length === 1 &&
      pages[0].id === DEFAULT_PAGE_ID &&
      pages[0].name === DEFAULT_PAGE_NAME);
  const payload = isDefaultSinglePage
    ? elements
    : [
        ...elements,
        { id: FIREBASE_PAGES_SENTINEL_ID, type: "selection", pages },
      ];
  const json = JSON.stringify(payload);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: FirebaseStoredScene,
  roomKey: string,
): Promise<{
  elements: readonly ExcalidrawElement[];
  pages?: readonly ExcalidrawPage[];
}> => {
  const ciphertext = data.ciphertext.toUint8Array() as Uint8Array<ArrayBuffer>;
  const iv = data.iv.toUint8Array() as Uint8Array<ArrayBuffer>;

  const decrypted = await decryptData(iv, ciphertext, roomKey);
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  const parsed = JSON.parse(decodedData);
  if (!Array.isArray(parsed)) {
    return {
      elements: Array.isArray(parsed?.elements) ? parsed.elements : [],
      pages: Array.isArray(parsed?.pages) ? parsed.pages : undefined,
    };
  }
  let pages: readonly ExcalidrawPage[] | undefined;
  const elements: ExcalidrawElement[] = [];
  for (const item of parsed) {
    if (item && item.id === FIREBASE_PAGES_SENTINEL_ID) {
      if (Array.isArray(item.pages)) {
        pages = item.pages;
      }
    } else {
      elements.push(item);
    }
  }
  return { elements, pages };
};

class FirebaseSceneVersionCache {
  private static cache = new WeakMap<
    Socket,
    { sceneVersion: number; pagesKey?: string }
  >();
  static get = (socket: Socket) => {
    return FirebaseSceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
    pages?: readonly ExcalidrawPage[],
  ) => {
    FirebaseSceneVersionCache.cache.set(socket, {
      sceneVersion: getSceneVersion(elements),
      pagesKey: getPagesKey(pages),
    });
  };
}

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
  appState?: AppState,
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);
    const cached = FirebaseSceneVersionCache.get(portal.socket);
    if (!cached || cached.sceneVersion !== sceneVersion) {
      return false;
    }
    if (appState?.pages && cached.pagesKey !== undefined) {
      return cached.pagesKey === getPagesKey(appState.pages);
    }
    return true;
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
  pages?: readonly ExcalidrawPage[],
) => {
  const sceneVersion = getSceneVersion(elements);
  const { ciphertext, iv } = await encryptElements(roomKey, elements, pages);
  const { Bytes } = await _loadFirestore();
  return {
    sceneVersion,
    ciphertext: Bytes.fromUint8Array(new Uint8Array(ciphertext)),
    iv: Bytes.fromUint8Array(iv),
  } as FirebaseStoredScene;
};

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
): Promise<{
  elements: RemoteExcalidrawElement[];
  pages?: readonly ExcalidrawPage[];
} | null> => {
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
    const prevDecrypted = await decryptElements(prevStoredScene, roomKey);
    const prevStoredElements = getSyncableElements(
      restoreElements(prevDecrypted.elements, null),
    );
    const reconciledElements = getSyncableElements(
      reconcileElements(
        elements,
        prevStoredElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
        appState,
      ),
    );
    const reconciledPages = reconcilePages(
      appState.pages,
      prevDecrypted.pages,
      reconciledElements,
    );

    const storedScene = await createFirebaseSceneDocument(
      reconciledElements,
      roomKey,
      reconciledPages,
    );

    transaction.update(docRef, storedScene);

    // Return the stored elements as the in memory `reconciledElements` could have mutated in the meantime
    return storedScene;
  });

  const decryptedStored = await decryptElements(storedScene, roomKey);
  const storedElements = getSyncableElements(
    restoreElements(decryptedStored.elements, null),
  );

  FirebaseSceneVersionCache.set(
    socket,
    storedElements,
    decryptedStored.pages ?? appState.pages,
  );

  return {
    elements: toBrandedType<RemoteExcalidrawElement[]>(storedElements),
    pages: decryptedStored.pages,
  };
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<{
  elements: readonly SyncableExcalidrawElement[];
  pages?: readonly ExcalidrawPage[];
} | null> => {
  const { firestore, doc, getDoc } = await _loadFirestore();
  const docRef = doc(firestore, "scenes", roomId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    return null;
  }
  const storedScene = docSnap.data() as FirebaseStoredScene;
  const { elements: rawElements, pages } = await decryptElements(
    storedScene,
    roomKey,
  );
  const elements = getSyncableElements(
    restoreElements(rawElements, null, {
      deleteInvisibleElements: true,
    }),
  );

  if (socket) {
    FirebaseSceneVersionCache.set(socket, elements, pages);
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
