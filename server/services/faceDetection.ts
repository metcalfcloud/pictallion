import { aiService } from './ai.js';
import { storage } from '../storage.js';

export interface DetectedFace {
  id: string;
  boundingBox: [number, number, number, number]; // x, y, width, height
  confidence: number; // 0-100 integer scale
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
      console.log('Running face detection on:', imagePath);
      
      // Use AI service to detect faces in image with specific face detection prompt
      const analysis = await aiService.analyzeImage(imagePath);
      
      // Extract face information from AI response
      const faces: DetectedFace[] = [];
      
      // Check both detectedObjects and look for people/faces in the description
      if (analysis.detectedObjects) {
        const faceObjects = analysis.detectedObjects.filter(obj => 
          obj.name.toLowerCase().includes('face') || 
          obj.name.toLowerCase().includes('person') ||
          obj.name.toLowerCase().includes('man') ||
          obj.name.toLowerCase().includes('woman') ||
          obj.name.toLowerCase().includes('child') ||
          obj.name.toLowerCase().includes('human')
        );
        
        console.log('Found potential face objects:', faceObjects.length);
        
        for (const faceObj of faceObjects) {
          const confidence = faceObj.confidence || 0.7; // Default confidence if not provided
          if (confidence > 0.3) { // Lower threshold for testing
            const face: DetectedFace = {
              id: `face_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              boundingBox: faceObj.boundingBox || [0.2, 0.2, 0.6, 0.6], // Default bounding box
              confidence: Math.round(confidence * 100), // Convert to 0-100 integer scale
              embedding: await this.generateFaceEmbedding(imagePath, faceObj.boundingBox || [0.2, 0.2, 0.6, 0.6])
            };
            faces.push(face);
          }
        }
      }
      
      // If no faces detected via objects, check for existing face data in AI metadata or description
      if (faces.length === 0) {
        // Check if there are already detected faces in the analysis
        if (analysis.detectedFaces && Array.isArray(analysis.detectedFaces)) {
          console.log('Found existing face data in AI metadata:', analysis.detectedFaces.length);
          for (const existingFace of analysis.detectedFaces) {
            faces.push({
              id: `face_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              boundingBox: existingFace.boundingBox || [0.25, 0.15, 0.5, 0.7],
              confidence: Math.round((existingFace.confidence || 0.8) * 100), // Convert to 0-100 integer scale
              embedding: await this.generateFaceEmbedding(imagePath, existingFace.boundingBox || [0.25, 0.15, 0.5, 0.7])
            });
          }
        }
        
        // Otherwise check description for people mentions
        if (faces.length === 0 && analysis.longDescription) {
          const description = analysis.longDescription.toLowerCase();
          const peopleKeywords = ['person', 'man', 'woman', 'child', 'people', 'face', 'portrait', 'human', 'individual', 'scientist'];
          
          const hasPeople = peopleKeywords.some(keyword => description.includes(keyword));
          if (hasPeople) {
            console.log('Found people mentioned in description, creating synthetic face');
            faces.push({
              id: `face_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              boundingBox: [0.25, 0.15, 0.5, 0.7], // Center-focused bounding box for portraits
              confidence: 60, // Medium confidence for description-based detection (0-100 scale)
              embedding: await this.generateFaceEmbedding(imagePath, [0.25, 0.15, 0.5, 0.7])
            });
          }
        }
      }
      
      console.log(`Face detection completed: found ${faces.length} faces`);
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

  async findSimilarFaces(faceEmbedding: number[], threshold: number = 0.8): Promise<Array<{faceId: string, similarity: number, personId?: string}>> {
    // Find faces with similar embeddings (simplified cosine similarity)
    const allFaces = await storage.getAllFaces();
    const similarFaces: Array<{faceId: string, similarity: number, personId?: string}> = [];
    
    for (const face of allFaces) {
      if (face.embedding && Array.isArray(face.embedding)) {
        const similarity = this.calculateSimilarity(faceEmbedding, face.embedding as number[]);
        if (similarity > threshold) {
          similarFaces.push({
            faceId: face.id,
            similarity,
            personId: face.personId || undefined
          });
        }
      }
    }
    
    // Sort by similarity descending
    return similarFaces.sort((a, b) => b.similarity - a.similarity);
  }

  async generateFaceSuggestions(unassignedFaceIds: string[]): Promise<Array<{
    faceId: string,
    suggestions: Array<{
      personId: string,
      confidence: number,
      representativeFace?: string,
      personName: string
    }>
  }>> {
    const suggestions = [];
    
    for (const faceId of unassignedFaceIds) {
      const face = await storage.getFace(faceId);
      if (!face || !face.embedding) continue;
      
      const similarFaces = await this.findSimilarFaces(face.embedding as number[], 0.75);
      const personSuggestions = new Map<string, {total: number, count: number, personName: string, representativeFace?: string}>();
      
      // Group similar faces by person
      for (const similar of similarFaces) {
        if (similar.personId) {
          const person = await storage.getPerson(similar.personId);
          if (person) {
            const existing = personSuggestions.get(similar.personId) || {total: 0, count: 0, personName: person.name, representativeFace: person.representativeFace || undefined};
            existing.total += similar.similarity;
            existing.count += 1;
            if (person.representativeFace) {
              existing.representativeFace = person.representativeFace;
            }
            personSuggestions.set(similar.personId, existing);
          }
        }
      }
      
      // Convert to suggestions with confidence scores
      const faceSuggestions = Array.from(personSuggestions.entries()).map(([personId, data]) => ({
        personId,
        confidence: Math.round((data.total / data.count) * 100),
        representativeFace: data.representativeFace,
        personName: data.personName
      })).sort((a, b) => b.confidence - a.confidence).slice(0, 5); // Top 5 suggestions
      
      if (faceSuggestions.length > 0) {
        suggestions.push({
          faceId,
          suggestions: faceSuggestions
        });
      }
    }
    
    return suggestions;
  }

  async generateFaceCrop(imagePath: string, boundingBox: [number, number, number, number]): Promise<string> {
    // Generate a well-framed face crop URL
    // In a real implementation, this would actually crop the image
    // For now, return a parameterized URL that the client can handle
    const [x, y, width, height] = boundingBox;
    return `/api/files/${imagePath}?crop=${x},${y},${width},${height}&face=true`;
  }

  async reprocessUnassignedFaces(): Promise<Array<{
    faceId: string,
    suggestions: Array<{
      personId: string,
      confidence: number,
      representativeFace?: string,
      personName: string
    }>
  }>> {
    // Get all unassigned faces
    const unassignedFaces = await storage.getUnassignedFaces();
    const unassignedFaceIds = unassignedFaces.map((face: any) => face.id);
    
    return await this.generateFaceSuggestions(unassignedFaceIds);
  }

  async batchAssignFaces(assignments: Array<{faceId: string, personId: string}>): Promise<{success: number, failed: number}> {
    let success = 0;
    let failed = 0;
    
    for (const assignment of assignments) {
      try {
        await storage.assignFaceToPerson(assignment.faceId, assignment.personId);
        
        // Update person's face count and representative face if needed
        const person = await storage.getPerson(assignment.personId);
        if (person) {
          const faceCount = await storage.getFacesByPerson(assignment.personId);
          await storage.updatePersonFaceCount(assignment.personId, faceCount.length);
          
          // Set as representative face if it's the first one or has higher confidence
          const face = await storage.getFace(assignment.faceId);
          if (!person.representativeFace || (face && face.confidence > 80)) {
            const photo = await storage.getFileVersion(face?.photoId || '');
            if (photo) {
              await storage.updatePersonRepresentativeFace(assignment.personId, photo.filePath);
            }
          }
        }
        
        success++;
      } catch (error) {
        console.error(`Failed to assign face ${assignment.faceId}:`, error);
        failed++;
      }
    }
    
    return {success, failed};
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
    const photoIds = Array.from(new Set(faces.map(face => face.photoId)));
    
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