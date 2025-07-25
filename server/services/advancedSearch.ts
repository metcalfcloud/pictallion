import { eq, and, or, gte, lte, like, isNotNull, inArray, sql } from "drizzle-orm";
import { storage } from "../storage";
import { fileVersions, mediaAssets, people, faces, collections, collectionPhotos } from "@shared/schema";
import type { SmartCollectionRules } from "@shared/schema";

export interface SearchFilters {
  query?: string;
  tier?: 'bronze' | 'silver' | 'gold';
  rating?: { min?: number; max?: number };
  dateRange?: { start?: Date; end?: Date };
  keywords?: string[];
  eventType?: string[];
  eventName?: string;
  location?: string;
  mimeType?: string[];
  camera?: string;
  lens?: string;
  minConfidence?: number;
  peopleIds?: string[];
  hasGPS?: boolean;
  collections?: string[];
  isReviewed?: boolean;
  perceptualHashSimilarity?: { hash: string; threshold: number };
}

export interface SortOptions {
  field: 'createdAt' | 'rating' | 'fileSize' | 'confidence' | 'eventName';
  direction: 'asc' | 'desc';
}

export interface SearchResult {
  photos: any[];
  totalCount: number;
  facets: {
    tiers: Record<string, number>;
    ratings: Record<string, number>;
    eventTypes: Record<string, number>;
    cameras: Record<string, number>;
    mimeTypes: Record<string, number>;
    keywords: Record<string, number>;
  };
}

class AdvancedSearchService {
  
  /**
   * Perform comprehensive search across all photos with filters and facets
   */
  async searchPhotos(
    filters: SearchFilters = {},
    sort: SortOptions = { field: 'createdAt', direction: 'desc' },
    limit: number = 50,
    offset: number = 0
  ): Promise<SearchResult> {
    
    // For now, use a simplified approach with the existing storage interface
    // TODO: Implement full advanced search when direct database access is available
    let allPhotos = await storage.getAllFileVersions();

    // Apply simple filters using array operations
    let filteredPhotos = allPhotos;

    if (filters.tier) {
      filteredPhotos = filteredPhotos.filter(photo => photo.tier === filters.tier);
    }

    if (filters.rating?.min !== undefined || filters.rating?.max !== undefined) {
      filteredPhotos = filteredPhotos.filter(photo => {
        const rating = photo.rating || 0;
        if (filters.rating?.min !== undefined && rating < filters.rating.min) return false;
        if (filters.rating?.max !== undefined && rating > filters.rating.max) return false;
        return true;
      });
    }

    if (filters.query) {
      const query = filters.query.toLowerCase();
      filteredPhotos = filteredPhotos.filter(photo => {
        const filename = photo.filePath.toLowerCase();
        const location = (photo.location || '').toLowerCase();
        const eventName = (photo.eventName || '').toLowerCase();
        const keywords = (photo.keywords || []).join(' ').toLowerCase();
        const shortDesc = ((photo.metadata as any)?.ai?.shortDescription || '').toLowerCase();
        const longDesc = ((photo.metadata as any)?.ai?.longDescription || '').toLowerCase();
        
        return filename.includes(query) || 
               location.includes(query) || 
               eventName.includes(query) ||
               keywords.includes(query) ||
               shortDesc.includes(query) ||
               longDesc.includes(query);
      });
    }

    if (filters.mimeType && filters.mimeType.length > 0) {
      filteredPhotos = filteredPhotos.filter(photo => 
        filters.mimeType!.includes(photo.mimeType)
      );
    }

    if (filters.location) {
      filteredPhotos = filteredPhotos.filter(photo => 
        (photo.location || '').toLowerCase().includes(filters.location!.toLowerCase())
      );
    }

    if (filters.eventName) {
      filteredPhotos = filteredPhotos.filter(photo => 
        (photo.eventName || '').toLowerCase().includes(filters.eventName!.toLowerCase())
      );
    }

    if (filters.eventType && filters.eventType.length > 0) {
      filteredPhotos = filteredPhotos.filter(photo => 
        photo.eventType && filters.eventType!.includes(photo.eventType)
      );
    }

    if (filters.keywords && filters.keywords.length > 0) {
      filteredPhotos = filteredPhotos.filter(photo => {
        const photoKeywords = photo.keywords || [];
        return filters.keywords!.some(keyword => 
          photoKeywords.some(pk => pk.toLowerCase().includes(keyword.toLowerCase()))
        );
      });
    }

    if (filters.isReviewed !== undefined) {
      filteredPhotos = filteredPhotos.filter(photo => photo.isReviewed === filters.isReviewed);
    }

    if (filters.hasGPS) {
      filteredPhotos = filteredPhotos.filter(photo => photo.location && photo.location.length > 0);
    }

    // Apply sorting
    filteredPhotos.sort((a, b) => {
      let aValue, bValue;
      
      switch (sort.field) {
        case 'rating':
          aValue = a.rating || 0;
          bValue = b.rating || 0;
          break;
        case 'fileSize':
          aValue = a.fileSize || 0;
          bValue = b.fileSize || 0;
          break;
        case 'eventName':
          aValue = a.eventName || '';
          bValue = b.eventName || '';
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
      }
      
      if (sort.direction === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    const totalCount = filteredPhotos.length;
    const paginatedPhotos = filteredPhotos.slice(offset, offset + limit);

    // Generate simple facets
    const facets = this.generateSimpleFacets(allPhotos);

    return {
      photos: paginatedPhotos,
      totalCount,
      facets
    };
  }

  /**
   * Find visually similar photos using perceptual hash
   */
  async findSimilarPhotos(
    photoId: string, 
    threshold: number = 85,
    limit: number = 20
  ): Promise<any[]> {
    // Get the perceptual hash of the source photo
    const sourcePhoto = await db
      .select({ perceptualHash: fileVersions.perceptualHash })
      .from(fileVersions)
      .where(eq(fileVersions.id, photoId))
      .limit(1);

    if (!sourcePhoto[0]?.perceptualHash) {
      return [];
    }

    const sourceHash = sourcePhoto[0].perceptualHash;

    // Get all photos with perceptual hashes
    const allPhotos = await db
      .select({
        id: fileVersions.id,
        filePath: fileVersions.filePath,
        perceptualHash: fileVersions.perceptualHash,
        tier: fileVersions.tier,
        originalFilename: mediaAssets.originalFilename,
      })
      .from(fileVersions)
      .leftJoin(mediaAssets, eq(fileVersions.mediaAssetId, mediaAssets.id))
      .where(and(
        isNotNull(fileVersions.perceptualHash),
        sql`${fileVersions.id} != ${photoId}`
      ));

    // Calculate similarities and filter by threshold
    const similarPhotos = allPhotos
      .map(photo => ({
        ...photo,
        similarity: this.calculateHashSimilarity(sourceHash, photo.perceptualHash!)
      }))
      .filter(photo => photo.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return similarPhotos;
  }

  /**
   * Auto-update smart collections based on their rules
   */
  async updateSmartCollections(): Promise<void> {
    const smartCollections = await db
      .select()
      .from(collections)
      .where(eq(collections.isSmartCollection, true));

    for (const collection of smartCollections) {
      if (!collection.smartRules) continue;

      try {
        const rules = collection.smartRules as SmartCollectionRules;
        const matchingPhotos = await this.findPhotosMatchingRules(rules);

        // Clear existing photos in smart collection
        await db
          .delete(collectionPhotos)
          .where(eq(collectionPhotos.collectionId, collection.id));

        // Add matching photos
        if (matchingPhotos.length > 0) {
          await db.insert(collectionPhotos).values(
            matchingPhotos.map(photoId => ({
              collectionId: collection.id,
              photoId: photoId
            }))
          );
        }

        console.log(`Updated smart collection "${collection.name}" with ${matchingPhotos.length} photos`);
      } catch (error) {
        console.error(`Failed to update smart collection ${collection.name}:`, error);
      }
    }
  }

  /**
   * Find photos matching smart collection rules
   */
  private async findPhotosMatchingRules(rules: SmartCollectionRules): Promise<string[]> {
    let query = db.select({ id: fileVersions.id }).from(fileVersions);
    
    const conditions = rules.rules.map(rule => this.buildRuleCondition(rule));
    
    if (conditions.length > 0) {
      if (rules.operator === 'AND') {
        query = query.where(and(...conditions));
      } else {
        query = query.where(or(...conditions));
      }
    }

    const results = await query;
    return results.map(r => r.id);
  }

  /**
   * Build SQL condition from smart collection rule
   */
  private buildRuleCondition(rule: any): any {
    const { field, operator, value } = rule;

    switch (field) {
      case 'rating':
        switch (operator) {
          case 'equals': return eq(fileVersions.rating, value);
          case 'greater_than': return gte(fileVersions.rating, value);
          case 'less_than': return lte(fileVersions.rating, value);
          case 'between': return and(gte(fileVersions.rating, value[0]), lte(fileVersions.rating, value[1]));
        }
        break;

      case 'keywords':
        switch (operator) {
          case 'contains': return sql`${fileVersions.keywords} && ${[value]}`;
          case 'in': return sql`${fileVersions.keywords} && ${value}`;
        }
        break;

      case 'eventType':
        switch (operator) {
          case 'equals': return eq(fileVersions.eventType, value);
          case 'in': return inArray(fileVersions.eventType, value);
        }
        break;

      case 'tier':
        return eq(fileVersions.tier, value);

      case 'isReviewed':
        return eq(fileVersions.isReviewed, value);

      default:
        return sql`true`; // fallback
    }
  }

  /**
   * Generate simple facets for filtering UI
   */
  private generateSimpleFacets(allPhotos: any[]): SearchResult['facets'] {
    const tiers: Record<string, number> = {};
    const ratings: Record<string, number> = {};
    const eventTypes: Record<string, number> = {};
    const cameras: Record<string, number> = {};
    const mimeTypes: Record<string, number> = {};
    const keywords: Record<string, number> = {};

    allPhotos.forEach(photo => {
      // Count tiers
      tiers[photo.tier] = (tiers[photo.tier] || 0) + 1;

      // Count ratings
      if (photo.rating) {
        ratings[String(photo.rating)] = (ratings[String(photo.rating)] || 0) + 1;
      }

      // Count event types
      if (photo.eventType) {
        eventTypes[photo.eventType] = (eventTypes[photo.eventType] || 0) + 1;
      }

      // Count mime types
      mimeTypes[photo.mimeType] = (mimeTypes[photo.mimeType] || 0) + 1;

      // Count cameras from metadata
      const camera = (photo.metadata as any)?.exif?.camera;
      if (camera) {
        cameras[camera] = (cameras[camera] || 0) + 1;
      }

      // Count keywords
      if (photo.keywords) {
        photo.keywords.forEach((keyword: string) => {
          keywords[keyword] = (keywords[keyword] || 0) + 1;
        });
      }
    });

    return {
      tiers,
      ratings,
      eventTypes,
      cameras,
      mimeTypes,
      keywords
    };
  }

  private getSortColumn(field: string) {
    switch (field) {
      case 'createdAt': return fileVersions.createdAt;
      case 'rating': return fileVersions.rating;
      case 'fileSize': return fileVersions.fileSize;
      case 'eventName': return fileVersions.eventName;
      default: return fileVersions.createdAt;
    }
  }

  private calculateHashSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return 0;
    
    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) differences++;
    }
    
    return Math.round((1 - differences / hash1.length) * 100);
  }
}

export const advancedSearch = new AdvancedSearchService();