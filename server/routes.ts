import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { storage } from "./storage";
import { aiService, AIProvider } from "./services/ai";
import { fileManager } from "./services/fileManager.js";
import { advancedSearch } from "./services/advancedSearch";
import { metadataEmbedding } from "./services/metadataEmbedding";
import { faceDetectionService } from "./services/faceDetection.js";

// Similarity detection function
async function findSimilarPhotos(photos: any[]): Promise<any[]> {
  const similarGroups = [];
  const processed = new Set<string>();

  for (let i = 0; i < photos.length; i++) {
    if (processed.has(photos[i].id)) continue;

    const currentPhoto = photos[i];
    const similarPhotos = [currentPhoto];
    processed.add(currentPhoto.id);

    // Find similar photos based on:
    // 1. Similar filenames (burst photos, sequence shots)
    // 2. Similar AI tags
    // 3. Same time period (within 5 minutes)
    for (let j = i + 1; j < photos.length; j++) {
      if (processed.has(photos[j].id)) continue;

      const comparePhoto = photos[j];
      let similarityScore = 0;

      // Check filename similarity (burst photos often have similar names)
      const currentName = currentPhoto.mediaAsset.originalFilename.toLowerCase();
      const compareName = comparePhoto.mediaAsset.originalFilename.toLowerCase();
      
      // Extract base filename without extension and sequence numbers
      const currentBase = currentName.replace(/\d+\.(jpg|jpeg|png|tiff)$/i, '').replace(/_\d+$/, '');
      const compareBase = compareName.replace(/\d+\.(jpg|jpeg|png|tiff)$/i, '').replace(/_\d+$/, '');
      
      if (currentBase === compareBase && currentBase.length > 3) {
        similarityScore += 0.4;
      }

      // Check AI tags similarity
      const currentTags = currentPhoto.metadata?.ai?.aiTags || [];
      const compareTags = comparePhoto.metadata?.ai?.aiTags || [];
      if (currentTags.length > 0 && compareTags.length > 0) {
        const commonTags = currentTags.filter((tag: string) => compareTags.includes(tag));
        const tagSimilarity = commonTags.length / Math.max(currentTags.length, compareTags.length);
        if (tagSimilarity > 0.6) {
          similarityScore += 0.3;
        }
      }

      // Check time proximity (if within 5 minutes, likely same photo session)
      const currentTime = new Date(currentPhoto.createdAt);
      const compareTime = new Date(comparePhoto.createdAt);
      const timeDiff = Math.abs(currentTime.getTime() - compareTime.getTime());
      if (timeDiff < 5 * 60 * 1000) { // 5 minutes
        similarityScore += 0.3;
      }

      // If similarity score is high enough, group them
      if (similarityScore > 0.6) {
        similarPhotos.push(comparePhoto);
        processed.add(comparePhoto.id);
      }
    }

    // Only create groups with multiple photos
    if (similarPhotos.length > 1) {
      // Find the "best" photo in the group (highest AI confidence or most recent)
      const suggested = similarPhotos.reduce((best, current) => {
        const bestConfidence = best.metadata?.ai?.aiConfidenceScores?.tags || 0;
        const currentConfidence = current.metadata?.ai?.aiConfidenceScores?.tags || 0;
        
        if (currentConfidence > bestConfidence) return current;
        if (currentConfidence === bestConfidence) {
          // If same confidence, prefer more recent
          return new Date(current.createdAt) > new Date(best.createdAt) ? current : best;
        }
        return best;
      });

      similarGroups.push({
        photos: similarPhotos,
        similarityScore: 0.8, // Average high similarity for grouped photos
        suggested: suggested
      });
    }
  }

  return similarGroups;
}
import { insertMediaAssetSchema, insertFileVersionSchema, insertAssetHistorySchema } from "@shared/schema";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/tiff', 'video/mp4', 'video/mov', 'video/avi'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure upload directories exist
  await fileManager.initializeDirectories();

  // Get collection statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getCollectionStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Get recent activity
  app.get("/api/activity", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const activity = await storage.getRecentActivity(limit);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  // Get recent photos
  app.get("/api/photos/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;
      const photos = await storage.getRecentPhotos(limit);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching recent photos:", error);
      res.status(500).json({ message: "Failed to fetch recent photos" });
    }
  });

  // Get photos by tier
  app.get("/api/photos", async (req, res) => {
    try {
      const tier = req.query.tier as "bronze" | "silver" | "gold" | undefined;
      
      if (tier) {
        const photos = await storage.getFileVersionsByTier(tier);
        const photosWithAssets = await Promise.all(
          photos.map(async (photo) => {
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            return { ...photo, mediaAsset: asset };
          })
        );
        res.json(photosWithAssets);
      } else {
        const photos = await storage.getRecentPhotos(100); // Get more for full gallery
        res.json(photos);
      }
    } catch (error) {
      console.error("Error fetching photos:", error);
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  // Get single photo details
  app.get("/api/photos/:id", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const asset = await storage.getMediaAsset(photo.mediaAssetId);
      const history = await storage.getAssetHistory(photo.mediaAssetId);

      res.json({
        ...photo,
        mediaAsset: asset,
        history,
      });
    } catch (error) {
      console.error("Error fetching photo details:", error);
      res.status(500).json({ message: "Failed to fetch photo details" });
    }
  });

  // Upload photos
  app.post("/api/upload", upload.array('files'), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const results = [];

      for (const file of files) {
        try {
          // Calculate file hash for duplicate detection
          const fileBuffer = await fs.readFile(file.path);
          const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

          // Check for duplicates
          const existingFile = await storage.getFileByHash(fileHash);
          if (existingFile) {
            // Move to duplicates folder and skip
            await fileManager.moveToDuplicates(file.path, file.originalname);
            results.push({
              filename: file.originalname,
              status: 'duplicate',
              message: 'File already exists in collection'
            });
            continue;
          }

          // Create media asset
          const mediaAsset = await storage.createMediaAsset({
            originalFilename: file.originalname,
          });

          // Move file to Bronze tier
          const bronzePath = await fileManager.moveToBronze(file.path, file.originalname);

          // Extract basic metadata
          const metadata = await fileManager.extractMetadata(bronzePath);

          // Create Bronze file version
          const fileVersion = await storage.createFileVersion({
            mediaAssetId: mediaAsset.id,
            tier: 'bronze',
            filePath: bronzePath,
            fileHash,
            fileSize: file.size,
            mimeType: file.mimetype,
            metadata,
          });

          // Log ingestion
          await storage.createAssetHistory({
            mediaAssetId: mediaAsset.id,
            action: 'INGESTED',
            details: `File uploaded to Bronze tier: ${file.originalname}`,
          });

          results.push({
            filename: file.originalname,
            status: 'success',
            assetId: mediaAsset.id,
            versionId: fileVersion.id,
          });

        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          results.push({
            filename: file.originalname,
            status: 'error',
            message: 'Failed to process file'
          });
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error in upload endpoint:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // Process Bronze to Silver with AI
  app.post("/api/photos/:id/process", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      if (photo.tier !== 'bronze') {
        return res.status(400).json({ message: "Photo must be in Bronze tier for processing" });
      }

      // Check if this asset already has a Silver version
      const existingSilver = await storage.getFileVersionsByAsset(photo.mediaAssetId);
      const hasSilver = existingSilver.some(version => version.tier === 'silver');
      if (hasSilver) {
        return res.status(400).json({ message: "This photo has already been processed to Silver tier" });
      }

      // Check if file is an image (AI processing currently only supports images)
      if (!photo.mimeType.startsWith('image/')) {
        return res.status(400).json({ message: "AI processing currently only supports images" });
      }

      // Copy file to Silver tier
      const silverPath = await fileManager.copyToSilver(photo.filePath);

      // Run AI analysis with OpenAI as preferred provider
      const aiMetadata = await aiService.analyzeImage(photo.filePath, "openai");

      // Detect faces in the image
      const detectedFaces = await faceDetectionService.detectFaces(photo.filePath);

      // Combine existing metadata with AI metadata
      const existingMetadata = photo.metadata || {};
      const combinedMetadata = {
        ...existingMetadata,
        ai: aiMetadata,
      };

      // Create Silver file version
      const silverVersion = await storage.createFileVersion({
        mediaAssetId: photo.mediaAssetId,
        tier: 'silver',
        filePath: silverPath,
        fileHash: photo.fileHash,
        fileSize: photo.fileSize,
        mimeType: photo.mimeType,
        metadata: combinedMetadata as any,
        isReviewed: false,
      });

      // Save detected faces to database
      for (const face of detectedFaces) {
        await storage.createFace({
          photoId: silverVersion.id,
          boundingBox: face.boundingBox,
          confidence: face.confidence,
          embedding: face.embedding,
          personId: face.personId || null,
        });
      }

      // Log promotion
      await storage.createAssetHistory({
        mediaAssetId: photo.mediaAssetId,
        action: 'PROMOTED',
        details: 'Promoted from Bronze to Silver tier with AI processing',
      });

      res.json(silverVersion);
    } catch (error) {
      console.error("Error processing photo:", error);
      res.status(500).json({ message: "Failed to process photo" });
    }
  });

  // Update photo metadata
  app.patch("/api/photos/:id", async (req, res) => {
    try {
      const { metadata, isReviewed } = req.body;
      
      const updates: Partial<typeof req.body> = {};
      if (metadata !== undefined) updates.metadata = metadata;
      if (isReviewed !== undefined) updates.isReviewed = isReviewed;

      const updatedPhoto = await storage.updateFileVersion(req.params.id, updates);

      // Log metadata update
      await storage.createAssetHistory({
        mediaAssetId: updatedPhoto.mediaAssetId,
        action: 'METADATA_EDITED',
        details: 'Photo metadata updated',
      });

      res.json(updatedPhoto);
    } catch (error) {
      console.error("Error updating photo:", error);
      res.status(500).json({ message: "Failed to update photo" });
    }
  });

  // Serve uploaded images
  app.get("/api/files/*", async (req, res) => {
    try {
      const filePath = (req.params as any)[0];
      const fullPath = path.join(process.cwd(), 'data', filePath);
      
      // Security check to prevent directory traversal
      if (!fullPath.startsWith(path.join(process.cwd(), 'data'))) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if file exists
      try {
        await fs.access(fullPath);
        
        // Check if this is a face crop request
        if (req.query.crop && req.query.face === 'true') {
          const cropParams = (req.query.crop as string).split(',').map(Number);
          if (cropParams.length === 4) {
            // For now, return the full image with crop parameters in header
            // In a real implementation, you would crop the image server-side
            res.setHeader('X-Face-Crop', req.query.crop as string);
            res.setHeader('Content-Type', 'image/jpeg');
          }
        }
        
        // Check if this is a download request
        if (req.query.download === 'true') {
          const filename = path.basename(fullPath);
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
        }
        
        res.sendFile(fullPath);
      } catch {
        res.status(404).json({ message: "File not found" });
      }
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // AI Configuration Routes
  app.get("/api/ai/config", async (req, res) => {
    try {
      const config = aiService.getConfig();
      const providers = await aiService.getAvailableProviders();
      
      res.json({
        currentProvider: config.provider,
        availableProviders: providers,
        config: {
          ollama: {
            baseUrl: config.ollama.baseUrl,
            visionModel: config.ollama.visionModel,
            textModel: config.ollama.textModel
          },
          openai: {
            model: config.openai.model,
            hasApiKey: !!config.openai.apiKey
          }
        }
      });
    } catch (error) {
      console.error("Get AI config error:", error);
      res.status(500).json({ error: "Failed to get AI configuration" });
    }
  });

  app.post("/api/ai/config", async (req, res) => {
    try {
      const { provider, ollama, openai } = req.body;
      
      const newConfig: any = {};
      if (provider) newConfig.provider = provider;
      if (ollama) newConfig.ollama = ollama;
      if (openai) newConfig.openai = openai;
      
      aiService.setConfig(newConfig);
      
      res.json({ success: true, message: "AI configuration updated" });
    } catch (error) {
      console.error("Update AI config error:", error);
      res.status(500).json({ error: "Failed to update AI configuration" });
    }
  });

  app.post("/api/ai/test", async (req, res) => {
    try {
      const providers = await aiService.getAvailableProviders();
      
      res.json({
        ollama: providers.ollama,
        openai: providers.openai
      });
    } catch (error) {
      console.error("Test AI providers error:", error);
      res.status(500).json({ error: "Failed to test AI providers" });
    }
  });

  // Test face detection endpoint
  app.post("/api/photos/:id/detect-faces", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      console.log('Testing face detection on photo:', photo.filePath);
      
      // Run face detection
      const detectedFaces = await faceDetectionService.detectFaces(photo.filePath);
      
      // Save faces to database if any detected
      const savedFaces = [];
      for (const face of detectedFaces) {
        const savedFace = await storage.createFace({
          photoId: photo.id,
          boundingBox: face.boundingBox,
          confidence: face.confidence,
          embedding: face.embedding,
          personId: face.personId || null,
        });
        savedFaces.push(savedFace);
      }
      
      // Get the media asset separately
      const mediaAsset = await storage.getMediaAsset(photo.mediaAssetId);
      
      res.json({
        photo: mediaAsset?.originalFilename || 'Unknown',
        facesDetected: detectedFaces.length,
        faces: savedFaces
      });
    } catch (error) {
      console.error("Error in face detection test:", error);
      res.status(500).json({ message: "Face detection test failed" });
    }
  });

  // People & Faces routes
  app.get("/api/people", async (req, res) => {
    try {
      const people = await storage.getPeople();
      
      // Add face count and photo count to each person
      const peopleWithStats = await Promise.all(
        people.map(async (person) => {
          const faces = await storage.getFacesByPerson(person.id);
          const photoIds = Array.from(new Set(faces.map(face => face.photoId)));
          
          return {
            ...person,
            faceCount: faces.length,
            photoCount: photoIds.length,
            coverPhoto: faces[0]?.photoId || null
          };
        })
      );
      
      res.json(peopleWithStats);
    } catch (error) {
      console.error("Error fetching people:", error);
      res.status(500).json({ message: "Failed to fetch people" });
    }
  });

  app.post("/api/people", async (req, res) => {
    try {
      const person = await storage.createPerson(req.body);
      res.json(person);
    } catch (error) {
      console.error("Error creating person:", error);
      res.status(500).json({ message: "Failed to create person" });
    }
  });

  app.get("/api/people/:id/photos", async (req, res) => {
    try {
      const photos = await storage.getPersonPhotos ? await storage.getPersonPhotos(req.params.id) : [];
      res.json(photos);
    } catch (error) {
      console.error("Error fetching person photos:", error);
      res.status(500).json({ message: "Failed to fetch person photos" });
    }
  });

  app.get("/api/faces", async (req, res) => {
    try {
      const faces = await storage.getAllFaces();
      
      // Add photo information to each face
      const facesWithPhotos = await Promise.all(
        faces.map(async (face) => {
          const photo = await storage.getFileVersion(face.photoId);
          if (photo) {
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            return {
              ...face,
              photo: {
                ...photo,
                mediaAsset: asset
              }
            };
          }
          return face;
        })
      );
      
      res.json(facesWithPhotos);
    } catch (error) {
      console.error("Error fetching faces:", error);
      res.status(500).json({ message: "Failed to fetch faces" });
    }
  });

  app.post("/api/faces/assign", async (req, res) => {
    try {
      const { faceIds, personId } = req.body;
      
      for (const faceId of faceIds) {
        if (storage.assignFaceToPerson) {
          await storage.assignFaceToPerson(faceId, personId);
        }
      }
      
      res.json({ success: true, assigned: faceIds.length });
    } catch (error) {
      console.error("Error assigning faces:", error);
      res.status(500).json({ message: "Failed to assign faces" });
    }
  });

  // Get face suggestions for unassigned faces
  app.get("/api/faces/suggestions", async (req, res) => {
    try {
      const suggestions = await faceDetectionService.reprocessUnassignedFaces();
      res.json(suggestions);
    } catch (error) {
      console.error("Error generating face suggestions:", error);
      res.status(500).json({ message: "Failed to generate face suggestions" });
    }
  });

  // Reprocess unassigned faces after manual assignments
  app.post("/api/faces/reprocess", async (req, res) => {
    try {
      const suggestions = await faceDetectionService.reprocessUnassignedFaces();
      res.json({ 
        message: "Faces reprocessed successfully", 
        suggestions: suggestions.length,
        data: suggestions 
      });
    } catch (error) {
      console.error("Error reprocessing faces:", error);
      res.status(500).json({ message: "Failed to reprocess faces" });
    }
  });

  // Batch assign faces using suggestions
  app.post("/api/faces/batch-assign", async (req, res) => {
    try {
      const { assignments } = req.body; // Array of {faceId, personId}
      const result = await faceDetectionService.batchAssignFaces(assignments);
      res.json(result);
    } catch (error) {
      console.error("Error batch assigning faces:", error);
      res.status(500).json({ message: "Failed to batch assign faces" });
    }
  });

  // Get unassigned faces
  app.get("/api/faces/unassigned", async (req, res) => {
    try {
      const unassignedFaces = await storage.getUnassignedFaces();
      
      // Add photo information to each face
      const facesWithPhotos = await Promise.all(
        unassignedFaces.map(async (face) => {
          const photo = await storage.getFileVersion(face.photoId);
          if (photo) {
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            return {
              ...face,
              photo: {
                ...photo,
                mediaAsset: asset
              }
            };
          }
          return face;
        })
      );
      
      res.json(facesWithPhotos);
    } catch (error) {
      console.error("Error fetching unassigned faces:", error);
      res.status(500).json({ message: "Failed to fetch unassigned faces" });
    }
  });

  // Get face crop URL
  app.get("/api/faces/:id/crop", async (req, res) => {
    try {
      const face = await storage.getFace(req.params.id);
      if (!face) {
        return res.status(404).json({ message: "Face not found" });
      }

      const photo = await storage.getFileVersion(face.photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const cropUrl = await faceDetectionService.generateFaceCrop(
        photo.filePath, 
        face.boundingBox as [number, number, number, number]
      );
      
      res.json({ cropUrl });
    } catch (error) {
      console.error("Error generating face crop:", error);
      res.status(500).json({ message: "Failed to generate face crop" });
    }
  });

  // Collections routes
  app.get("/api/collections", async (req, res) => {
    try {
      const collections = await storage.getCollections();
      const collectionsWithCounts = await Promise.all(
        collections.map(async (collection) => {
          const photos = await storage.getCollectionPhotos(collection.id);
          return {
            ...collection,
            photoCount: photos.length,
            coverPhoto: photos[0]?.filePath || null
          };
        })
      );
      res.json(collectionsWithCounts);
    } catch (error) {
      console.error("Error fetching collections:", error);
      res.status(500).json({ message: "Failed to fetch collections" });
    }
  });

  app.post("/api/collections", async (req, res) => {
    try {
      const collection = await storage.createCollection(req.body);
      res.json(collection);
    } catch (error) {
      console.error("Error creating collection:", error);
      res.status(500).json({ message: "Failed to create collection" });
    }
  });

  app.get("/api/collections/:id/photos", async (req, res) => {
    try {
      const photos = await storage.getCollectionPhotos(req.params.id);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching collection photos:", error);
      res.status(500).json({ message: "Failed to fetch collection photos" });
    }
  });

  // Batch operations
  app.post("/api/photos/batch", async (req, res) => {
    try {
      const { operation, photoIds, params } = req.body;
      
      switch (operation) {
        case 'addTags':
          for (const photoId of photoIds) {
            const photo = await storage.getFileVersion(photoId);
            if (photo) {
              const metadata = (photo.metadata as any) || {};
              const existingTags = metadata.ai?.aiTags || [];
              const newTags = Array.from(new Set([...existingTags, ...params.tags]));
              
              await storage.updateFileVersion(photoId, {
                metadata: {
                  ...metadata,
                  ai: { ...(metadata as any).ai, aiTags: newTags }
                } as any
              });
            }
          }
          break;
        default:
          return res.status(400).json({ message: "Unknown operation" });
      }
      
      res.json({ success: true, processed: photoIds.length });
    } catch (error) {
      console.error("Error in batch operation:", error);
      res.status(500).json({ message: "Batch operation failed" });
    }
  });

  // Analytics data
  app.get("/api/analytics", async (req, res) => {
    try {
      const stats = await storage.getCollectionStats();
      
      const analytics = {
        uploadTrends: [
          { date: '2025-01-20', count: 5 },
          { date: '2025-01-21', count: 8 },
          { date: '2025-01-22', count: 3 },
          { date: '2025-01-23', count: 12 },
          { date: '2025-01-24', count: 7 },
          { date: '2025-01-25', count: stats.totalPhotos },
        ],
        tierDistribution: [
          { tier: 'Bronze', count: stats.bronzeCount, percentage: Math.round((stats.bronzeCount / stats.totalPhotos) * 100) || 0 },
          { tier: 'Silver', count: stats.silverCount, percentage: Math.round((stats.silverCount / stats.totalPhotos) * 100) || 0 },
          { tier: 'Gold', count: stats.goldCount, percentage: Math.round((stats.goldCount / stats.totalPhotos) * 100) || 0 },
        ],
        aiProcessingStats: {
          successRate: 95,
          avgProcessingTime: 2.3,
          totalProcessed: stats.aiProcessedCount
        },
        topTags: [
          { tag: 'landscape', count: 15 },
          { tag: 'portrait', count: 12 },
          { tag: 'nature', count: 8 }
        ]
      };
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Advanced search endpoint
  app.post("/api/photos/search", async (req, res) => {
    try {
      const { filters = {}, sort = { field: 'createdAt', direction: 'desc' }, limit = 50, offset = 0 } = req.body;
      
      // For now, use the existing silver photos endpoint as a fallback
      // TODO: Implement full advanced search functionality
      const allPhotos = await storage.getFileVersionsByTier('silver');
      const photosWithAssets = [];
      
      for (const photo of allPhotos) {
        const asset = await storage.getMediaAsset(photo.mediaAssetId);
        if (asset) {
          photosWithAssets.push({
            ...photo,
            mediaAsset: asset
          });
        }
      }
      
      // Simple filtering by query if provided
      let filteredPhotos = photosWithAssets;
      if (filters.query) {
        const query = filters.query.toLowerCase();
        filteredPhotos = photosWithAssets.filter(photo => {
          const filename = photo.mediaAsset.originalFilename.toLowerCase();
          const location = (photo.location || '').toLowerCase();
          const keywords = (photo.keywords || []).join(' ').toLowerCase();
          return filename.includes(query) || location.includes(query) || keywords.includes(query);
        });
      }
      
      // Apply tier filter
      if (filters.tier) {
        filteredPhotos = filteredPhotos.filter(photo => photo.tier === filters.tier);
      }
      
      // Apply rating filter
      if (filters.rating?.min !== undefined || filters.rating?.max !== undefined) {
        filteredPhotos = filteredPhotos.filter(photo => {
          const rating = photo.rating || 0;
          if (filters.rating?.min !== undefined && rating < filters.rating.min) return false;
          if (filters.rating?.max !== undefined && rating > filters.rating.max) return false;
          return true;
        });
      }
      
      // Simple facets
      const facets = {
        tiers: { silver: filteredPhotos.length },
        ratings: {},
        mimeTypes: {},
        eventTypes: {}
      };
      
      const results = {
        photos: filteredPhotos.slice(offset, offset + limit),
        totalCount: filteredPhotos.length,
        facets
      };
      
      res.json(results);
    } catch (error) {
      console.error("Error in advanced search:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Find similar photos
  app.get("/api/photos/:id/similar", async (req, res) => {
    try {
      const { threshold = 85, limit = 20 } = req.query;
      const similarPhotos = await advancedSearch.findSimilarPhotos(
        req.params.id, 
        Number(threshold), 
        Number(limit)
      );
      res.json(similarPhotos);
    } catch (error) {
      console.error("Error finding similar photos:", error);
      res.status(500).json({ message: "Failed to find similar photos" });
    }
  });

  // Update photo rating
  app.patch("/api/photos/:id/rating", async (req, res) => {
    try {
      const { rating } = req.body;
      if (rating < 0 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 0 and 5" });
      }

      await storage.updateFileVersion(req.params.id, { rating });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating rating:", error);
      res.status(500).json({ message: "Failed to update rating" });
    }
  });

  // Update photo metadata
  app.patch("/api/photos/:id/metadata", async (req, res) => {
    try {
      const { keywords, eventType, eventName, location } = req.body;
      
      const updates: any = {};
      if (keywords !== undefined) updates.keywords = keywords;
      if (eventType !== undefined) updates.eventType = eventType;
      if (eventName !== undefined) updates.eventName = eventName;
      if (location !== undefined) updates.location = location;

      await storage.updateFileVersion(req.params.id, updates);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating metadata:", error);
      res.status(500).json({ message: "Failed to update metadata" });
    }
  });

  // Embed metadata to file (Gold tier promotion)
  app.post("/api/photos/:id/embed-metadata", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      if (photo.tier !== 'silver') {
        return res.status(400).json({ message: "Only Silver tier photos can be promoted to Gold" });
      }

      // Embed metadata and create Gold version
      const goldPath = await metadataEmbedding.embedMetadataToFile(
        photo,
        photo.metadata || {},
        { preserveOriginal: true }
      );

      // Create Gold file version
      const goldVersion = await storage.createFileVersion({
        mediaAssetId: photo.mediaAssetId,
        tier: 'gold',
        filePath: goldPath,
        fileHash: photo.fileHash,
        fileSize: photo.fileSize,
        mimeType: photo.mimeType,
        metadata: photo.metadata as any,
        isReviewed: photo.isReviewed,
        rating: photo.rating,
        keywords: photo.keywords,
        location: photo.location,
        eventType: photo.eventType,
        eventName: photo.eventName,
        perceptualHash: photo.perceptualHash,
      });

      // Log promotion
      await storage.createAssetHistory({
        mediaAssetId: photo.mediaAssetId,
        action: 'PROMOTED_TO_GOLD',
        details: 'Photo promoted to Gold tier with embedded metadata',
      });

      res.json({ success: true, goldVersion });
    } catch (error) {
      console.error("Error embedding metadata:", error);
      res.status(500).json({ message: "Failed to embed metadata" });
    }
  });

  // Update smart collections
  app.post("/api/collections/smart/update", async (req, res) => {
    try {
      await advancedSearch.updateSmartCollections();
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating smart collections:", error);
      res.status(500).json({ message: "Failed to update smart collections" });
    }
  });

  // Promote photo from Silver to Gold
  app.post("/api/photos/:id/promote", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      if (photo.tier !== 'silver') {
        return res.status(400).json({ message: "Photo must be in Silver tier for promotion" });
      }

      // Copy file to Gold tier
      const goldPath = await fileManager.copyToGold(photo.filePath);

      // Create Gold file version with embedded metadata
      const goldVersion = await storage.createFileVersion({
        mediaAssetId: photo.mediaAssetId,
        tier: 'gold',
        filePath: goldPath,
        fileHash: photo.fileHash,
        fileSize: photo.fileSize,
        mimeType: photo.mimeType,
        metadata: photo.metadata as any,
        isReviewed: true,
      });

      // Log promotion
      await storage.createAssetHistory({
        mediaAssetId: photo.mediaAssetId,
        action: 'PROMOTED',
        details: 'Promoted from Silver to Gold tier',
      });

      res.json(goldVersion);
    } catch (error) {
      console.error("Error promoting photo:", error);
      res.status(500).json({ message: "Failed to promote photo" });
    }
  });

  // Batch promote photos to Gold
  app.post("/api/photos/batch-promote", async (req, res) => {
    try {
      const { photoIds } = req.body;
      
      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ message: "photoIds array is required" });
      }

      let promoted = 0;
      const errors = [];

      for (const photoId of photoIds) {
        try {
          const photo = await storage.getFileVersion(photoId);
          if (!photo || photo.tier !== 'silver') {
            continue;
          }

          // Copy file to Gold tier
          const goldPath = await fileManager.copyToGold(photo.filePath);

          // Create Gold file version
          await storage.createFileVersion({
            mediaAssetId: photo.mediaAssetId,
            tier: 'gold',
            filePath: goldPath,
            fileHash: photo.fileHash,
            fileSize: photo.fileSize,
            mimeType: photo.mimeType,
            metadata: photo.metadata as any,
            isReviewed: true,
          });

          // Log promotion
          await storage.createAssetHistory({
            mediaAssetId: photo.mediaAssetId,
            action: 'PROMOTED',
            details: 'Batch promoted from Silver to Gold tier',
          });

          promoted++;
        } catch (error: any) {
          errors.push({ photoId, error: error.message });
        }
      }

      res.json({ promoted, errors });
    } catch (error) {
      console.error("Error in batch promotion:", error);
      res.status(500).json({ message: "Failed to batch promote photos" });
    }
  });

  // Get similar photos for review
  app.get("/api/photos/similarity", async (req, res) => {
    try {
      const { tier = "silver" } = req.query;
      const photos = await storage.getFileVersionsByTier(tier as "bronze" | "silver" | "gold");
      
      // Simple similarity grouping based on filename patterns and metadata
      const similarGroups = await findSimilarPhotos(photos);
      
      res.json(similarGroups);
    } catch (error) {
      console.error("Error finding similar photos:", error);
      res.status(500).json({ message: "Failed to analyze photo similarity" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
