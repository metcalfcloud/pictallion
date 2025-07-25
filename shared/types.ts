// Shared types for both client and server
export interface Photo {
  id: string;
  tier: string;
  filePath: string;
  metadata: any;
  isReviewed?: boolean;
  mediaAsset: {
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
  totalStorage: number;
}