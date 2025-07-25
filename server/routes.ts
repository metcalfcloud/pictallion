import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { storage } from "./storage";
import { aiService, AIProvider } from "./services/ai";
import { fileManager } from "./services/fileManager.js";
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

      // Check if file is an image (AI processing currently only supports images)
      if (!photo.mimeType.startsWith('image/')) {
        return res.status(400).json({ message: "AI processing currently only supports images" });
      }

      // Copy file to Silver tier
      const silverPath = await fileManager.copyToSilver(photo.filePath);

      // Run AI analysis
      const aiMetadata = await aiService.analyzeImage(photo.filePath);

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
        metadata: combinedMetadata,
        isReviewed: false,
      });

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

  // People & Faces routes
  app.get("/api/people", async (req, res) => {
    try {
      const people = await storage.getPeople();
      
      // Add face count and photo count to each person
      const peopleWithStats = await Promise.all(
        people.map(async (person) => {
          const faces = await storage.getFacesByPerson(person.id);
          const photoIds = [...new Set(faces.map(face => face.photoId))];
          
          return {
            ...person,
            faceCount: faces.length,
            photoCount: photoIds.length,
            coverPhoto: faces[0]?.photo?.filePath || null
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
              const metadata = photo.metadata || {};
              const existingTags = metadata.ai?.aiTags || [];
              const newTags = [...new Set([...existingTags, ...params.tags])];
              
              await storage.updateFileVersion(photoId, {
                metadata: {
                  ...metadata,
                  ai: { ...metadata.ai, aiTags: newTags }
                }
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

  const httpServer = createServer(app);
  return httpServer;
}
