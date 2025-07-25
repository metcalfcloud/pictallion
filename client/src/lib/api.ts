import { apiRequest } from "./queryClient";

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
  getPhotos: async (tier?: string) => {
    const url = tier ? `/api/photos?tier=${tier}` : '/api/photos';
    const response = await apiRequest('GET', url);
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
};
