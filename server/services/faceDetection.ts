import { aiService } from './ai.js';
import { storage } from '../storage.js';

export interface DetectedFace {
  id: string;
  boundingBox: [number, number, number, number]; // x, y, width, height
  confidence: number;
  embedding?: number[]; // Face embedding for recognition
  personId?: string; // If matched to known person
}

export interface Person {
  id: string;
  name: string;
  faceCount: number;
  representative_face?: string; // Path to best face image
  created_at: Date;
}

class FaceDetectionService {
  async detectFaces(imagePath: string): Promise<DetectedFace[]> {
    try {
      // Use AI service to detect faces in image
      const analysis = await aiService.analyzeImage(imagePath);
      
      // Extract face information from AI response
      const faces: DetectedFace[] = [];
      
      if (analysis.detectedObjects) {
        const faceObjects = analysis.detectedObjects.filter(obj => 
          obj.name.toLowerCase().includes('face') || 
          obj.name.toLowerCase().includes('person')
        );
        
        for (const faceObj of faceObjects) {
          if (faceObj.boundingBox && faceObj.confidence > 0.5) {
            faces.push({
              id: `face_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              boundingBox: faceObj.boundingBox,
              confidence: faceObj.confidence,
              embedding: await this.generateFaceEmbedding(imagePath, faceObj.boundingBox)
            });
          }
        }
      }
      
      return faces;
    } catch (error) {
      console.error('Face detection failed:', error);
      return [];
    }
  }

  async generateFaceEmbedding(imagePath: string, boundingBox: [number, number, number, number]): Promise<number[]> {
    // Generate a simple face embedding based on image characteristics
    // In a real implementation, this would use a face recognition model
    const hash = imagePath + boundingBox.join(',');
    const embedding = [];
    
    for (let i = 0; i < 128; i++) {
      embedding.push(Math.sin(hash.charCodeAt(i % hash.length) + i) * 100);
    }
    
    return embedding;
  }

  async findSimilarFaces(faceEmbedding: number[], threshold: number = 0.8): Promise<string[]> {
    // Find faces with similar embeddings (simplified cosine similarity)
    const allFaces = await storage.getAllFaces();
    const similarFaces: string[] = [];
    
    for (const face of allFaces) {
      if (face.embedding) {
        const similarity = this.calculateSimilarity(faceEmbedding, face.embedding);
        if (similarity > threshold) {
          similarFaces.push(face.id);
        }
      }
    }
    
    return similarFaces;
  }

  private calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  async createPerson(name: string, faceIds: string[]): Promise<Person> {
    const person: Person = {
      id: `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      faceCount: faceIds.length,
      created_at: new Date()
    };
    
    await storage.createPerson(person);
    
    // Link faces to person
    for (const faceId of faceIds) {
      await storage.linkFaceToPerson(faceId, person.id);
    }
    
    return person;
  }

  async getPersonPhotos(personId: string): Promise<any[]> {
    const faces = await storage.getFacesByPerson(personId);
    const photoIds = [...new Set(faces.map(face => face.photoId))];
    
    const photos = [];
    for (const photoId of photoIds) {
      const photo = await storage.getFileVersion(photoId);
      if (photo) {
        const asset = await storage.getMediaAsset(photo.mediaAssetId);
        photos.push({ ...photo, mediaAsset: asset });
      }
    }
    
    return photos;
  }
}

export const faceDetectionService = new FaceDetectionService();