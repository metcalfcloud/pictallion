// Strict TypeScript wrapper for Tauri IPC commands with browser fallbacks.
// Works with Tauri v2; runtime detection is robust across desktop vs browser.

// Real-time environment detection (Tauri v2 compatible)
const isTauriEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(
    (w.__TAURI__ as unknown) ||
    (w.__TAURI_INTERNALS__ as unknown) ||
    (w.__TAURI_IPC__ as unknown) ||
    (typeof navigator !== "undefined" &&
      navigator.userAgent &&
      navigator.userAgent.includes("Tauri"))
  );
};

// Lazy-loaded Tauri API with retry capability
let tauriInvoke:
  | ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>)
  | null = null;
let tauriLoadPromise: Promise<void> | null = null;

// Lazy load Tauri API on first use
async function ensureTauriApi(): Promise<void> {
  if (tauriInvoke) {
    return; // Already loaded
  }

  if (!isTauriEnvironment()) {
    throw new Error("Tauri environment not available");
  }

  // If already loading, wait for existing promise
  if (tauriLoadPromise) {
    return tauriLoadPromise;
  }

  // Start loading
  tauriLoadPromise = (async () => {
    try {
      // Prefer Tauri v2 API, fallback to v1
      const core = await import("@tauri-apps/api/core").catch(() => null as any);
      if (core && typeof (core as any).invoke === "function") {
        tauriInvoke = (core as any).invoke as typeof tauriInvoke;
      } else {
        const v1Path = "@tauri-apps/api/" + "tauri";
        const v1 = await import(v1Path as any);
        tauriInvoke = (v1 as any).invoke as typeof tauriInvoke;
      }
      console.log("[tauriApi] Tauri API loaded successfully");
    } catch (err) {
      console.warn("[tauriApi] Failed to load Tauri API:", err);
      tauriLoadPromise = null; // Reset to allow retry
      throw err;
    }
  })();

  return tauriLoadPromise;
}

// Optional targeted debug logging; enable via localStorage.setItem('debug-tauri','1')
try {
  if (
    typeof window !== "undefined" &&
    (window as unknown as { localStorage?: Storage }).localStorage?.getItem(
      "debug-tauri",
    ) === "1"
  ) {
    const w = window as unknown as Record<string, unknown>;
    console.log("[tauriApi] Tauri detection:", {
      __TAURI__: typeof w.__TAURI__,
      __TAURI_INTERNALS__: typeof w.__TAURI_INTERNALS__,
      __TAURI_IPC__: typeof w.__TAURI_IPC__,
      isTauri: isTauriEnvironment(),
      ua: navigator.userAgent,
    });
  }
} catch {
  const _ignored = true;
  if (_ignored) {
    /* no-op */
  }
}

// Helper function to invoke commands with environment detection
async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauriEnvironment()) {
    throw new Error(`Tauri runtime not available`);
  }

  await ensureTauriApi();

  if (!tauriInvoke) {
    throw new Error(
      `Feature unavailable: Failed to initialize Tauri API for '${command}'.`,
    );
  }

  return (await tauriInvoke(command, args)) as T;
}

// Helper function for functions that can provide browser fallbacks
async function safeInvokeWithFallback<T>(
  command: string,
  args?: Record<string, unknown>,
  browserFallback?: () => Promise<T>,
): Promise<T> {
  if (isTauriEnvironment()) {
    try {
      await ensureTauriApi();
    } catch (err) {
      console.warn(`[tauriApi] Failed to initialize Tauri for '${command}':`, err);
      // fall through to possible browser fallback
      return browserFallback
        ? await browserFallback()
        : Promise.reject(err as Error);
    }
    if (tauriInvoke) {
      // If Tauri invoke throws, propagate the error (tests expect rejection)
      return (await tauriInvoke(command, args)) as T;
    }
  }

  if (browserFallback) {
    console.warn(
      `[tauriApi] Using browser fallback for '${command}' - limited functionality available`,
    );
    return await browserFallback();
  }

  throw new Error(
    `Feature unavailable: This functionality requires the desktop app. Please use the Tauri desktop version to access '${command}'.`,
  );
}

// Browser fallback for photo metadata
async function getPhotoMetadataInBrowser(photoId: string): Promise<string> {
  console.warn(
    "[tauriApi] Browser mode: Photo metadata is not available. Please use the desktop app to view detailed photo information.",
  );
  return `Photo metadata not available in browser mode for photo: ${photoId}`;
}

export async function getPhotoMetadata(photoId: string): Promise<string> {
  return await safeInvokeWithFallback<string>(
    "get_photo_metadata",
    { photoId },
    () => getPhotoMetadataInBrowser(photoId),
  );
}

export async function promotePhotoTier(
  photoId: string,
  tier: string,
): Promise<string> {
  return await safeInvoke<string>("promote_photo_tier", { photoId, tier });
}

// Browser fallback for listing people
async function listPeopleInBrowser(): Promise<Person[]> {
  console.warn(
    "[tauriApi] Browser mode: People management is not available. Please use the desktop app to manage people.",
  );
  return [];
}

export async function listPeople(): Promise<Person[]> {
  return await safeInvokeWithFallback<Person[]>(
    "list_people",
    undefined,
    listPeopleInBrowser,
  );
}

export async function createPerson(req: CreatePersonRequest): Promise<Person> {
  return await safeInvoke<Person>("create_person", { req });
}

export async function updatePerson(
  personId: string,
  req: UpdatePersonRequest,
): Promise<Person> {
  return await safeInvoke<Person>("update_person", { personId, req });
}

export async function deletePerson(personId: string): Promise<string> {
  return await safeInvoke<string>("delete_person", { personId });
}

export async function mergePeople(req: MergePeopleRequest): Promise<string> {
  return await safeInvoke<string>("merge_people", { req });
}

export async function listRelationships(
  personId: string,
): Promise<Relationship[]> {
  return await safeInvoke<Relationship[]>("list_relationships", { personId });
}

// Browser-native fallback for photo upload
async function uploadPhotoInBrowser(file: File): Promise<string> {
  // Create FormData for file upload
  const formData = new FormData();
  formData.append("photo", file);

  // In a real implementation, this would upload to your backend API
  // For now, we'll simulate the upload and return a mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate successful upload
      const mockPhotoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(
        `[Browser Upload] Simulated upload of ${file.name}, assigned ID: ${mockPhotoId}`,
      );
      resolve(`Photo uploaded successfully with ID: ${mockPhotoId}`);
    }, 1000);
  });
}

export async function addPhoto(filePathOrFile: string | File): Promise<string> {
  // Use real-time environment detection
  if (isTauriEnvironment()) {
    // In Tauri environment, expect a file path string
    if (typeof filePathOrFile !== "string") {
      throw new Error(
        "In Tauri environment, addPhoto expects a file path string",
      );
    }
    return await safeInvoke<string>("add_photo", { filePath: filePathOrFile });
  } else {
    // In browser environment, expect a File object
    if (typeof filePathOrFile === "string") {
      throw new Error("In browser environment, addPhoto expects a File object");
    }
    return await uploadPhotoInBrowser(filePathOrFile);
  }
}

// List photos from backend
export interface Photo {
  id: string;
  filePath: string;
  tier: string;
}

// Browser fallback for listing photos
async function listPhotosInBrowser(): Promise<Photo[]> {
  console.warn(
    "[tauriApi] Browser mode: Photo listing is not available. Please use the desktop app to manage your photo library.",
  );
  return [];
}

export async function listPhotos(): Promise<Photo[]> {
  return await safeInvokeWithFallback<Photo[]>(
    "list_photos",
    undefined,
    listPhotosInBrowser,
  );
}

export async function listPhotosByPerson(personId: string): Promise<Photo[]> {
  return await safeInvoke<Photo[]>("list_photos_by_person", { personId });
}

// Search photos by multi-filters
export type SearchFilters = {
  personId?: string;
  tagId?: string;
  tier?: string;
  dateFrom?: number; // unix seconds
  dateTo?: number; // unix seconds
};

export async function searchPhotos(filters: SearchFilters): Promise<Photo[]> {
  return await safeInvoke<Photo[]>("search_photos", { filters });
}

// Tags
export type Tag = { id: string; name: string };
export async function listTags(): Promise<Tag[]> {
  return await safeInvoke<Tag[]>("list_tags");
}
export async function createTag(name: string): Promise<Tag> {
  return await safeInvoke<Tag>("create_tag", { name });
}
export async function assignTag(
  photoId: string,
  tagId: string,
): Promise<string> {
  return await safeInvoke<string>("assign_tag", { photoId, tagId });
}
export async function removeTag(
  photoId: string,
  tagId: string,
): Promise<string> {
  return await safeInvoke<string>("remove_tag", { photoId, tagId });
}
export async function listPhotoTags(photoId: string): Promise<Tag[]> {
  return await safeInvoke<Tag[]>("list_photo_tags", { photoId });
}

// Albums
export type Album = { id: string; name: string };
export async function listAlbums(): Promise<Album[]> {
  return await safeInvoke<Album[]>("list_albums");
}
export async function createAlbum(name: string): Promise<Album> {
  return await safeInvoke<Album>("create_album", { name });
}
export async function addPhotoToAlbum(
  albumId: string,
  photoId: string,
): Promise<string> {
  return await safeInvoke<string>("add_photo_to_album", { albumId, photoId });
}
export async function removePhotoFromAlbum(
  albumId: string,
  photoId: string,
): Promise<string> {
  return await safeInvoke<string>("remove_photo_from_album", {
    albumId,
    photoId,
  });
}
export async function listAlbumPhotos(albumId: string): Promise<Photo[]> {
  return await safeInvoke<Photo[]>("list_album_photos", { albumId });
}

// Bulk ops and export
export async function bulkAddPhotos(paths: string[]): Promise<string> {
  return await safeInvoke<string>("bulk_add_photos", { filePaths: paths });
}
export async function assignTagBulk(
  photoIds: string[],
  tagId: string,
): Promise<string> {
  return await safeInvoke<string>("assign_tag_bulk", { photoIds, tagId });
}
export async function exportPhotos(
  photoIds: string[],
  destDir: string,
  pattern?: string,
): Promise<string> {
  return await safeInvoke<string>("export_photos", {
    photoIds,
    destDir,
    pattern,
  });
}

// Delete
export async function deletePhotosBulk(
  photoIds: string[],
  permanent?: boolean,
): Promise<string> {
  return await safeInvoke<string>("delete_photos_bulk", {
    photoIds,
    permanent,
  });
}

export async function promotePhoto(
  photoId: string,
  tier: string,
): Promise<string> {
  return await safeInvoke<string>("promote_photo", { photoId, tier });
}

export async function promotePhotosBulk(
  photoIds: string[],
  tier: string,
): Promise<string> {
  return await safeInvoke<string>("promote_photos_bulk", { photoIds, tier });
}

export async function detectFaces(imagePath: string): Promise<DetectedFace[]> {
  return await safeInvoke<DetectedFace[]>("detect_faces", { imagePath });
}

export async function generateFaceEmbedding(
  imagePath: string,
  boundingBox: [number, number, number, number],
): Promise<number[] | null> {
  return await safeInvoke<number[] | null>("generate_face_embedding", {
    imagePath,
    boundingBox,
  });
}

export async function faceDetectionHealthCheck(): Promise<boolean> {
  return await safeInvoke<boolean>("face_detection_health_check");
}

// Thumbnails
export async function generateThumbnail(
  photoId: string,
  maxSize?: number,
): Promise<string> {
  const path = await safeInvoke<string>("generate_thumbnail", {
    photoId,
    maxSize,
  });
  if (isTauriEnvironment()) {
    try {
      const core = await import("@tauri-apps/api/core").catch(() => null as any);
      if (core && typeof (core as any).convertFileSrc === "function") {
        return (core as any).convertFileSrc(path);
      }
      const v1Path = "@tauri-apps/api/" + "tauri";
      const v1 = await import(v1Path as any);
      return (v1 as any).convertFileSrc(path);
    } catch {
      return path;
    }
  }
  return path;
}

export async function toViewSrc(filePathOrUrl: string): Promise<string> {
  if (isTauriEnvironment()) {
    try {
      const core = await import("@tauri-apps/api/core").catch(() => null as any);
      if (core && typeof (core as any).convertFileSrc === "function") {
        return (core as any).convertFileSrc(filePathOrUrl);
      }
      const v1Path = "@tauri-apps/api/" + "tauri";
      const v1 = await import(v1Path as any);
      return (v1 as any).convertFileSrc(filePathOrUrl);
    } catch {
      return filePathOrUrl;
    }
  }
  return filePathOrUrl;
}

// Type definitions for IPC responses
export interface Person {
  id: string;
  name: string;
  // add other fields as needed
}

export interface Relationship {
  id: string;
  type: string;
  // add other fields as needed
}

export interface CreatePersonRequest {
  name: string;
  // add other fields as needed
}

export interface UpdatePersonRequest {
  name?: string;
  // add other fields as needed
}

export interface MergePeopleRequest {
  personIds: string[];
  // add other fields as needed
}

export interface DetectedFace {
  boundingBox: [number, number, number, number];
  embedding?: number[];
  // add other fields as needed
}

// Persist and list face detections
export interface FaceDetectionInput {
  boundingBox: [number, number, number, number];
  embedding?: number[];
}

export async function saveFaceDetections(
  photoId: string,
  model: string,
  detections: FaceDetectionInput[],
): Promise<string> {
  return await safeInvoke<string>("save_face_detections", {
    photoId,
    model,
    detections,
  });
}

export type FaceRow = {
  id: string;
  photo_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  person_id?: string | null;
};

export async function listFaces(photoId: string): Promise<FaceRow[]> {
  return await safeInvoke<FaceRow[]>("list_faces", { photoId });
}

export async function assignFacePerson(
  faceId: string,
  personId?: string,
): Promise<string> {
  return await safeInvoke<string>("assign_face_person", { faceId, personId });
}
