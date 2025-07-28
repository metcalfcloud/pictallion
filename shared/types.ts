// Shared types for both client and server
export interface Photo {
  id: string;
  tier: 'bronze' | 'silver' | 'gold';
  filePath: string;
  mimeType: string;
  fileSize: number;
  metadata: any;
  isReviewed: boolean;
  rating?: number;
  keywords?: string[];
  location?: string;
  eventType?: string;
  eventName?: string;
  perceptualHash?: string;
  createdAt: string;
  mediaAsset: {
    id: string;
    originalFilename: string;
  };
}

export interface Activity {
  id: string;
  action: string;
  details?: string;
  timestamp: string;
  mediaAsset?: {
    originalFilename: string;
  };
}

export interface CollectionStats {
  totalFiles: number;
  bronzeCount: number;
  silverCount: number;
  goldCount: number;
}

export interface Face {
  id: string;
  photoId: string;
  boundingBox: [number, number, number, number]; // [x, y, width, height]
  confidence: number; // 0-100
  embedding?: number[]; // Face embedding for recognition
  personId?: string | null;
  ignored: boolean; // Mark face as ignored
  createdAt: Date;
}