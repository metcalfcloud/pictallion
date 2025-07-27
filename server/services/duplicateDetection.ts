import { storage } from "../storage";
import crypto from "crypto";

export interface DuplicateGroup {
  id: string;
  photos: Array<{
    id: string;
    filePath: string;
    tier: string;
    similarity: number;
    metadata?: any;
    mediaAsset: {
      originalFilename: string;
    };
    createdAt: string;
    fileSize?: number;
    rating?: number;
  }>;
  suggestedKeep: string; // ID of the photo to keep
  averageSimilarity: number;
  groupType: 'identical' | 'very_similar' | 'similar';
}

export interface DuplicateAnalysis {
  groups: DuplicateGroup[];
  totalDuplicates: number;
  potentialSpaceSavings: number; // in bytes
  summary: {
    identicalGroups: number;
    verySimilarGroups: number;
    similarGroups: number;
  };
}

export class DuplicateDetectionService {
  /**
   * Find duplicate photos based on file hash and perceptual similarity
   */
  async findDuplicates(minSimilarity: number = 85): Promise<DuplicateAnalysis> {
    try {
      // Get all photos from all tiers
      const allAssets = await storage.getAllMediaAssets();
      const allPhotos = [];

      for (const asset of allAssets) {
        const versions = await storage.getFileVersionsByAsset(asset.id);
        for (const version of versions) {
          allPhotos.push({
            ...version,
            mediaAsset: asset
          });
        }
      }

      if (allPhotos.length === 0) {
        return this.generateEmptyAnalysis();
      }

      // Group by file hash for exact duplicates
      const hashGroups = new Map<string, any[]>();
      const processedPhotos = new Set<string>();

      for (const photo of allPhotos) {
        if (!photo.fileHash) continue;

        if (!hashGroups.has(photo.fileHash)) {
          hashGroups.set(photo.fileHash, []);
        }
        hashGroups.get(photo.fileHash)!.push(photo);
      }

      const duplicateGroups: DuplicateGroup[] = [];

      // Process exact duplicates (same file hash)
      for (const entry of Array.from(hashGroups.entries())) {
        const [hash, photos] = entry;
        if (photos.length > 1) {
          const group = this.createDuplicateGroup(photos, 100); // 100% similarity for exact matches
          duplicateGroups.push(group);
          photos.forEach((p: any) => processedPhotos.add(p.id));
        }
      }

      // TODO: Add perceptual hash comparison for similar (not identical) images
      // For now, we'll focus on exact duplicates

      return this.generateAnalysis(duplicateGroups);

    } catch (error) {
      console.error('Error finding duplicates:', error);
      return this.generateEmptyAnalysis();
    }
  }

  /**
   * Create a duplicate group from similar photos
   */
  private createDuplicateGroup(photos: any[], similarity: number): DuplicateGroup {
    const groupId = crypto.randomUUID();

    // Choose the best photo to keep (highest tier, then highest rating, then most recent)
    const suggestedKeep = photos.reduce((best, current) => {
      const tierPriority = { gold: 3, silver: 2, bronze: 1 };
      const bestTier = tierPriority[best.tier as keyof typeof tierPriority] || 0;
      const currentTier = tierPriority[current.tier as keyof typeof tierPriority] || 0;

      if (currentTier > bestTier) return current;
      if (currentTier < bestTier) return best;

      // Same tier, check rating
      const bestRating = best.rating || 0;
      const currentRating = current.rating || 0;
      if (currentRating > bestRating) return current;
      if (currentRating < bestRating) return best;

      // Same rating, prefer more recent
      return new Date(current.createdAt) > new Date(best.createdAt) ? current : best;
    });

    const photosWithSimilarity = photos.map(photo => ({
      ...photo,
      similarity
    }));

    return {
      id: groupId,
      photos: photosWithSimilarity,
      suggestedKeep: suggestedKeep.id,
      averageSimilarity: similarity,
      groupType: this.categorizeGroup(similarity)
    };
  }

  private categorizeGroup(averageSimilarity: number): 'identical' | 'very_similar' | 'similar' {
    if (averageSimilarity >= 95) return 'identical';
    if (averageSimilarity >= 90) return 'very_similar';
    return 'similar';
  }

  private generateAnalysis(groups: DuplicateGroup[]): DuplicateAnalysis {
    const totalDuplicates = groups.reduce((sum, group) => sum + group.photos.length - 1, 0);

    let potentialSpaceSavings = 0;
    groups.forEach(group => {
      group.photos.forEach(photo => {
        if (photo.id !== group.suggestedKeep) {
          potentialSpaceSavings += photo.fileSize || 0;
        }
      });
    });

    const summary = {
      identicalGroups: groups.filter(g => g.groupType === 'identical').length,
      verySimilarGroups: groups.filter(g => g.groupType === 'very_similar').length,
      similarGroups: groups.filter(g => g.groupType === 'similar').length,
    };

    return {
      groups: groups.sort((a, b) => b.averageSimilarity - a.averageSimilarity),
      totalDuplicates,
      potentialSpaceSavings,
      summary
    };
  }

  private generateEmptyAnalysis(): DuplicateAnalysis {
    return {
      groups: [],
      totalDuplicates: 0,
      potentialSpaceSavings: 0,
      summary: {
        identicalGroups: 0,
        verySimilarGroups: 0,
        similarGroups: 0
      }
    };
  }

  /**
   * Execute duplicate removal actions
   */
  async processDuplicateActions(actions: Array<{
    groupId: string;
    action: 'keep_suggested' | 'keep_specific' | 'keep_all';
    keepPhotoId?: string;
  }>): Promise<{
    processed: number;
    deleted: number;
    spaceSaved: number;
    errors: string[];
  }> {
    let processed = 0;
    let deleted = 0;
    let spaceSaved = 0;
    const errors: string[] = [];

    for (const action of actions) {
      try {
        const duplicates = await this.findDuplicates();
        const group = duplicates.groups.find(g => g.id === action.groupId);

        if (!group) {
          errors.push(`Group ${action.groupId} not found`);
          continue;
        }

        if (action.action === 'keep_all') {
          processed++;
          continue; // No deletion needed
        }

        const keepPhotoId = action.action === 'keep_specific' 
          ? action.keepPhotoId 
          : group.suggestedKeep;

        if (!keepPhotoId) {
          errors.push(`No photo specified to keep for group ${action.groupId}`);
          continue;
        }

        // Delete all photos except the one to keep
        for (const photo of group.photos) {
          if (photo.id !== keepPhotoId) {
            try {
              await storage.deleteFileVersion(photo.id);
              deleted++;
              spaceSaved += photo.fileSize || 0;
            } catch (error) {
              errors.push(`Failed to delete photo ${photo.id}: ${error}`);
            }
          }
        }

        processed++;
      } catch (error) {
        errors.push(`Failed to process group ${action.groupId}: ${error}`);
      }
    }

    return { processed, deleted, spaceSaved, errors };
  }

  /**
   * Get duplicate statistics for dashboard
   */
  async getDuplicateStats(): Promise<{
    totalGroups: number;
    totalDuplicates: number;
    potentialSpaceSavings: number;
    lastScanDate?: string;
  }> {
    try {
      const analysis = await this.findDuplicates(80); // Lower threshold for stats

      return {
        totalGroups: analysis.groups.length,
        totalDuplicates: analysis.totalDuplicates,
        potentialSpaceSavings: analysis.potentialSpaceSavings,
        lastScanDate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get duplicate stats:', error);
      return {
        totalGroups: 0,
        totalDuplicates: 0,
        potentialSpaceSavings: 0
      };
    }
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();