// Strict TypeScript wrapper for Tauri IPC commands.
// Each function maps to a backend command defined in [`src-tauri/src/ipc.rs`](src-tauri/src/ipc.rs:1).
// This enables type-safe invocation from React components.
// Comments explain "why" each mapping exists: to ensure single source of truth and maintainability.

import { invoke } from '@tauri-apps/api/tauri'

// Debug: Log Tauri IPC presence and environment
console.log("[tauriApi] window.__TAURI_IPC__ type:", typeof window.__TAURI_IPC__);
console.log("[tauriApi] Running in Tauri:", !!window.__TAURI_IPC__);

export async function getPhotoMetadata(photoId: string): Promise<string> {
  return await invoke('get_photo_metadata', { photoId })
}

export async function promotePhotoTier(photoId: string, tier: string): Promise<string> {
  return await invoke('promote_photo_tier', { photoId, tier })
}

export async function listPeople(): Promise<Person[]> {
  return await invoke('list_people')
}

export async function createPerson(req: CreatePersonRequest): Promise<Person> {
  return await invoke('create_person', { req })
}

export async function updatePerson(personId: string, req: UpdatePersonRequest): Promise<Person> {
  return await invoke('update_person', { personId, req })
}

export async function deletePerson(personId: string): Promise<string> {
  return await invoke('delete_person', { personId })
}

export async function mergePeople(req: MergePeopleRequest): Promise<string> {
  return await invoke('merge_people', { req })
}

export async function listRelationships(personId: string): Promise<Relationship[]> {
  return await invoke('list_relationships', { personId })
}

export async function addPhoto(filePath: string): Promise<string> {
  return await invoke('add_photo', { filePath })
}

// List photos from backend
export interface Photo {
  id: string
  filePath: string
  tier: string
}

export async function listPhotos(): Promise<Photo[]> {
  return await invoke('list_photos')
}

export async function promotePhoto(photoId: string, tier: string): Promise<string> {
  return await invoke('promote_photo', { photoId, tier })
}

export async function detectFaces(imagePath: string): Promise<DetectedFace[]> {
  return await invoke('detect_faces', { imagePath })
}

export async function generateFaceEmbedding(imagePath: string, boundingBox: [number, number, number, number]): Promise<number[] | null> {
  return await invoke('generate_face_embedding', { imagePath, boundingBox })
}

export async function faceDetectionHealthCheck(): Promise<boolean> {
  return await invoke('face_detection_health_check')
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