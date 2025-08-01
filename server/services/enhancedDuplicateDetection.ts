import { storage } from "../storage";
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

export interface DuplicateConflict {
  perceptualHash?: string;
  metadata?: {
    existing: any;
    newFile: any;
  };
  similarity?: number;
  reasoning?: string;
  existingPhoto?: any;
  newFile?: {
    tempPath: string;
    originalFilename: string;
  };
}

export interface PerceptualHashResult {
  // Define as needed
}

export class EnhancedDuplicateDetectionService {

  /**
   * Generate perceptual hash for an image using a simple algorithm
   * This creates a hash based on the visual content rather than exact bytes
   */
  async generatePerceptualHash(imagePath: string): Promise<string> {
    try {
      const buffer = await sharp(imagePath)
        .resize(8, 8, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();

      const pixels = Array.from(buffer);
      const average = pixels.reduce((sum, pixel) => sum + pixel, 0) / pixels.length;

      let hash = '';
      for (const pixel of pixels) {
        hash += pixel > average ? '1' : '0';
      }

      return hash;
    } catch (error) {
      // error('Error generating perceptual hash:', error);
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
      // Removed // Extract metadata called with filePath: ${filePath}`);
      
      if (filePath.includes('uploads/temp/')) {
        // Removed // Processing as temp file: ${filePath}`);
        return await this.extractDirectMetadata(filePath);
      }
      
      // Removed // Processing as data directory file: ${filePath}`);
      // Import the shared fileManager instance for files in data directory
      const { fileManager } = await import("./fileManager");
      const metadata = await fileManager.extractMetadata(filePath);
      // Removed // Extracted metadata for duplicate detection - ${filePath}:`, metadata);
      return metadata;
    } catch (error) {
      // error('Error extracting metadata for duplicate detection:', error);
      return {
      };
    }
  }

  /**
   * Extract metadata directly from temp files
   */
  private async extractDirectMetadata(filePath: string): Promise<any> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const ExifImage = (await import('exif')).default;
      
      const logFile = 'debug-metadata.log';
      const log = (msg: string) => {
        const timestamp = new Date().toISOString();
        fs.appendFile(logFile, `[${timestamp}] ${msg}\n`).catch(() => {});
      };
      
      log(`Starting direct metadata extraction for: ${filePath}`);
      
      try {
        await fs.access(filePath);
        log(`File exists: ${filePath}`);
      } catch (accessError) {
        log(`File does not exist: ${filePath}`);
        return { exif: { dateTime: new Date().toISOString() } };
      }
      
      const stats = await fs.stat(filePath);
      log(`File stats: ${JSON.stringify({ size: stats.size, mtime: stats.mtime })}`);
      
      const metadata: any = {};

      const ext = path.extname(filePath).toLowerCase();
      log(`File extension: ${ext}`);
      
      let isImage = /\.(jpg|jpeg|tiff)$/.test(ext);
      if (!isImage && !ext) {
        const buffer = await fs.readFile(filePath);
        const header = buffer.subarray(0, 4);
        isImage = !!(header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF);
        log(`No extension, checking file header: ${Array.from(header).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        log(`Is JPEG by header: ${isImage}`);
      }
      
      if (isImage) {
        try {
          log(`Attempting EXIF extraction for image file: ${filePath}`);
          
          const fileBuffer = await fs.readFile(filePath);
          log(`Read file buffer: ${fileBuffer.length} bytes`);
          
          const exifData = await new Promise((resolve, reject) => {
            try {
              log(`ExifImage constructor type: ${typeof ExifImage}`);
              new ExifImage({ image: filePath }, (error: any, data: any) => {
                if (error) {
                  log(`EXIF extraction failed: ${error.message}`);
                  reject(error);
                } else {
                  log(`EXIF extraction successful`);
                  log(`Raw EXIF data keys: ${Object.keys(data).join(', ')}`);
                  if (data.image) log(`Image data: ${JSON.stringify(data.image, null, 2)}`);
                  if (data.exif) log(`EXIF data: ${JSON.stringify(data.exif, null, 2)}`);
                  if (data.gps) log(`GPS data: ${JSON.stringify(data.gps, null, 2)}`);
                  resolve(data);
                }
              });
            } catch (syncError) {
              log(`Synchronous EXIF error: ${syncError}`);
              reject(syncError);
            }
          });

          const exif: any = {};
          const data = exifData as any;

          if (data.image) {
            exif.camera = data.image.Make && data.image.Model 
              ? `${data.image.Make} ${data.image.Model}` 
              : undefined;
            exif.dateTime = data.image.DateTime || data.exif?.DateTimeOriginal || data.exif?.CreateDate;
            exif.dateTaken = data.image.DateTime || data.exif?.DateTimeOriginal || data.exif?.CreateDate;
            
            exif.orientation = data.image.Orientation !== undefined ? String(data.image.Orientation) : undefined;
            exif.xResolution = data.image.XResolution ? String(data.image.XResolution) : undefined;
            exif.yResolution = data.image.YResolution ? String(data.image.YResolution) : undefined;
            exif.resolutionUnit = data.image.ResolutionUnit !== undefined ? String(data.image.ResolutionUnit) : undefined;
          }

          if (data.exif) {
            exif.aperture = data.exif.FNumber ? `f/${data.exif.FNumber}` : undefined;
            exif.shutter = data.exif.ExposureTime ? `1/${Math.round(1/data.exif.ExposureTime)}s` : undefined;
            exif.iso = data.exif.ISO ? String(data.exif.ISO) : undefined;
            exif.focalLength = data.exif.FocalLength ? `${data.exif.FocalLength}mm` : undefined;
            exif.lens = data.exif.LensModel || data.exif.LensMake;
            
            exif.software = data.exif.Software || data.image?.Software;
            exif.flash = data.exif.Flash !== undefined ? String(data.exif.Flash) : undefined;
            exif.whiteBalance = data.exif.WhiteBalance !== undefined ? String(data.exif.WhiteBalance) : undefined;
            exif.exposureMode = data.exif.ExposureMode !== undefined ? String(data.exif.ExposureMode) : undefined;
            exif.meteringMode = data.exif.MeteringMode !== undefined ? String(data.exif.MeteringMode) : undefined;
            exif.sceneType = data.exif.SceneCaptureType !== undefined ? String(data.exif.SceneCaptureType) : undefined;
            exif.colorSpace = data.exif.ColorSpace !== undefined ? String(data.exif.ColorSpace) : undefined;
            
            if (!exif.dateTime) {
              exif.dateTime = data.exif.DateTimeOriginal || data.exif.CreateDate;
            }
            if (!exif.dateTaken) {
              exif.dateTaken = data.exif.DateTimeOriginal || data.exif.CreateDate;
            }
          }

          if (data.gps) {
            exif.gpsLatitude = data.gps.GPSLatitude ? this.convertDMSToDD(data.gps.GPSLatitude, data.gps.GPSLatitudeRef) : undefined;
            exif.gpsLongitude = data.gps.GPSLongitude ? this.convertDMSToDD(data.gps.GPSLongitude, data.gps.GPSLongitudeRef) : undefined;
          }

          log(`Processed EXIF data: ${JSON.stringify(exif, null, 2)}`);
          metadata.exif = exif;
          log(`Final metadata object: ${JSON.stringify(metadata, null, 2)}`);
        } catch (exifError) {
          log(`No EXIF data available: ${exifError}`);
        }
      }

      return metadata;
    } catch (error) {
      // error(`Error extracting direct metadata for ${filePath}:`, error);
      return {
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
   * @param fileHash - hash of the new file
   * @param originalFilename - name of the new file
   * @param tempFilePath - path to the new file
   */
  async checkForDuplicates(fileHash: string, originalFilename: string, tempFilePath: string): Promise<DuplicateConflict[]> {
    const conflicts: DuplicateConflict[] = [];
    try {
      const exactDuplicate = await storage.getFileByHash(fileHash);
      if (exactDuplicate) {
        const asset = await storage.getMediaAsset(exactDuplicate.mediaAssetId);
        if (asset) {
          return [];
        }
      }
      // Check for perceptual duplicates (only for images)
      const ext = path.extname(originalFilename).toLowerCase();
      const isImage = ['.jpg', '.jpeg', '.png', '.tiff'].includes(ext);
      if (isImage) {
        const newPerceptualHash = await this.generatePerceptualHash(tempFilePath);
        if (newPerceptualHash) {
          const allPhotos = await storage.getAllFileVersions();
          const conflictedHashes = new Set<string>();
          for (const photo of allPhotos) {
            if (photo.fileHash === fileHash) continue;
            if (!photo.mimeType?.startsWith('image/')) continue;
            let existingPerceptualHash = photo.perceptualHash;
            if (!existingPerceptualHash) {
              const fullPath = path.join(process.cwd(), 'data', photo.filePath);
              try {
                await fs.access(fullPath);
                existingPerceptualHash = await this.generatePerceptualHash(fullPath);
                if (existingPerceptualHash) {
                  await storage.updateFileVersionPerceptualHash(photo.id, existingPerceptualHash);
                }
              } catch (error) {
                continue;
              }
            }
            if (existingPerceptualHash) {
              const similarity = this.calculatePerceptualSimilarity(newPerceptualHash, existingPerceptualHash);
              const photoAsset = await storage.getMediaAsset(photo.mediaAssetId);
              if (!photoAsset) continue;
              if (conflictedHashes.has(existingPerceptualHash)) continue;
              if (similarity >= 99.5) {
                const isBurstPhoto = await this.isBurstPhoto(originalFilename, photoAsset.originalFilename, photo.createdAt.toISOString());
                if (similarity < 99.8 && isBurstPhoto) continue;
                let existingMetadata = photo.metadata || { exif: {} };
                if (!(existingMetadata as any).exif) (existingMetadata as any).exif = {};
                if (!(existingMetadata as any).exif.dateTaken) {
                  try {
                    const freshMetadata = await this.extractFileMetadata(photo.filePath);
                    if (freshMetadata && freshMetadata.exif && freshMetadata.exif.dateTaken) {
                      (existingMetadata as any).exif.dateTaken = freshMetadata.exif.dateTaken;
                    } else if (freshMetadata && freshMetadata.exif && freshMetadata.exif.dateTime) {
                      (existingMetadata as any).exif.dateTaken = freshMetadata.exif.dateTime;
                    }
                  } catch {}
                }
                let newFileMetadata;
                try {
                  newFileMetadata = await this.extractDirectMetadata(tempFilePath);
                } catch {
                  newFileMetadata = { exif: { dateTime: new Date().toISOString() } };
                }
                const reasoning = this.analyzeMetadataDifferences(existingMetadata, originalFilename, photoAsset.originalFilename);
                const conflict: DuplicateConflict = {
                  perceptualHash: existingPerceptualHash,
                  metadata: {
                    existing: existingMetadata,
                    newFile: newFileMetadata
                  },
                  similarity,
                  reasoning,
                  existingPhoto: photo,
                  newFile: { tempPath: tempFilePath, originalFilename },
                };
                conflicts.push(conflict);
                conflictedHashes.add(existingPerceptualHash);
              }
            }
          }
        }
      }
      return conflicts;
    } catch (error) {
      return [];
    }
  }

  /**
   * Analyze metadata differences to determine likely original
   */
  private analyzeMetadataDifferences(existingMetadata: any, newFilename: string, existingFilename: string): string {
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

    if (existingMetadata?.exif?.modifyDate && existingMetadata?.exif?.dateTimeOriginal) {
      const modifyDate = new Date(existingMetadata.exif.modifyDate);
      const originalDate = new Date(existingMetadata.exif.dateTimeOriginal);
      if (modifyDate > originalDate) {
        reasons.push('Existing file shows signs of modification (modify date after original date)');
      }
    }

    if (existingMetadata?.exif?.software) {
      const editingSoftware = ['Photoshop', 'GIMP', 'Lightroom', 'Capture One'];
      if (editingSoftware.some(software => 
        existingMetadata.exif.software.toLowerCase().includes(software.toLowerCase())
      )) {
        reasons.push('Existing file processed with photo editing software');
      }
    }

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
  async processDuplicateResolution(action: string, conflict: DuplicateConflict): Promise<{ success: boolean; message: string; assetId?: string }> {
    try {
      switch (action) {
        case 'keep_existing':
          await fs.unlink(conflict.newFile!.tempPath);
          const existingFile = await storage.getFileVersion(conflict.existingPhoto.id);
          return { success: true, message: 'Kept existing file', assetId: existingFile?.mediaAssetId };
        case 'replace_with_new':
          return await this.replaceExistingFile(conflict);
        case 'keep_both':
          return await this.importAsNewFile(conflict);
        default:
          throw new Error('Invalid action');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Replace existing bronze file with new file
   */
  private async replaceExistingFile(conflict: DuplicateConflict): Promise<{ success: boolean; message: string; assetId: string }> {
    const { fileManager } = await import("./fileManager.js");

    if (conflict.existingPhoto.tier !== 'silver') {
      throw new Error('Can only replace files in Silver tier');
    }

    const oldFilePath = path.join(process.cwd(), 'data', conflict.existingPhoto.filePath);
    try {
      await fs.unlink(oldFilePath);
    } catch (error) {
      // log('Old file already removed or not found');
    }

    const tempPath = conflict.newFile!.tempPath;
    const originalFilename = conflict.newFile!.originalFilename;
    const silverPath = await fileManager.processToSilver(
      tempPath, 
      originalFilename
    );

    const metadata = await fileManager.extractMetadata(silverPath);

    await storage.updateFileVersion(conflict.existingPhoto.id, {
      metadata,
    });

    const existingFile = await storage.getFileVersion(conflict.existingPhoto.id);
    if (!existingFile) {
      throw new Error('Existing file not found');
    }

    await storage.updateMediaAsset(existingFile.mediaAssetId, {
    });

    await storage.createAssetHistory({
      mediaAssetId: existingFile.mediaAssetId,
      action: 'replace',
      details: null,
    });

    return {
      success: true,
      message: 'File replaced successfully',
      assetId: existingFile.mediaAssetId,
    };
  }

  /**
   * Check if two photos are likely part of a burst sequence
   */
  private async isBurstPhoto(newFilename: string, existingFilename: string, existingCreatedAt: string): Promise<boolean> {
    try {
      const newBase = newFilename.replace(/\.(jpg|jpeg|png|tiff)$/i, '').toLowerCase();
      const existingBase = existingFilename.replace(/\.(jpg|jpeg|png|tiff)$/i, '').toLowerCase();
      
      // Extract timestamp patterns from filenames (YYYYMMDD_HHMMSS format)
      const timestampPattern = /^(\d{8})_(\d{6})/;
      const newMatch = newBase.match(timestampPattern);
      const existingMatch = existingBase.match(timestampPattern);
      
      if (newMatch && existingMatch) {
        const newDateTime = `${newMatch[1]}_${newMatch[2]}`;
        const existingDateTime = `${existingMatch[1]}_${existingMatch[2]}`;
        
        const newTime = this.parseTimestampFromFilename(newDateTime);
        const existingTime = this.parseTimestampFromFilename(existingDateTime);
        
        if (newTime && existingTime) {
          const timeDiff = Math.abs(newTime.getTime() - existingTime.getTime());
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
      // error('Error checking burst photo pattern:', error);
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
    } catch {
      return null;
    }
  }

  /**
   * Import new file despite similarity
   */
  private async importAsNewFile(conflict: DuplicateConflict): Promise<{ success: boolean; message: string; assetId: string }> {
    const { fileManager } = await import("./fileManager.js");

    const tempPath = conflict.newFile!.tempPath;
    const originalFilename = conflict.newFile!.originalFilename;

    const mediaAsset = await storage.createMediaAsset({
      originalFilename,
    });

    const silverPath = await fileManager.processToSilver(
      tempPath, 
      originalFilename
    );

    // Extract metadata with AI processing
    const metadata = await fileManager.extractMetadata(silverPath);
    
    let aiMetadata = null;
    let aiShortDescription = null;
    const ext = path.extname(originalFilename).toLowerCase();
    const mimeType = ext.includes('jpg') ? 'image/jpeg' : ext.includes('png') ? 'image/png' : 'image/jpeg';
    
    if (mimeType.startsWith('image/')) {
      try {
        const { aiService } = await import("./ai");
        aiMetadata = await aiService.analyzeImage(silverPath, "openai");
        aiShortDescription = aiMetadata.shortDescription;
      } catch (aiError) {
        // warn(`AI analysis failed for ${conflict.newFile.originalFilename}:`, aiError);
      }
    }

    const combinedMetadata = {
      ...metadata,
    };

    const fileVersion = await storage.createFileVersion({
      mediaAssetId: mediaAsset.id,
      tier: 'silver',
      filePath: silverPath,
      fileHash: '', // Provide actual hash if available
      fileSize: 0, // Provide actual size if available
      mimeType,
      metadata: combinedMetadata,
      isReviewed: false,
      aiShortDescription,
    });

    await storage.createAssetHistory({ mediaAssetId: mediaAsset.id, action: 'import', details: null });

    return { success: true, message: 'File imported as new', assetId: mediaAsset.id };
  }
}

export const enhancedDuplicateDetectionService = new EnhancedDuplicateDetectionService();