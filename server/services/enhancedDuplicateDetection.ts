import { storage } from "../storage";
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

export interface DuplicateConflict {
  id: string;
  existingPhoto: {
    id: string;
    filePath: string;
    tier: string;
    fileHash: string;
    perceptualHash?: string;
    metadata?: any;
    mediaAsset: {
      originalFilename: string;
    };
    createdAt: string;
    fileSize: number;
  };
  newFile: {
    tempPath: string;
    originalFilename: string;
    fileHash: string;
    perceptualHash?: string;
    fileSize: number;
    metadata?: any;
  };
  conflictType: 'identical_md5' | 'visually_identical' | 'similar_metadata';
  similarity: number;
  suggestedAction: 'keep_existing' | 'replace_with_new' | 'keep_both';
  reasoning: string;
}

export interface PerceptualHashResult {
  hash: string;
  similarity: number;
}

export class EnhancedDuplicateDetectionService {

  /**
   * Generate perceptual hash for an image using a simple algorithm
   * This creates a hash based on the visual content rather than exact bytes
   */
  async generatePerceptualHash(imagePath: string): Promise<string> {
    try {
      // Resize image to 8x8 and convert to grayscale for comparison
      const buffer = await sharp(imagePath)
        .resize(8, 8, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();

      // Calculate average pixel value
      const pixels = Array.from(buffer);
      const average = pixels.reduce((sum, pixel) => sum + pixel, 0) / pixels.length;

      // Create hash by comparing each pixel to average
      let hash = '';
      for (const pixel of pixels) {
        hash += pixel > average ? '1' : '0';
      }

      return hash;
    } catch (error) {
      console.error('Error generating perceptual hash:', error);
      return '';
    }
  }

  /**
   * Calculate similarity between two perceptual hashes (Hamming distance)
   */
  calculatePerceptualSimilarity(hash1: string, hash2: string): number {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) {
      return 0;
    }

    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        differences++;
      }
    }

    // Convert to similarity percentage (0-100)
    const similarity = ((hash1.length - differences) / hash1.length) * 100;
    return Math.round(similarity);
  }

  /**
   * Extract metadata from a file for comparison purposes
   */
  async extractFileMetadata(filePath: string): Promise<any> {
    try {
      console.log(`Extract metadata called with filePath: ${filePath}`);
      
      // For temp files, extract metadata directly since they're not in the data directory structure
      if (filePath.includes('uploads/temp/')) {
        console.log(`Processing as temp file: ${filePath}`);
        return await this.extractDirectMetadata(filePath);
      }
      
      console.log(`Processing as data directory file: ${filePath}`);
      // Import the shared fileManager instance for files in data directory
      const { fileManager } = await import("./fileManager");
      const metadata = await fileManager.extractMetadata(filePath);
      console.log(`Extracted metadata for duplicate detection - ${filePath}:`, metadata);
      return metadata;
    } catch (error) {
      console.error('Error extracting metadata for duplicate detection:', error);
      // Return empty metadata structure instead of null
      return {
        exif: null,
        dateTime: null,
        location: null
      };
    }
  }

  /**
   * Extract metadata directly from temp files
   */
  private async extractDirectMetadata(filePath: string): Promise<any> {
    try {
      console.log(`Starting direct metadata extraction for: ${filePath}`);
      const fs = await import('fs/promises');
      const path = await import('path');
      const ExifImage = (await import('exif')).default;
      
      // Check if file exists
      try {
        await fs.access(filePath);
        console.log(`File exists: ${filePath}`);
      } catch (accessError) {
        console.error(`File does not exist: ${filePath}`);
        return { exif: { dateTime: new Date().toISOString() } };
      }
      
      const stats = await fs.stat(filePath);
      console.log(`File stats for ${filePath}:`, { size: stats.size, mtime: stats.mtime });
      
      const metadata: any = {
        exif: {
          dateTime: stats.mtime.toISOString(),
        }
      };

      // Try to extract EXIF data for images
      if (path.extname(filePath).toLowerCase().match(/\.(jpg|jpeg|tiff)$/)) {
        try {
          console.log(`Attempting EXIF extraction for temp file: ${filePath}`);
          const exifData = await new Promise((resolve, reject) => {
            new ExifImage({ image: filePath }, (error: any, data: any) => {
              if (error) {
                console.log(`EXIF extraction failed for ${filePath}:`, error.message);
                reject(error);
              } else {
                console.log(`EXIF extraction successful for ${filePath}:`, JSON.stringify(data, null, 2));
                resolve(data);
              }
            });
          });

          const exif: any = {};
          const data = exifData as any;

          if (data.image) {
            exif.camera = data.image.Make && data.image.Model 
              ? `${data.image.Make} ${data.image.Model}` 
              : undefined;
            exif.dateTime = data.image.DateTime;
          }

          if (data.exif) {
            exif.aperture = data.exif.FNumber ? `f/${data.exif.FNumber}` : undefined;
            exif.shutter = data.exif.ExposureTime ? `1/${Math.round(1/data.exif.ExposureTime)}s` : undefined;
            exif.iso = data.exif.ISO ? String(data.exif.ISO) : undefined;
            exif.focalLength = data.exif.FocalLength ? `${data.exif.FocalLength}mm` : undefined;
            exif.lens = data.exif.LensModel;
          }

          if (data.gps) {
            exif.gpsLatitude = data.gps.GPSLatitude ? this.convertDMSToDD(data.gps.GPSLatitude, data.gps.GPSLatitudeRef) : undefined;
            exif.gpsLongitude = data.gps.GPSLongitude ? this.convertDMSToDD(data.gps.GPSLongitude, data.gps.GPSLongitudeRef) : undefined;
          }

          console.log(`Processed EXIF data for ${filePath}:`, exif);
          metadata.exif = { ...metadata.exif, ...exif };
        } catch (exifError) {
          console.log(`No EXIF data available for temp file ${filePath}:`, exifError);
        }
      }

      return metadata;
    } catch (error) {
      console.error(`Error extracting direct metadata for ${filePath}:`, error);
      return {
        exif: null,
        dateTime: null,
        location: null
      };
    }
  }

  /**
   * Convert DMS coordinates to decimal degrees
   */
  private convertDMSToDD(dms: number[], ref: string): number {
    let dd = dms[0] + dms[1]/60 + dms[2]/3600;
    if (ref === "S" || ref === "W") dd = dd * -1;
    return dd;
  }

  /**
   * Check for duplicates during upload process
   * Returns conflicts that need user resolution
   */
  async checkForDuplicates(
    tempFilePath: string, 
    originalFilename: string, 
    fileHash: string
  ): Promise<DuplicateConflict[]> {
    console.log(`Checking for duplicates: ${originalFilename} with hash ${fileHash}`);
    const conflicts: DuplicateConflict[] = [];

    try {
      // First check for exact MD5 duplicates
      const exactDuplicate = await storage.getFileByHash(fileHash);
      if (exactDuplicate) {
        const asset = await storage.getMediaAsset(exactDuplicate.mediaAssetId);
        if (asset) {
          console.log(`Found exact MD5 duplicate, auto-skipping file: ${originalFilename}`);
          console.log(`Auto-skipping MD5 identical file: ${originalFilename}`);
          // Return empty conflicts array to indicate auto-skip
          return [];
        }
      }

      // Check for perceptual duplicates (only for images)
      const ext = path.extname(originalFilename).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.tiff'].includes(ext);

      if (isImage) {
        const newPerceptualHash = await this.generatePerceptualHash(tempFilePath);
        if (newPerceptualHash) {
          // Get all existing photos to compare perceptual hashes
          const allPhotos = await storage.getAllFileVersions();

          for (const photo of allPhotos) {
            // Skip if this is already an exact duplicate
            if (photo.fileHash === fileHash) continue;

            // Only compare with images
            if (!photo.mimeType?.startsWith('image/')) continue;

            let existingPerceptualHash = photo.perceptualHash;

            // Generate perceptual hash for existing photo if not available
            if (!existingPerceptualHash) {
              const fullPath = path.join(process.cwd(), 'data', photo.filePath);
              try {
                await fs.access(fullPath);
                existingPerceptualHash = await this.generatePerceptualHash(fullPath);

                // Store the perceptual hash for future use
                if (existingPerceptualHash) {
                  await storage.updateFileVersionPerceptualHash(photo.id, existingPerceptualHash);
                }
              } catch (error) {
                continue; // Skip if file doesn't exist
              }
            }

            if (existingPerceptualHash) {
              const similarity = this.calculatePerceptualSimilarity(newPerceptualHash, existingPerceptualHash);

              // Get the asset for this photo to check burst patterns
              const photoAsset = await storage.getMediaAsset(photo.mediaAssetId);
              if (!photoAsset) continue;

              // For perceptual duplicates, we need higher similarity threshold since different MD5 
              // means some bytes are different (metadata, compression, etc.)
              // Only flag near-perfect visual matches that aren't burst photos
              if (similarity >= 99.5) {
                // Check if this might be a burst photo - but be more lenient for high similarity
                const isBurstPhoto = await this.isBurstPhoto(originalFilename, photoAsset.originalFilename, photo.createdAt.toISOString());
                
                // For very high similarity (99.8%+), create conflict even if it might be burst
                // User should decide on truly identical-looking images
                if (similarity >= 99.8) {
                  console.log(`High similarity conflict detected: ${originalFilename} vs ${photoAsset.originalFilename} (${similarity}%)`);
                } else if (isBurstPhoto) {
                  console.log(`Skipping moderate similarity burst photo: ${originalFilename} vs ${photoAsset.originalFilename} (${similarity}%)`);
                  continue;
                }
                const reasoning = this.analyzeMetadataDifferences(
                  photo.metadata,
                  originalFilename,
                  photoAsset.originalFilename
                );

                const conflict: DuplicateConflict = {
                  id: crypto.randomUUID(),
                  existingPhoto: {
                    id: photo.id,
                    filePath: photo.filePath,
                    tier: photo.tier,
                    fileHash: photo.fileHash,
                    perceptualHash: existingPerceptualHash,
                    metadata: photo.metadata,
                    mediaAsset: {
                      originalFilename: photoAsset.originalFilename
                    },
                    createdAt: photo.createdAt.toISOString(),
                    fileSize: photo.fileSize || 0
                  },
                  newFile: {
                    tempPath: tempFilePath,
                    originalFilename,
                    fileHash,
                    perceptualHash: newPerceptualHash,
                    fileSize: (await fs.stat(tempFilePath)).size,
                    metadata: await (async () => {
                      console.log(`ABOUT TO EXTRACT METADATA FOR: ${tempFilePath}`);
                      const result = await this.extractFileMetadata(tempFilePath);
                      console.log(`METADATA EXTRACTION RESULT:`, JSON.stringify(result, null, 2));
                      return result;
                    })()
                  },
                  conflictType: 'visually_identical',
                  similarity,
                  suggestedAction: this.suggestAction(reasoning, originalFilename, photoAsset.originalFilename),
                  reasoning
                };
                conflicts.push(conflict);
              }
            }
          }
        }
      }

      console.log(`Duplicate check completed for ${originalFilename}: ${conflicts.length} conflicts found`);
      return conflicts;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return [];
    }
  }

  /**
   * Analyze metadata differences to determine likely original
   */
  private analyzeMetadataDifferences(
    existingMetadata: any,
    newFilename: string,
    existingFilename: string
  ): string {
    const reasons = [];

    // Check filename patterns that suggest editing
    const editingKeywords = ['edited', 'modified', 'copy', 'version', 'final', 'export'];
    const newHasEditingKeywords = editingKeywords.some(keyword => 
      newFilename.toLowerCase().includes(keyword)
    );
    const existingHasEditingKeywords = editingKeywords.some(keyword => 
      existingFilename.toLowerCase().includes(keyword)
    );

    if (newHasEditingKeywords && !existingHasEditingKeywords) {
      reasons.push('New file appears to be edited version (filename contains editing keywords)');
    } else if (!newHasEditingKeywords && existingHasEditingKeywords) {
      reasons.push('Existing file appears to be edited version (filename contains editing keywords)');
    }

    // TODO: Add more sophisticated metadata analysis
    // - EXIF modification dates
    // - GPS coordinate changes
    // - Software used for editing
    // - File size differences

    if (reasons.length === 0) {
      reasons.push('Files appear visually identical with different metadata - manual review recommended');
    }

    return reasons.join('; ');
  }

  /**
   * Suggest action based on analysis
   */
  private suggestAction(reasoning: string, newFilename: string, existingFilename: string): 'keep_existing' | 'replace_with_new' | 'keep_both' {
    if (reasoning.includes('New file appears to be edited')) {
      return 'keep_existing'; // Keep original
    } else if (reasoning.includes('Existing file appears to be edited')) {
      return 'replace_with_new'; // Replace with original
    } else {
      return 'keep_both'; // Let user decide
    }
  }

  /**
   * Process user's resolution of duplicate conflicts
   */
  async processDuplicateResolution(
    conflictId: string,
    action: 'keep_existing' | 'replace_with_new' | 'keep_both',
    conflict: DuplicateConflict
  ): Promise<{ success: boolean; message: string; assetId?: string }> {
    try {
      switch (action) {
        case 'keep_existing':
          // Remove the new file and return existing asset info
          await fs.unlink(conflict.newFile.tempPath);
          // Get the actual asset to return the ID
          const existingFile = await storage.getFileVersion(conflict.existingPhoto.id);
          return {
            success: true,
            message: 'Kept existing file, new file discarded',
            assetId: existingFile?.mediaAssetId
          };

        case 'replace_with_new':
          // Replace the existing bronze file with new file
          return await this.replaceExistingFile(conflict);

        case 'keep_both':
          // Import as new file despite similarity
          return await this.importAsNewFile(conflict);

        default:
          throw new Error('Invalid action');
      }
    } catch (error) {
      console.error('Error processing duplicate resolution:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Failed to process resolution: ${errorMessage}`
      };
    }
  }

  /**
   * Replace existing bronze file with new file
   */
  private async replaceExistingFile(conflict: DuplicateConflict): Promise<{ success: boolean; message: string; assetId: string }> {
    const { fileManager } = await import("./fileManager.js");

    // Only allow replacement if existing file is in bronze tier
    if (conflict.existingPhoto.tier !== 'bronze') {
      throw new Error('Can only replace files in Bronze tier');
    }

    // Remove the old file
    const oldFilePath = path.join(process.cwd(), 'data', conflict.existingPhoto.filePath);
    try {
      await fs.unlink(oldFilePath);
    } catch (error) {
      console.log('Old file already removed or not found');
    }

    // Move new file to bronze tier
    const bronzePath = await fileManager.moveToBronze(
      conflict.newFile.tempPath, 
      conflict.newFile.originalFilename
    );

    // Extract metadata from new file
    const metadata = await fileManager.extractMetadata(bronzePath);

    // Update the existing file version with new file data
    await storage.updateFileVersion(conflict.existingPhoto.id, {
      filePath: bronzePath,
      fileHash: conflict.newFile.fileHash,
      fileSize: conflict.newFile.fileSize,
      metadata,
      perceptualHash: conflict.newFile.perceptualHash
    });

    // Get the existing file to access the asset ID
    const existingFile = await storage.getFileVersion(conflict.existingPhoto.id);
    if (!existingFile) {
      throw new Error('Existing file not found');
    }

    // Update media asset with new filename
    await storage.updateMediaAsset(existingFile.mediaAssetId, {
      originalFilename: conflict.newFile.originalFilename
    });

    // Log the replacement
    await storage.createAssetHistory({
      mediaAssetId: existingFile.mediaAssetId,
      action: 'REPLACED',
      details: `Bronze file replaced with original version: ${conflict.newFile.originalFilename}`,
    });

    return {
      success: true,
      message: 'File replaced with new version and marked for reprocessing',
      assetId: existingFile.mediaAssetId
    };
  }

  /**
   * Check if two photos are likely part of a burst sequence
   */
  private async isBurstPhoto(newFilename: string, existingFilename: string, existingCreatedAt: string): Promise<boolean> {
    try {
      // Check filename patterns that suggest burst photos
      const newBase = newFilename.replace(/\.(jpg|jpeg|png|tiff)$/i, '').toLowerCase();
      const existingBase = existingFilename.replace(/\.(jpg|jpeg|png|tiff)$/i, '').toLowerCase();
      
      // Extract timestamp patterns from filenames (YYYYMMDD_HHMMSS format)
      const timestampPattern = /^(\d{8})_(\d{6})/;
      const newMatch = newBase.match(timestampPattern);
      const existingMatch = existingBase.match(timestampPattern);
      
      if (newMatch && existingMatch) {
        const newDateTime = `${newMatch[1]}_${newMatch[2]}`;
        const existingDateTime = `${existingMatch[1]}_${existingMatch[2]}`;
        
        // If they have similar timestamp-based names, likely burst photos
        const newTime = this.parseTimestampFromFilename(newDateTime);
        const existingTime = this.parseTimestampFromFilename(existingDateTime);
        
        if (newTime && existingTime) {
          const timeDiff = Math.abs(newTime.getTime() - existingTime.getTime());
          // If within 30 seconds and similar filename pattern, consider it a burst sequence
          // This is more conservative to avoid masking real duplicates
          if (timeDiff <= 30000) {
            return true;
          }
        }
      }
      
      // Check for sequential naming patterns (IMG_1234, IMG_1235, etc.)
      const sequentialPattern1 = /^(.+?)[-_]?(\d+)$/;
      const newSeqMatch = newBase.match(sequentialPattern1);
      const existingSeqMatch = existingBase.match(sequentialPattern1);
      
      if (newSeqMatch && existingSeqMatch && newSeqMatch[1] === existingSeqMatch[1]) {
        const newNum = parseInt(newSeqMatch[2]);
        const existingNum = parseInt(existingSeqMatch[2]);
        const numDiff = Math.abs(newNum - existingNum);
        
        // Sequential numbers within 3 of each other suggest burst (more conservative)
        if (numDiff <= 3) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking burst photo pattern:', error);
      return false;
    }
  }

  /**
   * Parse timestamp from filename format YYYYMMDD_HHMMSS
   */
  private parseTimestampFromFilename(timestamp: string): Date | null {
    try {
      const match = timestamp.match(/^(\d{8})_(\d{6})$/);
      if (!match) return null;
      
      const dateStr = match[1]; // YYYYMMDD
      const timeStr = match[2]; // HHMMSS
      
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(0, 2));
      const minute = parseInt(timeStr.substring(2, 4));
      const second = parseInt(timeStr.substring(4, 6));
      
      const date = new Date(year, month, day, hour, minute, second);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      return null;
    }
  }

  /**
   * Import new file despite similarity
   */
  private async importAsNewFile(conflict: DuplicateConflict): Promise<{ success: boolean; message: string; assetId: string }> {
    const { fileManager } = await import("./fileManager.js");

    // Create new media asset
    const mediaAsset = await storage.createMediaAsset({
      originalFilename: conflict.newFile.originalFilename,
    });

    // Move file to Bronze tier
    const bronzePath = await fileManager.moveToBronze(
      conflict.newFile.tempPath, 
      conflict.newFile.originalFilename
    );

    // Extract metadata
    const metadata = await fileManager.extractMetadata(bronzePath);

    // Create Bronze file version
    const fileVersion = await storage.createFileVersion({
      mediaAssetId: mediaAsset.id,
      tier: 'bronze',
      filePath: bronzePath,
      fileHash: conflict.newFile.fileHash,
      fileSize: conflict.newFile.fileSize,
      mimeType: path.extname(conflict.newFile.originalFilename).toLowerCase().includes('jpg') ? 'image/jpeg' : 
                path.extname(conflict.newFile.originalFilename).toLowerCase().includes('png') ? 'image/png' : 
                'image/jpeg', // default
      metadata,
      perceptualHash: conflict.newFile.perceptualHash,
    });

    // Log ingestion
    await storage.createAssetHistory({
      mediaAssetId: mediaAsset.id,
      action: 'INGESTED',
      details: `File uploaded to Bronze tier (kept both versions): ${conflict.newFile.originalFilename}`,
    });

    return {
      success: true,
      message: 'File imported as new asset despite similarity',
      assetId: mediaAsset.id
    };
  }
}

export const enhancedDuplicateDetectionService = new EnhancedDuplicateDetectionService();