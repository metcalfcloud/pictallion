declare const fetch: typeof window.fetch;
import { apiRequest } from "./queryClient";
import type { Photo } from "../components/smart-collections";

export interface UploadResult {
  filename: string;
  status: 'success' | 'error' | 'duplicate';
  message?: string;
  assetId?: string;
  versionId?: string;
}

export interface UploadResponse {
  results: UploadResult[];
}

export const api = {
  // Upload files
  uploadFiles: async (files: File[]): Promise<UploadResponse> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const result = await response.json() as unknown;
    if (typeof result === 'object' && result !== null && 'results' in result) {
      return result as UploadResponse;
    }
    throw new Error('Unexpected upload response format');
  },

  // Process photo with AI
  processPhoto: async (photoId: string) => {
    const response = await apiRequest('POST', `/api/photos/${photoId}/process`);
    const result = await response.json() as unknown;
    return result;
  },

  // Update photo metadata
  updatePhotoMetadata: async (photoId: string, metadata: Record<string, unknown>, isReviewed?: boolean) => {
    const response = await apiRequest('PATCH', `/api/photos/${photoId}`, {
      metadata,
      isReviewed,
    });
    const result = await response.json() as unknown;
    return result;
  },

  // Get collection statistics
  getStats: async () => {
    const response = await apiRequest('GET', '/api/stats');
    const result = await response.json() as unknown;
    return result;
  },

  // Get recent activity
  getActivity: async (limit = 10) => {
    const response = await apiRequest('GET', `/api/activity?limit=${limit}`);
    const result = await response.json() as unknown;
    return result;
  },

  // Get photos
  getPhotos: async (tier?: 'bronze' | 'silver' | 'gold' | 'unprocessed' | 'all_versions', showAllVersions?: boolean): Promise<Photo[]> => {
    const params = new URLSearchParams();
    if (tier) {
      params.set('tier', tier);
    }
    if (showAllVersions === true) {
      params.set('showAllVersions', 'true');
    }

    const url = `/api/photos${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch photos');
    }

    const result = await response.json() as unknown;
    if (Array.isArray(result)) {
      return result as Photo[];
    }
    throw new Error('Unexpected photos response format');
  },

  // Get recent photos
  getRecentPhotos: async (limit = 6) => {
    const response = await apiRequest('GET', `/api/photos/recent?limit=${limit}`);
    const result = await response.json() as unknown;
    return result;
  },

  // Get single photo details
  getPhotoDetails: async (photoId: string) => {
    const response = await apiRequest('GET', `/api/photos/${photoId}`);
    const result = await response.json() as unknown;
    return result;
  },

  async promotePhoto(photoId: string): Promise<Photo> {
    const response = await fetch(`/api/photos/${photoId}/promote`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to promote photo');
    }

    const result = await response.json() as unknown;
    return result as Photo;
  },

  async demotePhoto(photoId: string): Promise<{ success: boolean; message: string; activeVersion: Photo }> {
    const response = await fetch(`/api/photos/${photoId}/demote`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json() as unknown;
      if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: string }).message === 'string') {
        throw new Error((error as { message: string }).message);
      }
      throw new Error('Failed to demote photo');
    }

    const result = await response.json() as unknown;
    return result as { success: boolean; message: string; activeVersion: Photo };
  },

  async reprocessPhoto(photoId: string): Promise<{ success: boolean; message: string; updatedPhoto: Photo }> {
    const response = await fetch(`/api/photos/${photoId}/reprocess`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json() as unknown;
      if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: string }).message === 'string') {
        throw new Error((error as { message: string }).message);
      }
      throw new Error('Failed to reprocess photo');
    }

    const result = await response.json() as unknown;
    return result as { success: boolean; message: string; updatedPhoto: Photo };
  },

  async getPhotoVersions(photoId: string): Promise<Photo[]> {
    const response = await fetch(`/api/photos/${photoId}/versions`);

    if (!response.ok) {
      throw new Error('Failed to fetch photo versions');
    }

    const result = await response.json() as unknown;
    if (Array.isArray(result)) {
      return result as Photo[];
    }
    throw new Error('Unexpected photo versions response format');
  },
};