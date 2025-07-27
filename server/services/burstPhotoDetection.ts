import { storage } from "../storage";
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

export interface BurstGroup {
  id: string;
  photos: Array<{
    id: string;
    filePath: string;
    metadata?: any;
    mediaAsset: {
      originalFilename: string;
    };
    createdAt: string;
    fileSize?: number;
    fileHash: string;
  }>;
  suggestedBest: string; // ID of the photo to promote
  averageSimilarity: number;
  timeSpan: number; // in milliseconds
  groupReason: string;
}

export interface BurstAnalysis {
  groups: BurstGroup[];
  totalPhotos: number;
  ungroupedPhotos: Array<{
    id: string;
    filePath: string;
    metadata?: any;
    mediaAsset: { originalFilename: string };
    createdAt: string;
    fileSize?: number;
    fileHash: string;
  }>;
}

export class BurstPhotoDetectionService {
  
  /**
   * Analyze bronze photos for burst sequences
   * Groups photos with 95%+ similarity taken within ±1 minute
   */
  async analyzeBurstPhotos(bronzePhotos: any[]): Promise<BurstAnalysis> {
    try {
      if (bronzePhotos.length === 0) {
        return this.generateEmptyAnalysis();
      }

      // Sort photos by creation time for efficient processing
      const sortedPhotos = [...bronzePhotos].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const burstGroups: BurstGroup[] = [];
      const processedPhotos = new Set<string>();
      const ungroupedPhotos: any[] = [];

      for (let i = 0; i < sortedPhotos.length; i++) {
        const currentPhoto = sortedPhotos[i];
        
        if (processedPhotos.has(currentPhoto.id)) {
          continue;
        }

        // Find photos within 1 minute window
        const timeWindow = 60 * 1000; // 1 minute in milliseconds
        const currentTime = new Date(currentPhoto.createdAt).getTime();
        const candidatePhotos = [currentPhoto];
        
        // Look for photos within time window
        for (let j = i + 1; j < sortedPhotos.length; j++) {
          const comparePhoto = sortedPhotos[j];
          if (processedPhotos.has(comparePhoto.id)) {
            continue;
          }

          const compareTime = new Date(comparePhoto.createdAt).getTime();
          const timeDiff = Math.abs(compareTime - currentTime);
          
          if (timeDiff > timeWindow) {
            break; // Photos are sorted by time, so no more matches possible
          }

          // Check similarity
          const similarity = await this.calculatePhotoSimilarity(currentPhoto, comparePhoto);
          if (similarity >= 0.95) {
            candidatePhotos.push(comparePhoto);
          }
        }

        // If we found similar photos, create a burst group
        if (candidatePhotos.length > 1) {
          const group = this.createBurstGroup(candidatePhotos);
          burstGroups.push(group);
          candidatePhotos.forEach(photo => processedPhotos.add(photo.id));
        } else {
          ungroupedPhotos.push(currentPhoto);
          processedPhotos.add(currentPhoto.id);
        }
      }

      return {
        groups: burstGroups,
        totalPhotos: bronzePhotos.length,
        ungroupedPhotos: ungroupedPhotos
      };

    } catch (error) {
      console.error('Error analyzing burst photos:', error);
      return this.generateEmptyAnalysis();
    }
  }

  /**
   * Calculate similarity between two photos
   * Uses multiple factors: filename similarity, file size, EXIF data
   */
  private async calculatePhotoSimilarity(photo1: any, photo2: any): Promise<number> {
    let similarityScore = 0;

    // File hash comparison (if available)
    if (photo1.fileHash && photo2.fileHash) {
      if (photo1.fileHash === photo2.fileHash) {
        return 1.0; // Identical files
      }
    }

    // Filename similarity (burst photos often have sequential names)
    const name1 = photo1.mediaAsset.originalFilename.toLowerCase();
    const name2 = photo2.mediaAsset.originalFilename.toLowerCase();
    
    // Extract base filename without extension and sequence numbers
    const baseName1 = name1.replace(/\d+\.(jpg|jpeg|png|tiff)$/i, '').replace(/_\d+$/, '');
    const baseName2 = name2.replace(/\d+\.(jpg|jpeg|png|tiff)$/i, '').replace(/_\d+$/, '');
    
    if (baseName1 === baseName2 && baseName1.length > 3) {
      similarityScore += 0.4;
    }

    // File size similarity (burst photos should be similar size)
    if (photo1.fileSize && photo2.fileSize) {
      const sizeDiff = Math.abs(photo1.fileSize - photo2.fileSize);
      const avgSize = (photo1.fileSize + photo2.fileSize) / 2;
      const sizeRatio = 1 - (sizeDiff / avgSize);
      if (sizeRatio > 0.9) {
        similarityScore += 0.3;
      }
    }

    // EXIF data similarity (same camera settings indicate burst)
    try {
      const metadata1 = photo1.metadata;
      const metadata2 = photo2.metadata;
      
      if (metadata1?.exif && metadata2?.exif) {
        const exif1 = metadata1.exif;
        const exif2 = metadata2.exif;
        
        // Check camera settings
        if (exif1.make === exif2.make && exif1.model === exif2.model) {
          similarityScore += 0.1;
        }
        
        if (exif1.iso === exif2.iso) {
          similarityScore += 0.1;
        }
        
        if (exif1.focalLength === exif2.focalLength) {
          similarityScore += 0.1;
        }
      }
    } catch (error) {
      // EXIF comparison failed, continue without it
    }

    return Math.min(similarityScore, 1.0);
  }

  /**
   * Create a burst group from similar photos
   */
  private createBurstGroup(photos: any[]): BurstGroup {
    const groupId = crypto.randomUUID();
    
    // Calculate time span
    const times = photos.map(p => new Date(p.createdAt).getTime());
    const timeSpan = Math.max(...times) - Math.min(...times);
    
    // Find the best photo (largest file size usually indicates best quality)
    const suggestedBest = photos.reduce((best, current) => {
      if (!best.fileSize && current.fileSize) return current;
      if (best.fileSize && !current.fileSize) return best;
      if (current.fileSize > best.fileSize) return current;
      // If same size, prefer most recent
      return new Date(current.createdAt) > new Date(best.createdAt) ? current : best;
    });

    // Determine group reason
    let groupReason = 'Similar photos taken within 1 minute';
    if (timeSpan < 5000) {
      groupReason = 'Rapid burst sequence (under 5 seconds)';
    } else if (timeSpan < 30000) {
      groupReason = 'Quick burst sequence (under 30 seconds)';
    }

    return {
      id: groupId,
      photos: photos.map(p => ({
        id: p.id,
        filePath: p.filePath,
        metadata: p.metadata,
        mediaAsset: p.mediaAsset,
        createdAt: p.createdAt,
        fileSize: p.fileSize,
        fileHash: p.fileHash
      })),
      suggestedBest: suggestedBest.id,
      averageSimilarity: 0.95, // Since we only group photos with 95%+ similarity
      timeSpan,
      groupReason
    };
  }

  private generateEmptyAnalysis(): BurstAnalysis {
    return {
      groups: [],
      totalPhotos: 0,
      ungroupedPhotos: []
    };
  }
}

export const burstPhotoService = new BurstPhotoDetectionService();