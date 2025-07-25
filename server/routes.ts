import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { storage } from "./storage";
import { aiService } from "./services/ai";
import { fileManager } from "./services/fileManager";
import { insertMediaAssetSchema, insertFileVersionSchema, insertAssetHistorySchema } from "@shared/schema";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/tiff', 'video/mp4', 'video/mov', 'video/avi'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
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
      const combinedMetadata = {
        ...photo.metadata,
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
      const filePath = req.params[0];
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

  const httpServer = createServer(app);
  return httpServer;
}
