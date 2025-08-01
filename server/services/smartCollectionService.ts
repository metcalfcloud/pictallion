
import { storage } from '../storage.js';
import type { Photo } from '../../shared/types.js';

interface SmartCollection {
}

interface CollectionRule {
}

interface OrganizationResult {
  }>;
}

class SmartCollectionService {
  
  async organizeAllPhotos(): Promise<OrganizationResult> {
    const collections = await storage.getSmartCollections();
    const activeCollections = collections.filter(c => c.isActive && c.type === 'auto');
    
    if (activeCollections.length === 0) {
      return { organized: 0, collections: [] };
    }

    // Get all photos that could be organized
    const photos = await storage.getPhotosForSmartCollections();
    const result: OrganizationResult = { organized: 0, collections: [] };
    
    for (const collection of activeCollections) {
      const matchingPhotos = await this.findMatchingPhotos(photos, collection);
      
      if (matchingPhotos.length > 0) {
        await storage.addPhotosToSmartCollection(collection.id, matchingPhotos.map(p => p.id));
        
        result.collections.push({
        });
        
        result.organized += matchingPhotos.length;
      }
      
      // Update collection photo count and last updated
      await storage.updateSmartCollection(collection.id, {
      });
    }
    
    return result;
  }

  async organizePhoto(photoId: string): Promise<void> {
    const photo = await storage.getFileVersion(photoId);
    if (!photo) return;

    const collections = await storage.getSmartCollections();
    const activeCollections = collections.filter(c => c.isActive && c.type === 'auto');
    
    for (const collection of activeCollections) {
      const isMatch = await this.isPhotoMatch(photo, collection);
      if (isMatch) {
        await storage.addPhotoToSmartCollection(collection.id, photoId);
        await storage.updateSmartCollection(collection.id, {
        });
      }
    }
  }

  private async findMatchingPhotos(photos: Photo[], collection: SmartCollection): Promise<Photo[]> {
    const matchingPhotos: Photo[] = [];
    
    for (const photo of photos) {
      const isMatch = await this.isPhotoMatch(photo, collection);
      if (isMatch) {
        matchingPhotos.push(photo);
      }
    }
    
    return matchingPhotos;
  }

  private async isPhotoMatch(photo: Photo, collection: SmartCollection): Promise<boolean> {
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    // Get enhanced photo data for matching
    const photoData = await this.getEnhancedPhotoData(photo);
    
    for (const rule of collection.rules) {
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
