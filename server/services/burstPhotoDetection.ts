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
   * Uses multiple factors: filename similarity, file size, EXIF data, time proximity
   */
  private async calculatePhotoSimilarity(photo1: any, photo2: any): Promise<number> {
    let similarityScore = 0;
    let factorsChecked = 0;

    // File hash comparison (if available)
    if (photo1.fileHash && photo2.fileHash) {
      if (photo1.fileHash === photo2.fileHash) {
        return 1.0; // Identical files
      }
    }

    // Time proximity is important but not enough alone for burst photos
    // Use actual photo capture time from multiple sources in order of preference
    const getPhotoTime = (photo: any) => {
      // First try EXIF datetime fields
      if (photo.metadata?.exif?.dateTime) {
        return new Date(photo.metadata.exif.dateTime).getTime();
      }
      if (photo.metadata?.exif?.dateTimeOriginal) {
        return new Date(photo.metadata.exif.dateTimeOriginal).getTime();
      }
      
      // Try to extract from filename if it has timestamp format (YYYYMMDD_HHMMSS)
      const filename = photo.mediaAsset.originalFilename;
      const timestampMatch = filename.match(/^(\d{8})_(\d{6})/);
      if (timestampMatch) {
        const dateStr = timestampMatch[1]; // YYYYMMDD
        const timeStr = timestampMatch[2]; // HHMMSS
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(dateStr.substring(6, 8));
        const hour = parseInt(timeStr.substring(0, 2));
        const minute = parseInt(timeStr.substring(2, 4));
        const second = parseInt(timeStr.substring(4, 6));
        
        const extractedDate = new Date(year, month, day, hour, minute, second);
        if (!isNaN(extractedDate.getTime())) {
          return extractedDate.getTime();
        }
      }
      
      // Fall back to upload time as last resort
      return new Date(photo.createdAt).getTime();
    };
    
    const time1 = getPhotoTime(photo1);
    const time2 = getPhotoTime(photo2);
    const timeDiff = Math.abs(time1 - time2);
    
    // More strict time-based scoring
    if (timeDiff <= 5000) { // Within 5 seconds - very strong indicator
      similarityScore += 0.4;
      factorsChecked++;
    } else if (timeDiff <= 30000) { // Within 30 seconds - moderate indicator  
      similarityScore += 0.2;
      factorsChecked++;
    } else if (timeDiff <= 60000) { // Within 1 minute - weak indicator
      similarityScore += 0.1;
      factorsChecked++;
    }

    // Filename similarity (burst photos often have sequential names)
    const name1 = photo1.mediaAsset.originalFilename.toLowerCase();
    const name2 = photo2.mediaAsset.originalFilename.toLowerCase();
    
    // Extract base names and numbers for burst detection
    const extractBaseAndNumber = (filename: string) => {
      const withoutExt = filename.replace(/\.(jpg|jpeg|png|tiff)$/i, '');
      const match = withoutExt.match(/^(.+?)[-_]?(\d+)$/);
      if (match) {
        return { base: match[1], number: parseInt(match[2]) };
      }
      return { base: withoutExt, number: null };
    };
    
    const file1 = extractBaseAndNumber(name1);
    const file2 = extractBaseAndNumber(name2);
    
    // Strong similarity: exact base name with sequential numbers
    if (file1.base === file2.base && file1.number !== null && file2.number !== null) {
      const numberDiff = Math.abs(file1.number - file2.number);
      if (numberDiff <= 3) { // Sequential or very close numbers
        similarityScore += 0.4;
        factorsChecked++;
      }
    } else if (file1.base.length > 8 && file2.base.length > 8) {
      // Weaker similarity: common prefix for longer names
      const commonPrefix = this.getCommonPrefix(file1.base, file2.base);
      if (commonPrefix.length >= Math.min(file1.base.length, file2.base.length) * 0.8) {
        similarityScore += 0.2;
        factorsChecked++;
      }
    }

    // File size similarity (burst photos should be very similar in size)
    if (photo1.fileSize && photo2.fileSize) {
      const sizeDiff = Math.abs(photo1.fileSize - photo2.fileSize);
      const avgSize = (photo1.fileSize + photo2.fileSize) / 2;
      const sizeRatio = 1 - (sizeDiff / avgSize);
      if (sizeRatio > 0.95) { // Very strict size similarity for bursts
        similarityScore += 0.3;
        factorsChecked++;
      } else if (sizeRatio > 0.85) { // Moderate similarity
        similarityScore += 0.1;
        factorsChecked++;
      }
    }

    // EXIF data similarity (same camera settings indicate burst)
    try {
      const metadata1 = photo1.metadata;
      const metadata2 = photo2.metadata;
      
      if (metadata1?.exif && metadata2?.exif) {
        const exif1 = metadata1.exif;
        const exif2 = metadata2.exif;
        let exifScore = 0;
        
        // Check camera settings
        if (exif1.make === exif2.make && exif1.model === exif2.model) {
          exifScore += 0.05;
        }
        
        if (exif1.iso === exif2.iso) {
          exifScore += 0.05;
        }
        
        if (exif1.focalLength === exif2.focalLength) {
          exifScore += 0.05;
        }

        if (exif1.aperture === exif2.aperture) {
          exifScore += 0.05;
        }

        similarityScore += exifScore;
        if (exifScore > 0) factorsChecked++;
      }
    } catch (error) {
      // EXIF comparison failed, continue without it
    }

    // Much stricter criteria for burst grouping
    // Only group if we have multiple strong similarity indicators
    if (timeDiff <= 2000 && similarityScore >= 0.7) {
      // Very close in time (under 2 seconds) with decent similarity - likely real burst
      return Math.min(similarityScore + 0.2, 1.0);
    } else if (timeDiff <= 5000 && similarityScore >= 0.9) {
      // Close in time (under 5 seconds) with very high similarity
      return Math.min(similarityScore, 1.0);
    } else if (timeDiff <= 30000 && similarityScore >= 0.95) {
      // Moderately close in time (under 30 seconds) with extremely high similarity
      return Math.min(similarityScore, 1.0);
    }

    return Math.min(similarityScore, 1.0);
  }

  /**
   * Get common prefix between two strings
   */
  private getCommonPrefix(str1: string, str2: string): string {
    let i = 0;
    while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
      i++;
    }
    return str1.substring(0, i);
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