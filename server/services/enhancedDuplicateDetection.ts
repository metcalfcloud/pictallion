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

    // Convert to similarity percentage
    const similarity = ((hash1.length - differences) / hash1.length) * 100;
    return Math.round(similarity);
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
    const conflicts: DuplicateConflict[] = [];

    try {
      // First check for exact MD5 duplicates
      const exactDuplicate = await storage.getFileByHash(fileHash);
      if (exactDuplicate) {
        const asset = await storage.getMediaAsset(exactDuplicate.mediaAssetId);
        if (asset) {
          const conflict: DuplicateConflict = {
            id: crypto.randomUUID(),
            existingPhoto: {
              id: exactDuplicate.id,
              filePath: exactDuplicate.filePath,
              tier: exactDuplicate.tier,
              fileHash: exactDuplicate.fileHash,
              perceptualHash: exactDuplicate.perceptualHash || undefined,
              metadata: exactDuplicate.metadata,
              mediaAsset: {
                originalFilename: asset.originalFilename
              },
              createdAt: exactDuplicate.createdAt.toISOString(),
              fileSize: exactDuplicate.fileSize || 0
            },
            newFile: {
              tempPath: tempFilePath,
              originalFilename,
              fileHash,
              fileSize: (await fs.stat(tempFilePath)).size
            },
            conflictType: 'identical_md5',
            similarity: 100,
            suggestedAction: 'keep_existing',
            reasoning: 'Files are byte-for-byte identical'
          };
          conflicts.push(conflict);
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

              // Consider photos with 99.5%+ visual similarity as potential duplicates
              // This should only catch truly identical photos with different metadata
              if (similarity >= 99.5) {
                const asset = await storage.getMediaAsset(photo.mediaAssetId);
                if (asset) {
                  const reasoning = this.analyzeMetadataDifferences(
                    photo.metadata,
                    originalFilename,
                    asset.originalFilename
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
                        originalFilename: asset.originalFilename
                      },
                      createdAt: photo.createdAt.toISOString(),
                      fileSize: photo.fileSize || 0
                    },
                    newFile: {
                      tempPath: tempFilePath,
                      originalFilename,
                      fileHash,
                      perceptualHash: newPerceptualHash,
                      fileSize: (await fs.stat(tempFilePath)).size
                    },
                    conflictType: 'visually_identical',
                    similarity,
                    suggestedAction: this.suggestAction(reasoning, originalFilename, asset.originalFilename),
                    reasoning
                  };
                  conflicts.push(conflict);
                }
              }
            }
          }
        }
      }

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