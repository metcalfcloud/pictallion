
import { storage } from "../storage";
import { aiService } from "./ai";

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

class DuplicateDetectionService {
  
  /**
   * Find all duplicate photo groups in the collection
   */
  async findDuplicates(
    minSimilarity: number = 85,
    includeTiers: string[] = ['bronze', 'silver', 'gold']
  ): Promise<DuplicateAnalysis> {
    console.log(`Finding duplicates with minimum similarity: ${minSimilarity}%`);
    
    // Get all photos with perceptual hashes
    const allPhotos = await storage.getAllFileVersions();
    const photosWithHashes = allPhotos.filter(photo => 
      photo.perceptualHash && 
      includeTiers.includes(photo.tier)
    );

    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();
    
    for (let i = 0; i < photosWithHashes.length; i++) {
      if (processed.has(photosWithHashes[i].id)) continue;
      
      const currentPhoto = photosWithHashes[i];
      const similarPhotos = [{ ...currentPhoto, similarity: 100 }];
      processed.add(currentPhoto.id);
      
      // Find similar photos
      for (let j = i + 1; j < photosWithHashes.length; j++) {
        if (processed.has(photosWithHashes[j].id)) continue;
        
        const comparePhoto = photosWithHashes[j];
        const similarity = aiService.calculateHashSimilarity(
          currentPhoto.perceptualHash!,
          comparePhoto.perceptualHash!
        );
        
        if (similarity >= minSimilarity) {
          similarPhotos.push({ ...comparePhoto, similarity });
          processed.add(comparePhoto.id);
        }
      }
      
      // Only create groups with multiple photos
      if (similarPhotos.length > 1) {
        const avgSimilarity = similarPhotos.reduce((sum, p) => sum + p.similarity, 0) / similarPhotos.length;
        const suggestedKeep = this.selectBestPhoto(similarPhotos);
        
        groups.push({
          id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          photos: similarPhotos.sort((a, b) => b.similarity - a.similarity),
          suggestedKeep: suggestedKeep.id,
          averageSimilarity: Math.round(avgSimilarity),
          groupType: this.categorizeGroup(avgSimilarity)
        });
      }
    }

    const analysis = this.generateAnalysis(groups);
    console.log(`Found ${groups.length} duplicate groups with ${analysis.totalDuplicates} total duplicates`);
    
    return analysis;
  }

  /**
   * Find duplicates for a specific photo
   */
  async findDuplicatesForPhoto(
    photoId: string,
    minSimilarity: number = 85
  ): Promise<Array<{
    id: string;
    filePath: string;
    tier: string;
    similarity: number;
    mediaAsset: { originalFilename: string };
  }>> {
    const photo = await storage.getFileVersion(photoId);
    if (!photo?.perceptualHash) {
      return [];
    }

    const allPhotos = await storage.getAllFileVersions();
    const duplicates = [];

    for (const comparePhoto of allPhotos) {
      if (comparePhoto.id === photoId || !comparePhoto.perceptualHash) continue;
      
      const similarity = aiService.calculateHashSimilarity(
        photo.perceptualHash,
        comparePhoto.perceptualHash
      );
      
      if (similarity >= minSimilarity) {
        duplicates.push({
          ...comparePhoto,
          similarity
        });
      }
    }

    return duplicates.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Select the best photo from a group to keep
   */
  private selectBestPhoto(photos: any[]): any {
    // Scoring criteria (higher is better):
    // 1. Higher tier (gold > silver > bronze)
    // 2. Higher rating
    // 3. Larger file size (better quality)
    // 4. Higher AI confidence
    // 5. More recent date
    
    return photos.reduce((best, current) => {
      let bestScore = this.calculatePhotoScore(best);
      let currentScore = this.calculatePhotoScore(current);
      
      return currentScore > bestScore ? current : best;
    });
  }

  private calculatePhotoScore(photo: any): number {
    let score = 0;
    
    // Tier scoring
    switch (photo.tier) {
      case 'gold': score += 1000; break;
      case 'silver': score += 500; break;
      case 'bronze': score += 100; break;
    }
    
    // Rating scoring (0-5 stars)
    score += (photo.rating || 0) * 50;
    
    // File size scoring (normalized)
    score += Math.min((photo.fileSize || 0) / 1000000, 100); // Max 100 points for file size
    
    // AI confidence scoring
    const aiConfidence = photo.metadata?.ai?.aiConfidenceScores?.tags || 0;
    score += aiConfidence * 20;
    
    // Recency scoring (more recent = better)
    const daysSinceCreation = (Date.now() - new Date(photo.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 30 - daysSinceCreation * 0.1); // Newer photos get slight bonus
    
    return score;
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
      const keepPhoto = group.photos.find(p => p.id === group.suggestedKeep);
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
