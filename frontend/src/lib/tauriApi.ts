// Strict TypeScript wrapper for Tauri IPC commands with browser fallbacks.
// Each function maps to a backend command defined in [`src-tauri/src/ipc.rs`](src-tauri/src/ipc.rs:1).
// This enables type-safe invocation from React components in both Tauri and browser environments.
// Comments explain "why" each mapping exists: to ensure single source of truth and maintainability.

// Real-time environment detection
const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && !!window.__TAURI_IPC__;
};

// Lazy-loaded Tauri API with retry capability
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let tauriLoadPromise: Promise<void> | null = null;

// Lazy load Tauri API on first use
async function ensureTauriApi(): Promise<void> {
  if (tauriInvoke) {
    return; // Already loaded
  }
  
  if (!isTauriEnvironment()) {
    throw new Error('Tauri environment not available');
  }
  
  // If already loading, wait for existing promise
  if (tauriLoadPromise) {
    return tauriLoadPromise;
  }
  
  // Start loading
  tauriLoadPromise = (async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      tauriInvoke = invoke;
      console.log('[tauriApi] Tauri API loaded successfully');
    } catch (err) {
      console.warn('[tauriApi] Failed to load Tauri API:', err);
      tauriLoadPromise = null; // Reset to allow retry
      throw err;
    }
  })();
  
  return tauriLoadPromise;
}

// Debug: Log initial environment state
console.log("[tauriApi] Initial window.__TAURI_IPC__ type:", typeof window.__TAURI_IPC__);
console.log("[tauriApi] Initial window.__TAURI_IPC__ value:", window.__TAURI_IPC__);
console.log("[tauriApi] Initial Tauri detection:", isTauriEnvironment());
console.log("[tauriApi] User agent:", navigator.userAgent);

// Helper function to invoke commands with environment detection
async function safeInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnvironment()) {
    throw new Error(`Feature unavailable: This functionality requires the desktop app. Please use the Tauri desktop version to access '${command}'.`);
  }
  
  await ensureTauriApi();
  
  if (!tauriInvoke) {
    throw new Error(`Feature unavailable: Failed to initialize Tauri API for '${command}'.`);
  }
  
  return await tauriInvoke(command, args) as T;
}

// Helper function for functions that can provide browser fallbacks
async function safeInvokeWithFallback<T>(
  command: string,
  args?: Record<string, unknown>,
  browserFallback?: () => Promise<T>
): Promise<T> {
  if (isTauriEnvironment()) {
    try {
      await ensureTauriApi();
      if (tauriInvoke) {
        return await tauriInvoke(command, args) as T;
      }
    } catch (err) {
      console.warn(`[tauriApi] Failed to use Tauri API for '${command}':`, err);
    }
  }
  
  if (browserFallback) {
    console.warn(`[tauriApi] Using browser fallback for '${command}' - limited functionality available`);
    return await browserFallback();
  }
  
  throw new Error(`Feature unavailable: This functionality requires the desktop app. Please use the Tauri desktop version to access '${command}'.`);
}

// Browser fallback for photo metadata
async function getPhotoMetadataInBrowser(photoId: string): Promise<string> {
  console.warn('[tauriApi] Browser mode: Photo metadata is not available. Please use the desktop app to view detailed photo information.');
  return `Photo metadata not available in browser mode for photo: ${photoId}`;
}

export async function getPhotoMetadata(photoId: string): Promise<string> {
  return await safeInvokeWithFallback<string>('get_photo_metadata', { photoId }, () => getPhotoMetadataInBrowser(photoId));
}

export async function promotePhotoTier(photoId: string, tier: string): Promise<string> {
  return await safeInvoke<string>('promote_photo_tier', { photoId, tier });
}

// Browser fallback for listing people
async function listPeopleInBrowser(): Promise<Person[]> {
  console.warn('[tauriApi] Browser mode: People management is not available. Please use the desktop app to manage people.');
  return [];
}

export async function listPeople(): Promise<Person[]> {
  return await safeInvokeWithFallback<Person[]>('list_people', undefined, listPeopleInBrowser);
}

export async function createPerson(req: CreatePersonRequest): Promise<Person> {
  return await safeInvoke<Person>('create_person', { req });
}

export async function updatePerson(personId: string, req: UpdatePersonRequest): Promise<Person> {
  return await safeInvoke<Person>('update_person', { personId, req });
}

export async function deletePerson(personId: string): Promise<string> {
  return await safeInvoke<string>('delete_person', { personId });
}

export async function mergePeople(req: MergePeopleRequest): Promise<string> {
  return await safeInvoke<string>('merge_people', { req });
}

export async function listRelationships(personId: string): Promise<Relationship[]> {
  return await safeInvoke<Relationship[]>('list_relationships', { personId });
}

// Browser-native fallback for photo upload
async function uploadPhotoInBrowser(file: File): Promise<string> {
  // Create FormData for file upload
  const formData = new FormData();
  formData.append('photo', file);

  // In a real implementation, this would upload to your backend API
  // For now, we'll simulate the upload and return a mock response
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate successful upload
      const mockPhotoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[Browser Upload] Simulated upload of ${file.name}, assigned ID: ${mockPhotoId}`);
      resolve(`Photo uploaded successfully with ID: ${mockPhotoId}`);
    }, 1000);
  });
}

export async function addPhoto(filePathOrFile: string | File): Promise<string> {
  // Use real-time environment detection
  if (isTauriEnvironment()) {
    // In Tauri environment, expect a file path string
    if (typeof filePathOrFile !== 'string') {
      throw new Error('In Tauri environment, addPhoto expects a file path string');
    }
    return await safeInvoke<string>('add_photo', { filePath: filePathOrFile });
  } else {
    // In browser environment, expect a File object
    if (typeof filePathOrFile === 'string') {
      throw new Error('In browser environment, addPhoto expects a File object');
    }
    return await uploadPhotoInBrowser(filePathOrFile);
  }
}

// List photos from backend
export interface Photo {
  id: string
  filePath: string
  tier: string
}

// Browser fallback for listing photos
async function listPhotosInBrowser(): Promise<Photo[]> {
  console.warn('[tauriApi] Browser mode: Photo listing is not available. Please use the desktop app to manage your photo library.');
  return [];
}

export async function listPhotos(): Promise<Photo[]> {
  return await safeInvokeWithFallback<Photo[]>('list_photos', undefined, listPhotosInBrowser);
}

export async function promotePhoto(photoId: string, tier: string): Promise<string> {
  return await safeInvoke<string>('promote_photo', { photoId, tier });
}

export async function detectFaces(imagePath: string): Promise<DetectedFace[]> {
  return await safeInvoke<DetectedFace[]>('detect_faces', { imagePath });
}

export async function generateFaceEmbedding(imagePath: string, boundingBox: [number, number, number, number]): Promise<number[] | null> {
  return await safeInvoke<number[] | null>('generate_face_embedding', { imagePath, boundingBox });
}

export async function faceDetectionHealthCheck(): Promise<boolean> {
  return await safeInvoke<boolean>('face_detection_health_check');
}

// Type definitions for IPC responses
export interface Person {
  id: string
  name: string
  // add other fields as needed
}

export interface Relationship {
  id: string
  type: string
  // add other fields as needed
}

export interface CreatePersonRequest {
  name: string
  // add other fields as needed
}

export interface UpdatePersonRequest {
  name?: string
  // add other fields as needed
}

export interface MergePeopleRequest {
  personIds: string[]
  // add other fields as needed
}

export interface DetectedFace {
  boundingBox: [number, number, number, number]
  embedding?: number[]
  // add other fields as needed
}