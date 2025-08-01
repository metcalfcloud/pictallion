import { apiRequest } from "./queryClient";
import type { Photo } from '../../../shared/types';

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

    return response.json();
  },

  // Process photo with AI
  processPhoto: async (photoId: string) => {
    const response = await apiRequest('POST', `/api/photos/${photoId}/process`);
    return response.json();
  },

  // Update photo metadata
  updatePhotoMetadata: async (photoId: string, metadata: any, isReviewed?: boolean) => {
    const response = await apiRequest('PATCH', `/api/photos/${photoId}`, {
      metadata,
      isReviewed,
    });
    return response.json();
  },

  // Get collection statistics
  getStats: async () => {
    const response = await apiRequest('GET', '/api/stats');
    return response.json();
  },

  // Get recent activity
  getActivity: async (limit = 10) => {
    const response = await apiRequest('GET', `/api/activity?limit=${limit}`);
    return response.json();
  },

  // Get photos
  getPhotos: async (
    tier?: 'bronze' | 'silver' | 'gold' | 'unprocessed' | 'all_versions',
    showAllVersions?: boolean
  ): Promise<Photo[]> => {
    const params = new URLSearchParams();
    if (tier) {
      params.set('tier', tier);
    }
    if (showAllVersions) {
      params.set('showAllVersions', 'true');
    }

    const url = `/api/photos${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch photos');
    }

    return response.json();
  },

  // Get recent photos
  getRecentPhotos: async (limit = 6) => {
    const response = await apiRequest('GET', `/api/photos/recent?limit=${limit}`);
    return response.json();
  },

  // Get single photo details
  getPhotoDetails: async (photoId: string) => {
    const response = await apiRequest('GET', `/api/photos/${photoId}`);
    return response.json();
  },

  async promotePhoto(photoId: string): Promise<Photo> {
    const response = await fetch(`/api/photos/${photoId}/promote`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to promote photo');
    }

    return response.json();
  },

  async demotePhoto(photoId: string): Promise<{ success: boolean; message: string; activeVersion: Photo }> {
    const response = await fetch(`/api/photos/${photoId}/demote`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to demote photo');
    }

    return response.json();
  },

  async reprocessPhoto(photoId: string): Promise<{ success: boolean; message: string; updatedPhoto: Photo }> {
    const response = await fetch(`/api/photos/${photoId}/reprocess`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to reprocess photo');
    }

    return response.json();
  },

  async getPhotoVersions(photoId: string): Promise<Photo[]> {
    const response = await fetch(`/api/photos/${photoId}/versions`);

    if (!response.ok) {
      throw new Error('Failed to fetch photo versions');
    }

    return response.json();
  },
};