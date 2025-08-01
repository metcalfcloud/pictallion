import { storage } from '../storage.js';
import type { Photo } from '../../shared/types.js';

interface SmartCollection {
  id: string;
  name: string;
  description?: string | null;
  isPublic?: boolean | null;
  coverPhoto?: string | null;
  isSmartCollection: boolean | null;
  smartRules: CollectionRule[];
  createdAt: Date;
  updatedAt: Date;
}

interface CollectionRule {
  field: string;
  operator: string;
  value: any;
  weight: number;
}

interface OrganizationResult {
  organized: number;
  collections: Array<any>; // Replace 'any' with a more specific type if available
}

class SmartCollectionService {
  
  async organizeAllPhotos(): Promise<OrganizationResult> {
    const collections = await storage.getCollections();
    const activeCollections = collections.filter(c => c.isSmartCollection);
    
    if (activeCollections.length === 0) {
      return { organized: 0, collections: [] };
    }

    // Get all photos that could be organized
    // Fallback: fetch a large number of recent photos as a proxy for all photos
    let photos = await storage.getRecentPhotos(10000);
    // Map to satisfy Photo type: ensure isReviewed is boolean and mediaAsset exists
    photos = photos.map((p: any) => ({
      ...p,
      isReviewed: !!p.isReviewed,
      rating: p.rating === null ? undefined : p.rating,
      mediaAsset: { id: p.mediaAssetId ?? '', originalFilename: '' },
      keywords: p.keywords === null ? undefined : p.keywords,
      location: p.location === null ? undefined : p.location,
      eventType: p.eventType === null ? undefined : p.eventType,
      eventName: p.eventName === null ? undefined : p.eventName,
      perceptualHash: p.perceptualHash === null ? undefined : p.perceptualHash,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : (p.createdAt instanceof Date ? p.createdAt.toISOString() : '')
    }));
    const result: OrganizationResult = { organized: 0, collections: [] };
    
    for (const collection of activeCollections) {
      // Cast smartRules to CollectionRule[] if needed
      const collectionWithRules = {
        ...collection,
        smartRules: Array.isArray(collection.smartRules) ? collection.smartRules : []
      };
      const matchingPhotos = await this.findMatchingPhotos(photos, collectionWithRules);
      
      if (matchingPhotos.length > 0) {
        for (const photo of matchingPhotos) {
          await storage.addPhotoToCollection(collection.id, photo.id);
        }
        
        result.collections.push({
        });
        
        result.organized += matchingPhotos.length;
      }
      
      // Update collection photo count and last updated
      await storage.updateCollection(collection.id, {
      });
    }
    
    return result;
  }

  async organizePhoto(photoId: string): Promise<void> {
    const photo = await storage.getFileVersion(photoId);
    if (!photo) return;

    const collections = await storage.getCollections();
    const activeCollections = collections.filter(c => c.isSmartCollection);
    
    for (const collection of activeCollections) {
      // Ensure photo has required properties for Photo type
      const normalizedPhoto = {
        ...photo,
        isReviewed: !!photo.isReviewed,
        rating: photo.rating === null ? undefined : photo.rating,
        mediaAsset: { id: photo.mediaAssetId ?? '', originalFilename: '' },
        keywords: photo.keywords === null ? undefined : photo.keywords,
        location: photo.location === null ? undefined : photo.location,
        eventType: photo.eventType === null ? undefined : photo.eventType,
        eventName: photo.eventName === null ? undefined : photo.eventName,
        perceptualHash: photo.perceptualHash === null ? undefined : photo.perceptualHash,
        createdAt: typeof photo.createdAt === 'string' ? photo.createdAt : (photo.createdAt instanceof Date ? photo.createdAt.toISOString() : '')
      };
      // Ensure smartRules is always an array of CollectionRule
      const collectionWithRules = {
        ...collection,
        smartRules: Array.isArray(collection.smartRules) ? collection.smartRules : []
      };
      const isMatch = await this.isPhotoMatch(normalizedPhoto, collectionWithRules);
      if (isMatch) {
        await storage.addPhotoToCollection(collection.id, photoId);
        await storage.updateCollection(collection.id, {
        });
      }
    }
  }

  private async findMatchingPhotos(photos: Photo[], collection: SmartCollection): Promise<Photo[]> {
    const matchingPhotos: Photo[] = [];
    
    for (const photo of photos) {
      // Ensure each photo matches the Photo type
      const normalizedPhoto = {
        ...photo,
        isReviewed: !!photo.isReviewed,
        mediaAsset: photo.mediaAsset ?? {}
      };
      const isMatch = await this.isPhotoMatch(normalizedPhoto, collection);
      if (isMatch) {
        matchingPhotos.push(normalizedPhoto);
      }
    }
    
    return matchingPhotos;
  }

  private async isPhotoMatch(photo: Photo, collection: SmartCollection): Promise<boolean> {
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    // Get enhanced photo data for matching
    const photoData = await this.getEnhancedPhotoData(photo);
    
    // Use smartRules for rule evaluation
    const rules: CollectionRule[] = Array.isArray(collection.smartRules)
      ? collection.smartRules
      : [];
    if (!rules.length) {
      return false;
    }
    for (const rule of rules) {
      maxPossibleScore += rule.weight;

      const ruleScore = this.evaluateRule(rule, photoData);
      if (ruleScore > 0) {
        totalScore += rule.weight * ruleScore;
      }
    }
    
    const confidence = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
    return confidence >= 0.6;
  }

  private evaluateRule(rule: CollectionRule, photoData: any): number {
    const { field, operator, value } = rule;
    const fieldValue = this.getFieldValue(field, photoData);

    switch (operator) {
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(item =>
            item.toLowerCase().includes(value.toLowerCase())
          ) ? 1 : 0;
        } else if (typeof fieldValue === 'string') {
          return fieldValue.toLowerCase().includes(value.toLowerCase()) ? 1 : 0;
        }
        return 0;

      case 'equals':
        return fieldValue === value ? 1 : 0;

      case '>=':
        const numValue = parseFloat(value);
        return typeof fieldValue === 'number' && fieldValue >= numValue ? 1 : 0;

      case '<=':
        const maxValue = parseFloat(value);
        return typeof fieldValue === 'number' && fieldValue <= maxValue ? 1 : 0;

      case 'time_range':
        return this.evaluateTimeRange(fieldValue, value);

      default:
        return 0;
    }
  }

  private getFieldValue(field: string, photoData: any): any {
    switch (field) {
      case 'aiTags':
        return photoData.aiTags || [];
      case 'eventType':
        return photoData.eventType || '';
      case 'location':
        return photoData.location || '';
      case 'faceCount':
        return photoData.faceCount || 0;
      case 'personAge':
        return photoData.averageAge || 0;
      case 'metadata.time':
        return photoData.timeOfDay || '';
        return '';
    }
  }

  private evaluateTimeRange(timeValue: any, rangeValue: string): number {
    if (!timeValue || !rangeValue) return 0;
    
    const ranges = rangeValue.split(',');
    const photoTime = this.parseTimeFromValue(timeValue);
    
    if (!photoTime) return 0;
    
    for (const range of ranges) {
      const [start, end] = range.split('-');
      if (this.isTimeInRange(photoTime, start, end)) {
        return 1;
      }
    }
    
    return 0;
  }

  private parseTimeFromValue(value: any): string | null {
    if (typeof value === 'string' && value.match(/^\d{2}:\d{2}/)) {
      return value;
    }
    
    if (value instanceof Date) {
      return value.toTimeString().substring(0, 5);
    }
    
    return null;
  }

  private isTimeInRange(time: string, start: string, end: string): boolean {
    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);
    
    if (startMinutes <= endMinutes) {
      return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
    } else {
      // Handle overnight ranges (e.g., 22:00-06:00)
      return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private async getEnhancedPhotoData(photo: Photo): Promise<any> {
    const aiTags = photo.metadata?.aiTags || [];
    
    const faces = await storage.getFacesByPhoto(photo.id);
    const faceCount = faces.length;
    
    // Calculate average age if people are identified
    let averageAge = 0;
    const identifiedFaces = faces.filter(f => f.personId);
    if (identifiedFaces.length > 0) {
      const ages = [];
      for (const face of identifiedFaces) {
        const person = await storage.getPerson(face.personId!);
        if (person?.birthdate) {
          const photoDate = new Date(photo.createdAt);
          const birthDate = new Date(person.birthdate);
          const age = photoDate.getFullYear() - birthDate.getFullYear();
          ages.push(age);
        }
      }
      if (ages.length > 0) {
        averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
      }
    }
    
    let timeOfDay = '';
    if (photo.metadata?.exif?.dateTimeOriginal) {
      const date = new Date(photo.metadata.exif.dateTimeOriginal);
      timeOfDay = date.toTimeString().substring(0, 5);
    } else if (photo.createdAt) {
      const date = new Date(photo.createdAt);
      timeOfDay = date.toTimeString().substring(0, 5);
    }
    
    return {
      ...photo,
      aiTags,
      faceCount,
      averageAge,
      timeOfDay,
    };
  }
}

export const smartCollectionService = new SmartCollectionService();
