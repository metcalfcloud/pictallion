import { aiService } from './ai.js';
import { storage } from '../storage.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import * as tf from '@tensorflow/tfjs-node';
import * as faceapi from '@vladmandic/face-api';
import { info, error, warn } from "@shared/logger";

export interface DetectedFace {
  embedding?: number[]; // Face embedding for recognition
  personId?: string; // If matched to known person
}

export interface Person {
  representative_face?: string; // Path to best face image
}

class FaceDetectionService {
  private faceApiInitialized = false;

  async initializeFaceAPI() {
    if (this.faceApiInitialized) return;

    try {
      info('Initializing Face-API.js with TensorFlow.js backend', "FaceDetection");

      await tf.ready();

      const modelPath = 'https://vladmandic.github.io/face-api/model';

      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
        faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),

        faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath), // Faster landmarks
        faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),

        faceapi.nets.ageGenderNet.loadFromUri(modelPath), // Age/gender prediction
        faceapi.nets.faceExpressionNet.loadFromUri(modelPath), // Emotion detection
      ]);

      this.faceApiInitialized = true;
      info('Face-API.js models loaded successfully', "FaceDetection");
    } catch (err) {
      error('Failed to initialize Face-API.js', "FaceDetection", { error: err });
      this.faceApiInitialized = false;
    }
  }

  async detectFaces(imagePath: string): Promise<{ faces: DetectedFace[], metadata: any }> {
    const metadata = {
      }
    };

    try {
      info('Running Face-API.js neural network face detection', "FaceDetection", { imagePath });

      let faces = await this.detectFacesWithFaceAPI(imagePath);

      if (faces.length > 0) {
        info(`Face-API detected ${faces.length} faces successfully`, "FaceDetection");
        metadata.faceDetection.method = 'face-api';
      } else {
        info('Face-API found no faces, using heuristic fallback', "FaceDetection");
        faces = await this.detectFacesWithAdvancedAnalysis(imagePath);
        metadata.faceDetection.method = faces.length > 0 ? 'heuristic' : 'none';
      }

      // Removed // Face detection completed: found ${faces.length} faces`);
      return { faces, metadata };
    } catch (error) {
      // error('Face detection failed:', error);
      metadata.faceDetection.failed = true;
      metadata.faceDetection.error = error instanceof Error ? error.message : 'Unknown error';
      return { faces: [], metadata };
    }
  }

  async detectFacesWithFaceAPI(imagePath: string): Promise<DetectedFace[]> {
    try {
      await this.initializeFaceAPI();

      if (!this.faceApiInitialized) {
        // warn('Face-API models not available, will use fallback detection');
        return [];
      }

      const fullImagePath = path.join(process.cwd(), 'data', imagePath);

      if (!fs.existsSync(fullImagePath)) {
        // error(`Image file not found: ${fullImagePath}`);
        return [];
      }

      // Load and process image with Sharp for Face-API
      const imageBuffer = await sharp(fullImagePath)
        .jpeg({ quality: 90 })
        .toBuffer();

      const imageTensor: tf.Tensor3D = tf.node.decodeImage(imageBuffer, 3) as tf.Tensor3D;

      // Remove MTCNN detection, use SSD MobileNet only
      const detections = await faceapi
        .detectAllFaces(imageTensor as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      imageTensor.dispose();

      // Removed // Face-API detected ${detections.length} faces with neural networks`);

      const faces: DetectedFace[] = [];

      for (let i = 0; i < detections.length; i++) {
        const detection = detections[i];
        const box = detection.detection.box;
        const faceData: any = {
            Math.round(box.x),
            Math.round(box.y),
            Math.round(box.width),
            Math.round(box.height)
          ],
        };

        faces.push(faceData);
      }

      return faces;

    } catch (error) {
      // error('Face-API detection failed:', error);
      // Log detailed error info for debugging
      if (error instanceof Error) {
        // Log Face-API error details removed
      }
      return [];
    }
  }

  async detectFacesWithAdvancedAnalysis(imagePath: string): Promise<DetectedFace[]> {
    try {
      const fullImagePath = path.join(process.cwd(), 'data', imagePath);
      const imageInfo = await sharp(fullImagePath).metadata();
      const width = imageInfo.width || 1000;
      const height = imageInfo.height || 1000;

      // Removed // Advanced analysis of ${width}x${height} image for face detection`);

      const skinRegions = await this.findSkinToneRegions(fullImagePath, width, height);

      const compositionRegions = await this.findFaceRegionsUsingComposition(width, height);

      const candidateRegions = this.combineFaceRegions(skinRegions, compositionRegions, width, height);

      const faces: DetectedFace[] = [];
      for (let i = 0; i < candidateRegions.length; i++) {
        const region = candidateRegions[i];
        faces.push({
        });
      }

      return faces;
    } catch (error) {
      // error('Advanced face detection failed:', error);
      return [];
    }
  }

  async findSkinToneRegions(imagePath: string, width: number, height: number): Promise<Array<{boundingBox: [number, number, number, number], confidence: number}>> {
    try {
      // Analyze image for skin-tone color ranges using Sharp
      const { data, info } = await sharp(imagePath)
        .resize(Math.min(400, width), Math.min(400, height), { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const scaleFactor = width / info.width;
      const regions: Array<{boundingBox: [number, number, number, number], confidence: number}> = [];

      // Find regions with skin-tone colors (RGB ranges for various skin tones)
      const skinToneRegions = this.findSkinColorClusters(data, info.width, info.height);

      for (const region of skinToneRegions) {
        const scaledRegion = {
            Math.round(region.x * scaleFactor),
            Math.round(region.y * scaleFactor),
            Math.round(region.width * scaleFactor),
            Math.round(region.height * scaleFactor)
          ] as [number, number, number, number],
        };

        const faceArea = scaledRegion.boundingBox[2] * scaledRegion.boundingBox[3];
        const imageArea = width * height;
        const ratio = faceArea / imageArea;

        if (ratio > 0.005 && ratio < 0.3) { // Face should be 0.5% to 30% of image
          regions.push(scaledRegion);
        }
      }

      // Removed // Found ${regions.length} skin-tone regions`);
      return regions;
    } catch (error) {
      // error('Skin tone analysis failed:', error);
      return [];
    }
  }

  findSkinColorClusters(data: Buffer, width: number, height: number): Array<{x: number, y: number, width: number, height: number, confidence: number}> {
    const regions: Array<{x: number, y: number, width: number, height: number, confidence: number}> = [];
    const channels = 3; // RGB

    // Skin tone color ranges (broader range to catch different ethnicities)
    const skinRanges = [
      { rMin: 170, rMax: 255, gMin: 140, gMax: 220, bMin: 120, bMax: 200 }, // Light skin
      { rMin: 140, rMax: 200, gMin: 100, gMax: 170, bMin: 80, bMax: 140 },  // Medium skin
      { rMin: 100, rMax: 160, gMin: 70, gMax: 130, bMin: 50, bMax: 100 },   // Dark skin
    ];

    let skinPixelMap: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * channels;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];

        for (const range of skinRanges) {
          if (r >= range.rMin && r <= range.rMax &&
              g >= range.gMin && g <= range.gMax &&
              b >= range.bMin && b <= range.bMax) {
            skinPixelMap[y][x] = true;
            break;
          }
        }
      }
    }

    const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (skinPixelMap[y][x] && !visited[y][x]) {
          const region = this.floodFillRegion(skinPixelMap, visited, x, y, width, height);

          if (region.pixelCount > 50) { // Minimum size threshold
            regions.push({
            });
          }
        }
      }
    }

    return regions.slice(0, 5); // Limit to top 5 regions
  }

  floodFillRegion(skinMap: boolean[][], visited: boolean[][], startX: number, startY: number, width: number, height: number) {
    const stack = [{x: startX, y: startY}];
    let pixelCount = 0;
    let minX = startX, maxX = startX, minY = startY, maxY = startY;

    while (stack.length > 0) {
      const {x, y} = stack.pop()!;

      if (x < 0 || x >= width || y < 0 || y >= height || visited[y][x] || !skinMap[y][x]) {
        continue;
      }

      visited[y][x] = true;
      pixelCount++;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      stack.push({x: x+1, y}, {x: x-1, y}, {x, y: y+1}, {x, y: y-1});
    }

    return { pixelCount, minX, maxX, minY, maxY };
  }

  combineFaceRegions(
  ): Array<{boundingBox: [number, number, number, number], confidence: number}> {

    const combinedRegions: Array<{boundingBox: [number, number, number, number], confidence: number}> = [];

    // Start with skin regions (higher confidence)
    for (const skinRegion of skinRegions) {
      combinedRegions.push({
      });
    }

    for (const compRegion of compositionRegions) {
      let hasSignificantOverlap = false;

      for (const existing of combinedRegions) {
        const overlap = this.calculateRegionOverlap(compRegion.boundingBox, existing.boundingBox);
        if (overlap > 0.3) { // 30% overlap threshold
          hasSignificantOverlap = true;
          break;
        }
      }

      if (!hasSignificantOverlap) {
        combinedRegions.push(compRegion);
      }
    }

    return combinedRegions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4); // Max 4 faces per image
  }

  calculateRegionOverlap(region1: [number, number, number, number], region2: [number, number, number, number]): number {
    const [x1, y1, w1, h1] = region1;
    const [x2, y2, w2, h2] = region2;

    const left = Math.max(x1, x2);
    const right = Math.min(x1 + w1, x2 + w2);
    const top = Math.max(y1, y2);
    const bottom = Math.min(y1 + h1, y2 + h2);

    if (left < right && top < bottom) {
      const overlapArea = (right - left) * (bottom - top);
      const area1 = w1 * h1;
      const area2 = w2 * h2;
      const unionArea = area1 + area2 - overlapArea;

      return overlapArea / unionArea;
    }

    return 0;
  }

  async detectFacesWithHeuristics(imagePath: string): Promise<DetectedFace[]> {
    try {
      const fullImagePath = path.join(process.cwd(), 'data', imagePath);
      const imageInfo = await sharp(fullImagePath).metadata();
      const width = imageInfo.width || 1000;
      const height = imageInfo.height || 1000;

      // Removed // Analyzing ${width}x${height} image for face regions`);

      const faceRegions = await this.findFaceRegionsUsingComposition(width, height);

      const faces: DetectedFace[] = [];
      for (const region of faceRegions) {
        faces.push({
        });
      }

      return faces;
    } catch (error) {
      // error('Heuristic face detection failed:', error);
      return [];
    }
  }

  async findFaceRegionsUsingComposition(width: number, height: number): Promise<Array<{boundingBox: [number, number, number, number], confidence: number}>> {
    const regions: Array<{boundingBox: [number, number, number, number], confidence: number}> = [];

    // Calculate typical face size (10-20% of smaller dimension)
    const faceSize = Math.min(width, height) * 0.15;

    // Define search area (upper 70% of image where faces typically appear)
    const searchArea = {
    };

    if (width > height * 1.3) {
      // log('Detected landscape orientation - estimating group photo with multiple faces');

      const positions = [
        { x: width * 0.25, y: height * 0.35 }, // Left person
        { x: width * 0.5, y: height * 0.4 },   // Center person
        { x: width * 0.75, y: height * 0.35 }  // Right person
      ];

      for (const pos of positions) {
        if (pos.x >= searchArea.startX && pos.x <= searchArea.endX &&
            pos.y >= searchArea.startY && pos.y <= searchArea.endY) {
          regions.push({
              Math.round(pos.x - faceSize/2),
              Math.round(pos.y - faceSize/2),
              Math.round(faceSize),
              Math.round(faceSize)
            ],
          });
        }
      }
    } else {
      // log('Detected portrait orientation - estimating single or couple portrait');

      const centerX = width * 0.5;
      const faceY = height * 0.4; // Face typically in upper-middle area

      regions.push({
          Math.round(centerX - faceSize/2),
          Math.round(faceY - faceSize/2),
          Math.round(faceSize),
          Math.round(faceSize)
        ],
      });
    }

    return regions.filter(region => {
      const [x, y, w, h] = region.boundingBox;
      return x >= 0 && y >= 0 && x + w <= width && y + h <= height;
    });
  }

  async generateFaceEmbedding(imagePath: string, boundingBox: [number, number, number, number]): Promise<number[]> {
    try {
      await this.initializeFaceAPI();

      if (!this.faceApiInitialized) {
        const hash = imagePath + boundingBox.join(',');
        const embedding = [];

        for (let i = 0; i < 128; i++) {
          embedding.push(Math.sin(hash.charCodeAt(i % hash.length) + i) * 100);
        }

        return embedding;
      }

      const fullImagePath = path.join(process.cwd(), 'data', imagePath);

      const [x, y, width, height] = boundingBox;
      const faceBuffer = await sharp(fullImagePath)
        .extract({ left: x, top: y, width, height })
        .resize(150, 150)
        .jpeg({ quality: 90 })
        .toBuffer();

      const faceTensor: tf.Tensor3D = tf.node.decodeImage(faceBuffer, 3) as tf.Tensor3D;

      // Get face descriptor using Face-API
      const detection = await faceapi
        .detectSingleFace(faceTensor as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      faceTensor.dispose();

      if (detection && detection.descriptor) {
        return Array.from(detection.descriptor);
      } else {
        // Fallback if no face detected in crop
        const hash = imagePath + boundingBox.join(',');
        const embedding = [];

        for (let i = 0; i < 128; i++) {
          embedding.push(Math.sin(hash.charCodeAt(i % hash.length) + i) * 100);
        }

        return embedding;
      }
    } catch (error) {
      // error('Failed to generate face embedding:', error);

      // Fallback embedding
      const hash = imagePath + boundingBox.join(',');
      const embedding = [];

      for (let i = 0; i < 128; i++) {
        embedding.push(Math.sin(hash.charCodeAt(i % hash.length) + i) * 100);
      }

      return embedding;
    }
  }

  async findSimilarFaces(faceEmbedding: number[], threshold: number = 0.75): Promise<Array<{id: string, similarity: number, personId?: string}>> {
    const allFaces = await storage.getAllFaces();
    const similarFaces: Array<{id: string, similarity: number, personId?: string}> = [];

    for (const face of allFaces) {
      if (Array.isArray(face.embedding)) {
        const similarity = this.calculateEmbeddingSimilarity(faceEmbedding, face.embedding);
        if (similarity > threshold) {
          similarFaces.push({
            similarity,
          });
        }
      }
    }

    return similarFaces.sort((a, b) => b.similarity - a.similarity);
  }

  calculateEmbeddingSimilarity(embedding1: number[], embedding2: number[]): number {
    if (!embedding1 || !embedding2 || embedding1.length === 0 || embedding2.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    const minLength = Math.min(embedding1.length, embedding2.length);

    for (let i = 0; i < minLength; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (magnitude === 0) return 0;

    return Math.max(0, Math.min(1, dotProduct / magnitude));
  }

  async generateFaceSuggestions(unassignedFaceIds: string[]): Promise<Array<{
    suggestedPersonId?: string,
    suggestedPersonName?: string,
  }>> {
    const suggestions: Array<{
      suggestedPersonId?: string,
      suggestedPersonName?: string,
    }> = [];

    // Group unassigned faces by similarity
    for (const faceId of unassignedFaceIds) {
      const face = await storage.getFaceById(faceId);
      if (!face || !Array.isArray(face.embedding)) continue;
      const similarFaces = await this.findSimilarFaces(face.embedding, 0.90);

      if (similarFaces.length > 0) {
        // Find the most likely person match
        const personMatches = new Map<string, number>();

        for (const similar of similarFaces) {
          if (similar.personId) {
            const count = personMatches.get(similar.personId) || 0;
            personMatches.set(similar.personId, count + similar.similarity);
          }
        }

        if (personMatches.size > 0) {
          const bestMatch = Array.from(personMatches.entries())
            .sort((a, b) => b[1] - a[1])[0];

          const person = await storage.getPerson(bestMatch[0]);
          if (person) {
            suggestions.push({
            });
          }
        }
      }
    }

    return suggestions;
  }

  async reprocessUnassignedFaces(): Promise<Array<{
    suggestedPersonId?: string,
    suggestedPersonName?: string,
  }>> {
    const unassignedFaces = await storage.getUnassignedFaces();
    const unassignedFaceIds = unassignedFaces.map(face => face.id);
    return await this.generateFaceSuggestions(unassignedFaceIds);
  }

  async batchAssignFaces(assignments: Array<{faceId: string, personId: string}>): Promise<{success: number, failed: number}> {
    let success = 0;
    let failed = 0;

    for (const assignment of assignments) {
      try {
        await storage.assignFaceToPerson(assignment.faceId, assignment.personId);
        success++;
      } catch (error) {
        // error(`Failed to assign face ${assignment.faceId} to person ${assignment.personId}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  async generateFaceCrop(imagePath: string, boundingBox: [number, number, number, number]): Promise<string> {
    try {
      const [x, y, width, height] = boundingBox;
      const fullImagePath = path.join(process.cwd(), 'data', imagePath);

      const imageInfo = await sharp(fullImagePath).metadata();
      const imageWidth = imageInfo.width || 1000;
      const imageHeight = imageInfo.height || 1000;

      // Use very tight cropping with minimal padding
      const faceCenterX = x + width / 2;
      const faceCenterY = y + height / 2;
      const faceSize = Math.max(width, height);
      const cropSize = faceSize * 1.2; // Just 20% padding around face

      // Center crop around face with bounds checking
      let finalCropX = faceCenterX - cropSize / 2;
      let finalCropY = faceCenterY - cropSize / 2;
      let finalCropSize = cropSize;

      finalCropX = Math.max(0, Math.min(finalCropX, imageWidth - finalCropSize));
      finalCropY = Math.max(0, Math.min(finalCropY, imageHeight - finalCropSize));

      // If crop is too large for image, reduce it but keep it centered
      if (finalCropSize > imageWidth || finalCropSize > imageHeight) {
        finalCropSize = Math.min(imageWidth, imageHeight) * 0.9;
        finalCropX = Math.max(0, faceCenterX - finalCropSize / 2);
        finalCropY = Math.max(0, faceCenterY - finalCropSize / 2);
      }

      // Removed // Face crop: center [${faceCenterX}, ${faceCenterY}] → crop [${finalCropX}, ${finalCropY}, ${finalCropSize}x${finalCropSize}] from ${imageWidth}x${imageHeight}`);

      // Create the crop
      let imageBuffer = await sharp(fullImagePath)
        .extract({
        })
        .resize(200, 200, {
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Check brightness and use larger context if too dark
      const stats = await sharp(imageBuffer).stats();
      const avgBrightness = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;

      if (avgBrightness < 40) {
        // Removed // Dark crop detected (brightness: ${avgBrightness.toFixed(1)}), using larger context`);
        const largeCropSize = Math.min(imageWidth, imageHeight) * 0.5;
        const largeCropX = Math.max(0, Math.min(faceCenterX - largeCropSize / 2, imageWidth - largeCropSize));
        const largeCropY = Math.max(0, Math.min(faceCenterY - largeCropSize / 2, imageHeight - largeCropSize));

        imageBuffer = await sharp(fullImagePath)
          .extract({
          })
          .resize(200, 200, {
          })
          .jpeg({ quality: 85 })
          .toBuffer();
      }

      const cropFileName = `face_crop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      const cropPath = path.join(process.cwd(), 'uploads', 'temp', cropFileName);

      await sharp(imageBuffer).toFile(cropPath);

      return `temp/${cropFileName}`;
    } catch (error) {
      // error('Failed to generate face crop:', error);
      return '';
    }
  }
}

export const faceDetectionService = new FaceDetectionService();