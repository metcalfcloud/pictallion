import type { Express } from "express";
import express from "express";
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
import { burstPhotoService } from "./services/burstPhotoDetection";
import { generateSilverFilename } from "./services/aiNaming";
import { eventDetectionService } from "./services/eventDetection";
import { insertMediaAssetSchema, insertFileVersionSchema, insertAssetHistorySchema, type Face, type Person } from "@shared/schema";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { promptManager } from "./services/promptManager";
import locationRoutes from "./routes/locations";
import { logger } from "./utils/logger";

// Helper function to calculate bounding box overlap (Intersection over Union)
function calculateBoundingBoxOverlap(
  box1: [number, number, number, number],
  box2: [number, number, number, number]
): number {
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;

  // Calculate overlap area
  const overlapX = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2));
  const overlapY = Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2));
  const overlapArea = overlapX * overlapY;

  // Calculate union area
  const area1 = w1 * h1;
  const area2 = w2 * h2;
  const unionArea = area1 + area2 - overlapArea;

  // Return intersection over union (IoU)
  return unionArea > 0 ? overlapArea / unionArea : 0;
}

interface EnhancedFace extends Face {
  person?: Person;
  faceCropUrl?: string | null;
  ageInPhoto?: number | null;
}

function extractPhotoDate(photo: any): Date | undefined {
  try {

    if (photo.metadata?.exif) {
      const exif = photo.metadata.exif;

      // Try DateTimeOriginal first (most accurate)
      if (exif.dateTimeOriginal) {
        const date = new Date(exif.dateTimeOriginal);
        if (!isNaN(date.getTime())) {
          // Using EXIF DateTimeOriginal
          return date;
        }
      }

      if (exif.createDate) {
        const date = new Date(exif.createDate);
        if (!isNaN(date.getTime())) {
          // Using EXIF CreateDate
          return date;
        }
      }

      if (exif.dateTime) {
        const date = new Date(exif.dateTime);
        if (!isNaN(date.getTime())) {
          // Using EXIF DateTime
          return date;
        }
      }
    }

    // Try to extract from filename if it has timestamp format (YYYYMMDD_HHMMSS)
    const filename = photo.mediaAsset?.originalFilename || '';
    const timestampMatch = filename.match(/^(\d{8})_(\d{6})/);
    if (timestampMatch) {
      const dateStr = timestampMatch[1]; // YYYYMMDD
      const timeStr = timestampMatch[2]; // HHMMSS
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(0, 2));
      const minute = parseInt(timeStr.substring(2, 4));
      const second = parseInt(timeStr.substring(4, 6));

      const extractedDate = new Date(year, month, day, hour, minute, second);
      if (!isNaN(extractedDate.getTime())) {
        // Using filename timestamp
        return extractedDate;
      }
    }

    if (photo.createdAt) {
      const date = new Date(photo.createdAt);
      if (!isNaN(date.getTime())) {
        // Using createdAt
        return date;
      }
    }

    console.log('No valid date found, returning undefined');
    return undefined;
  } catch (error) {
    console.error('Error extracting photo date:', error);
    return undefined;
  }
}

// Similarity detection function
async function findSimilarPhotos(photos: any[]): Promise<any[]> {
  const similarGroups = [];
  const processed = new Set<string>();

  for (let i = 0; i < photos.length; i++) {
    if (processed.has(photos[i].id)) continue;

    const currentPhoto = photos[i];
    const similarPhotos = [currentPhoto];
    processed.add(currentPhoto.id);

    // 1. Similar filenames (burst photos, sequence shots)
    // 3. Same time period (within 5 minutes)
    for (let j = i + 1; j < photos.length; j++) {
      if (processed.has(photos[j].id)) continue;

      const comparePhoto = photos[j];
      let similarityScore = 0;

      // Check filename similarity (burst photos often have similar names)
      const currentName = currentPhoto.mediaAsset.originalFilename.toLowerCase();
      const compareName = comparePhoto.mediaAsset.originalFilename.toLowerCase();

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

    if (similarPhotos.length > 1) {
      // Find the "best" photo in the group (highest AI confidence or most recent)
      const suggested = similarPhotos.reduce((best, current) => {
        const bestConfidence = best.metadata?.ai?.aiConfidenceScores?.tags || 0;
        const currentConfidence = current.metadata?.ai?.aiConfidenceScores?.tags || 0;

        if (currentConfidence > bestConfidence) return current;
        if (currentConfidence === bestConfidence) {
          return new Date(current.createdAt) > new Date(best.createdAt) ? current : best;
        }
        return best;
      });

      similarGroups.push({
        suggested,
        similar: similarPhotos.filter(p => p.id !== suggested.id)
      });
    }
  }

  return similarGroups;
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/tiff', 'video/mp4', 'video/mov', 'video/avi'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  await promptManager.initialize();

  app.use("/api/files", express.static(path.join(process.cwd(), "data")));
  // Serve temporary files (face crops)  
  app.use("/api/files/temp", express.static(path.join(process.cwd(), "uploads", "temp")));

  await fileManager.initializeDirectories();

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

  app.get("/api/tags/library", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT tag, usage_count, created_at 
        FROM global_tag_library 
        ORDER BY usage_count DESC, tag ASC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching tag library:", error);
      res.status(500).json({ message: "Failed to fetch tag library" });
    }
  });

  app.get("/api/faces/photo/:photoId", async (req, res) => {
    try {
      const faces = await storage.getFacesByPhoto(req.params.photoId);

      const photo = await storage.getFileVersion(req.params.photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const enhancedFaces: EnhancedFace[] = await Promise.all(
        faces.map(async (face) => {
          let enhancedFace: EnhancedFace = { ...face };

          if (face.personId) {
            const person = await storage.getPerson(face.personId);
            enhancedFace.person = person;

            if (person?.birthdate) {
              const photoDate = extractPhotoDate(photo);
              if (photoDate) {
                enhancedFace.ageInPhoto = eventDetectionService.calculateAgeInPhoto(
                  new Date(person.birthdate), 
                  photoDate
                );
              }
            }
          }

          // Generate face crop URL
          try {
            const faceCropUrl = await faceDetectionService.generateFaceCrop(
              photo.filePath, 
              face.boundingBox as [number, number, number, number]
            );
            console.log(`Face crop generated for face ${face.id}: ${faceCropUrl}`);
            enhancedFace.faceCropUrl = faceCropUrl || null;
          } catch (error) {
            console.error('Failed to generate face crop for face:', face.id, error);
            enhancedFace.faceCropUrl = null;
          }

          return enhancedFace;
        })
      );

      res.json(enhancedFaces);
    } catch (error) {
      console.error("Error fetching faces for photo:", error);
      res.status(500).json({ message: "Failed to fetch faces for photo" });
    }
  });

  // Get photo history
  app.get("/api/photos/:id/history", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const history = await storage.getAssetHistory(photo.mediaAssetId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching photo history:", error);
      res.status(500).json({ message: "Failed to fetch photo history" });
    }
  });

  // Get filename preview for promotion
  app.get("/api/photos/:id/filename-preview", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const namingPatternSetting = await storage.getSettingByKey('gold_naming_pattern');
      const customPatternSetting = await storage.getSettingByKey('custom_naming_pattern');
      const namingPattern = namingPatternSetting?.value || 'datetime';
      const customPattern = customPatternSetting?.value || '';

      // Get media asset for filename generation
      const mediaAsset = await storage.getMediaAsset(photo.mediaAssetId);
      if (!mediaAsset) {
        return res.status(404).json({ message: "Media asset not found" });
      }

      const namingContext = {
        originalFilename: mediaAsset.originalFilename,
        createdAt: photo.createdAt,
        metadata: photo.metadata
      };

      const finalPattern = namingPattern === 'custom' ? customPattern : namingPattern;
      const previewFilename = await generateSilverFilename(namingContext, finalPattern);

      res.json({ filename: previewFilename });
    } catch (error) {
      console.error("Error generating filename preview:", error);
      res.status(500).json({ message: "Failed to generate filename preview" });
    }
  });

  app.get("/api/photos/burst-analysis", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;

      const recentPhotos = await storage.getRecentPhotos(limit);

      // Group photos by time clusters (photos taken within 5 seconds of each other)
      const burstGroups = [];
      const timeThreshold = 5000; // 5 seconds in milliseconds

      const sortedPhotos = recentPhotos.sort((a, b) => {
        const aTime = new Date((a.metadata as any)?.exif?.dateTime || a.createdAt).getTime();
        const bTime = new Date((b.metadata as any)?.exif?.dateTime || b.createdAt).getTime();
        return aTime - bTime;
      });

      let currentGroup: any[] = [];
      for (let i = 0; i < sortedPhotos.length; i++) {
        const photo = sortedPhotos[i];
        const photoTime = new Date((photo.metadata as any)?.exif?.dateTime || photo.createdAt).getTime();

        if (currentGroup.length === 0) {
          currentGroup.push(photo);
        } else {
          const lastPhotoTime = new Date(
            (currentGroup[currentGroup.length - 1].metadata as any)?.exif?.dateTime || 
            currentGroup[currentGroup.length - 1].createdAt
          ).getTime();

          if (photoTime - lastPhotoTime <= timeThreshold) {
            currentGroup.push(photo);
          } else {
            if (currentGroup.length >= 3) { // Consider 3+ photos as a burst
              burstGroups.push({
              });
            }
            currentGroup = [photo];
          }
        }
      }

      // Don't forget the last group
      if (currentGroup.length >= 3) {
        burstGroups.push({
        });
      }

      res.json(burstGroups);
    } catch (error) {
      console.error("Error analyzing burst photos:", error);
      res.status(500).json({ message: "Failed to analyze burst photos" });
    }
  });

  app.post("/api/tags/library", async (req, res) => {
    try {
      const { tags } = req.body;

      for (const tag of tags) {
        await db.execute(sql`
          INSERT INTO global_tag_library (tag, usage_count, created_at)
          VALUES (${tag}, 1, NOW())
          ON CONFLICT (tag) 
          DO UPDATE SET usage_count = global_tag_library.usage_count + 1
        `);
      }

      res.json({ message: "Tags added to library" });
    } catch (error) {
      console.error("Error adding tags to library:", error);
      res.status(500).json({ message: "Failed to add tags to library" });
    }
  });

  app.get("/api/photos", async (req, res) => {
    try {
      const tier = req.query.tier as "silver" | "gold" | "unprocessed" | "all_versions" | undefined;
      const showAllVersions = req.query.showAllVersions === 'true';

      if (tier === 'unprocessed') {
        // Get silver photos that haven't been promoted to gold
        const allAssets = await storage.getAllMediaAssets();
        const unprocessedPhotos = [];

        for (const asset of allAssets) {
          const versions = await storage.getFileVersionsByAsset(asset.id);
          const hasSilver = versions.some(v => v.tier === 'silver');
          const hasGold = versions.some(v => v.tier === 'gold');

          if (hasSilver && !hasGold) {
            const silverVersion = versions.find(v => v.tier === 'silver');
            if (silverVersion) {
              const enhancedAsset = {
                ...asset,
              };
              unprocessedPhotos.push({ ...silverVersion, mediaAsset: enhancedAsset });
            }
          }
        }

        res.json(unprocessedPhotos);
      } else if (tier === 'all_versions') {
        // Show all versions of all photos (admin view)
        const allVersions = await storage.getAllFileVersions();
        const photosWithAssets = await Promise.all(
          allVersions.map(async (photo) => {
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            const enhancedAsset = {
              ...asset,
            };
            return { ...photo, mediaAsset: enhancedAsset };
          })
        );
        res.json(photosWithAssets);
      } else if (tier) {
        // Show specific tier, but filter out superseded versions unless explicitly requested
        const photos = await storage.getFileVersionsByTier(tier);
        let filteredPhotos = photos;

        if (!showAllVersions) {
          const photosWithSuperseded = await Promise.all(
            photos.map(async (photo) => {
              const versions = await storage.getFileVersionsByAsset(photo.mediaAssetId);
              const hasSilver = versions.some(v => v.tier === 'silver');
              const hasGold = versions.some(v => v.tier === 'gold');

              let isSuperseded = false;
              if (photo.tier === 'silver' && hasGold) {
                isSuperseded = true;
              }

              return { ...photo, isSuperseded };
            })
          );

          filteredPhotos = photosWithSuperseded.filter(photo => !photo.isSuperseded);
        }

        const photosWithAssets = await Promise.all(
          filteredPhotos.map(async (photo) => {
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            const enhancedAsset = {
              ...asset,
            };
            return { ...photo, mediaAsset: enhancedAsset };
          })
        );
        res.json(photosWithAssets);
      } else {
        const allAssets = await storage.getAllMediaAssets();
        const highestTierPhotos = [];

        for (const asset of allAssets) {
          const versions = await storage.getFileVersionsByAsset(asset.id);

          // Find highest tier version (Gold > Silver)
          const goldVersion = versions.find(v => v.tier === 'gold');
          const silverVersion = versions.find(v => v.tier === 'silver');

          const highestVersion = goldVersion || silverVersion;
          if (highestVersion) {
            const enhancedAsset = {
              ...asset,
            };
            highestTierPhotos.push({ ...highestVersion, mediaAsset: enhancedAsset });
          }
        }

        highestTierPhotos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.json(highestTierPhotos.slice(0, 100)); // Limit to 100 for performance
      }
    } catch (error) {
      console.error("Error fetching photos:", error);
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  app.get("/api/photos/:id", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const asset = await storage.getMediaAsset(photo.mediaAssetId);
      const history = await storage.getAssetHistory(photo.mediaAssetId);

      res.json({
        photo: {
          mediaAsset: asset
        },
        history
      });
    } catch (error) {
      console.error("Error fetching photo details:", error);
      res.status(500).json({ message: "Failed to fetch photo details" });
    }
  });

  // Upload photos with enhanced duplicate detection
  app.post("/api/upload", upload.array('files'), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const results = [];
      const conflicts = [];

      console.log(`Processing ${files.length} uploaded files...`);

      for (const file of files) {
        console.log(`Starting processing for file: ${file.originalname}, size: ${file.size} bytes`);

        try {
          // Calculate file hash for duplicate detection
          const fileBuffer = await fs.readFile(file.path);
          const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

          // Check for duplicates using enhanced detection
          const { enhancedDuplicateDetectionService } = await import("./services/enhancedDuplicateDetection");
          const duplicateConflicts = await enhancedDuplicateDetectionService.checkForDuplicates(
            file.path, 
            file.originalname, 
            fileHash
          );

          // Handle auto-skip for MD5 duplicates (empty conflicts array means auto-skip)
          if (duplicateConflicts.length === 0) {
            // Check if this was an auto-skip (MD5 duplicate detected)
            const exactDuplicate = await storage.getFileByHash(fileHash);
            if (exactDuplicate) {
              console.log(`Auto-skipping MD5 identical file: ${file.originalname}`);
              results.push({
                status: 'skipped',
                filename: file.originalname,
                reason: 'MD5 duplicate - exact same file already exists',
                duplicateId: exactDuplicate.id
              });
              continue;
            }
          }

          if (duplicateConflicts.length > 0) {

            conflicts.push(...duplicateConflicts.map(conflict => ({
              ...conflict,
            })));

            results.push({
              status: 'conflict',
              filename: file.originalname,
              conflicts: duplicateConflicts
            });
            continue;
          }

          // No conflicts - proceed with normal upload
          const mediaAsset = await storage.createMediaAsset({
            originalFilename: file.originalname
          });

          // Process file directly to Silver tier with basic processing only
          const silverPath = await fileManager.processToSilver(file.path, file.originalname);

          // Extract basic EXIF metadata (no AI processing)
          const metadata = await fileManager.extractMetadata(silverPath);

          // Create Silver file version with basic metadata only
          const fileVersion = await storage.createFileVersion({
            mediaAssetId: mediaAsset.id,
            tier: "silver" as const,
            filePath: silverPath,
            fileHash,
            fileSize: (await fs.stat(silverPath)).size,
            mimeType: file.mimetype,
            metadata: metadata
          });

          if (file.mimetype.startsWith('image/')) {
            // Run face detection
            console.log('Running face detection on uploaded photo...');
            const faceDetectionResult = await faceDetectionService.detectFaces(file.path);
            const detectedFaces = faceDetectionResult.faces;

            const currentMetadata = fileVersion.metadata || {};
            const updatedMetadata = {
              ...currentMetadata,
              ...faceDetectionResult.metadata
            };

            await storage.updateFileVersion(fileVersion.id, { metadata: updatedMetadata });

            for (const face of detectedFaces) {
              await storage.createFace({
                photoId: fileVersion.id,
                boundingBox: face.bbox || face.boundingBox || [0, 0, 100, 100],
                confidence: Math.round((face.confidence || 50) * 100),
                embedding: face.embedding
              });
            }
          }

          // Log ingestion
          await storage.createAssetHistory({
            mediaAssetId: mediaAsset.id,
            action: 'upload_silver',
            details: `Uploaded ${file.originalname} to Silver tier with face detection`
          });

          console.log(`Successfully uploaded ${file.originalname} to Silver tier with basic processing and face detection. Asset ID: ${mediaAsset.id}`);

          results.push({
            status: 'success',
            filename: file.originalname,
            mediaAssetId: mediaAsset.id,
            fileVersionId: fileVersion.id
          });

        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError);
          results.push({
            status: 'error',
            filename: file.originalname,
            error: fileError instanceof Error ? fileError.message : 'Unknown error'
          });
        }
      }

      console.log(`Upload complete. Results:`, JSON.stringify(results, null, 2));
      res.json({ 
        results,
      });
    } catch (error) {
      console.error("Error in upload endpoint:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  });



  // Update photo metadata
  app.patch("/api/photos/:id/metadata", async (req, res) => {
    try {
      const photoId = req.params.id;
      const updates = req.body;

      const photo = await storage.getFileVersion(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      if (updates.aiTags || updates.aiDescription) {
        const existingMetadata = (photo.metadata as any) || {};
        const updatedMetadata = {
          ...existingMetadata,
          ai: {
            ...(existingMetadata.ai || {}),
            ...(updates.aiTags && { aiTags: updates.aiTags }),
            ...(updates.aiDescription && { longDescription: updates.aiDescription })
          }
        };

        // Remove aiTags and aiDescription from updates and add the metadata
        const { aiTags, aiDescription, ...otherUpdates } = updates;
        const finalUpdates = {
          ...otherUpdates,
          metadata: updatedMetadata
        };

        await storage.updateFileVersion(photoId, finalUpdates);
      } else {
        await storage.updateFileVersion(photoId, updates);
      }

      const updatedPhoto = await storage.getFileVersion(photoId);
      res.json(updatedPhoto);
    } catch (error) {
      console.error("Error updating photo metadata:", error);
      res.status(500).json({ message: "Failed to update metadata" });
    }
  });

  app.get("/api/files/media/:tier/:date/:filename", async (req, res) => {
    try {
      const { tier, date, filename } = req.params;
      const filePath = `${tier}/${date}/${filename}`;
      const fullPath = path.join(process.cwd(), 'data', 'media', filePath);

      // Security check to prevent directory traversal
      if (!fullPath.startsWith(path.join(process.cwd(), 'data'))) {
        return res.status(403).json({ message: "Access denied" });
      }

      try {
        await fs.access(fullPath);

        if (req.query.crop && req.query.face === 'true') {
          const cropParams = (req.query.crop as string).split(',').map(Number);
          if (cropParams.length === 4) {
            res.setHeader('X-Face-Crop', req.query.crop as string);
            res.setHeader('Content-Type', 'image/jpeg');
          }
        }

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

  app.get("/api/ai/config", async (req, res) => {
    try {
      const config = aiService.getConfig();
      const providers = await aiService.getAvailableProviders();

      res.json({
        config,
        providers
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
        providers
      });
    } catch (error) {
      console.error("Test AI providers error:", error);
      res.status(500).json({ error: "Failed to test AI providers" });
    }
  });

  app.post("/api/photos/:id/detect-faces", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      console.log('Testing face detection on photo:', photo.filePath);

      // Run face detection
      const faceDetectionResult = await faceDetectionService.detectFaces(photo.filePath);
      const detectedFaces = faceDetectionResult.faces;

      // Save faces to database if any detected
      const savedFaces = [];
      for (const face of detectedFaces) {
        const savedFace = await storage.createFace({
          photoId: photo.id,
          boundingBox: face.bbox || face.boundingBox || [0, 0, 100, 100],
          confidence: Math.round((face.confidence || 50) * 100),
          embedding: face.embedding
        });
        savedFaces.push(savedFace);
      }

      // Get the media asset separately
      const mediaAsset = await storage.getMediaAsset(photo.mediaAssetId);

      res.json({
        detectedFaces: savedFaces,
        mediaAsset,
        photo
      });
    } catch (error) {
      console.error("Error in face detection test:", error);
      res.status(500).json({ message: "Face detection test failed" });
    }
  });

  app.get("/api/people", async (req, res) => {
    try {
      const people = await storage.getPeople();

      // Add face count and photo count to each person with better error handling
      const peopleWithStats = await Promise.all(
        people.map(async (person) => {
          try {
            const faces = await storage.getFacesByPerson(person.id);
            const photoIds = Array.from(new Set(faces.map(face => face.photoId)));

            let coverPhotoPath = null;
            if (faces.length > 0) {
              let selectedFace = faces[0]; // Default to first face

              if (person.selectedThumbnailFaceId) {
                const thumbnailFace = faces.find(f => f.id === person.selectedThumbnailFaceId);
                if (thumbnailFace) {
                  selectedFace = thumbnailFace;
                }
              }

              try {
                const photo = await storage.getFileVersion(selectedFace.photoId);
                if (photo && selectedFace.boundingBox) {
                  // Generate a face crop for better thumbnail
                  coverPhotoPath = await faceDetectionService.generateFaceCrop(
                    photo.filePath, 
                    selectedFace.boundingBox as [number, number, number, number]
                  );
                }
              } catch (error) {
                console.error('Failed to generate face crop for thumbnail:', error);
                // Don't set coverPhotoPath, leave as null
              }
            }

            return {
              ...person,
            };
          } catch (error) {
            console.error(`Error processing person ${person.id}:`, error);
            return {
              ...person,
            };
          }
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

  app.put("/api/people/:id", async (req, res) => {
    try {
      const person = await storage.updatePerson(req.params.id, req.body);
      if (!person) {
        return res.status(404).json({ message: "Person not found" });
      }
      res.json(person);
    } catch (error) {
      console.error("Error updating person:", error);
      res.status(500).json({ message: "Failed to update person" });
    }
  });

  app.delete("/api/people/:id", async (req, res) => {
    try {
      await storage.deletePerson(req.params.id);
      res.json({ success: true, message: "Person deleted successfully" });
    } catch (error) {
      console.error("Error deleting person:", error);
      res.status(500).json({ message: "Failed to delete person" });
    }
  });

  app.put("/api/people/:id/thumbnail", async (req, res) => {
    try {
      const { faceId } = req.body;

      if (!faceId) {
        return res.status(400).json({ message: "Face ID is required" });
      }

      // Verify the face belongs to this person
      const face = await storage.getFace(faceId);
      if (!face || face.personId !== req.params.id) {
        return res.status(400).json({ message: "Face does not belong to this person" });
      }

      // Update the person's selected thumbnail face ID
      const updatedPerson = await storage.updatePerson(req.params.id, {
      });

      if (!updatedPerson) {
        return res.status(404).json({ message: "Person not found" });
      }

      const photo = await storage.getFileVersion(face.photoId);
      let coverPhotoPath = null;

      if (photo && face.boundingBox) {
        try {
          coverPhotoPath = await faceDetectionService.generateFaceCrop(
            photo.filePath, 
            face.boundingBox as [number, number, number, number]
          );
        } catch (error) {
          console.error('Failed to generate face crop for new thumbnail:', error);
          coverPhotoPath = photo.filePath;
        }
      }

      res.json({ 
      });
    } catch (error) {
      console.error("Error updating person thumbnail:", error);
      res.status(500).json({ message: "Failed to update thumbnail" });
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

  app.get("/api/people/:id/relationships", async (req, res) => {
    try {
      const relationships = await storage.getRelationshipsByPerson(req.params.id);
      res.json(relationships);
    } catch (error) {
      console.error("Error fetching relationships:", error);
      res.status(500).json({ message: "Failed to fetch relationships" });
    }
  });

  app.post("/api/relationships", async (req, res) => {
    try {
      const relationship = await storage.createRelationship(req.body);
      res.json(relationship);
    } catch (error) {
      console.error("Error creating relationship:", error);
      res.status(500).json({ message: "Failed to create relationship" });
    }
  });

  app.put("/api/relationships/:id", async (req, res) => {
    try {
      const relationship = await storage.updateRelationship(req.params.id, req.body);
      res.json(relationship);
    } catch (error) {
      console.error("Error updating relationship:", error);
      res.status(500).json({ message: "Failed to update relationship" });
    }
  });

  app.delete("/api/relationships/:id", async (req, res) => {
    try {
      await storage.deleteRelationship(req.params.id);
      res.json({ success: true, message: "Relationship deleted successfully" });
    } catch (error) {
      console.error("Error deleting relationship:", error);
      res.status(500).json({ message: "Failed to delete relationship" });
    }
  });

  app.get("/api/faces/unassigned", async (req, res) => {
    try {
      const unassignedFaces = await storage.getUnassignedFaces();

      const facesWithPhotos = await Promise.all(
        unassignedFaces.map(async (face) => {
          const photo = await storage.getFileVersion(face.photoId);
          if (photo) {
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            // Generate face crop URL
            let faceCropUrl: string;
            try {
              faceCropUrl = await faceDetectionService.generateFaceCrop(photo.filePath, face.boundingBox as [number, number, number, number]);
            } catch (error) {
              console.error('Failed to generate face crop:', error);
              faceCropUrl = photo.filePath; // Fallback to full image
            }

            return {
              ...face,
              faceCropUrl,
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

  app.get("/api/faces", async (req, res) => {
    try {
      const faces = await storage.getAllFaces();

      const facesWithPhotos = await Promise.all(
        faces.map(async (face) => {
          const photo = await storage.getFileVersion(face.photoId);
          if (photo) {
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            // Generate face crop URL
            let faceCropUrl: string;
            try {
              faceCropUrl = await faceDetectionService.generateFaceCrop(photo.filePath, face.boundingBox as [number, number, number, number]);
            } catch (error) {
              console.error('Failed to generate face crop:', error);
              faceCropUrl = photo.filePath; // Fallback to full image
            }

            let ageInPhoto: number | null = null;
            if (face.personId) {
              const person = await storage.getPerson(face.personId);
              if (person?.birthdate) {
                const photoWithAsset = { ...photo, mediaAsset: asset };
                const photoDate = extractPhotoDate(photoWithAsset);
                if (photoDate) {
                  ageInPhoto = eventDetectionService.calculateAgeInPhoto(
                    new Date(person.birthdate), 
                    photoDate
                  );
                }
              }
            }

            return {
              ...face,
              faceCropUrl,
              ageInPhoto,
              photo: {
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

  app.get('/api/faces/suggestions', async (req, res) => {
    try {
      const unassignedFaces = await storage.getUnassignedFaces();
      console.log(`Found ${unassignedFaces.length} unassigned faces for suggestions`);

      if (unassignedFaces.length === 0) {
        return res.json([]);
      }

      const people = await storage.getPeople();
      console.log(`Found ${people.length} people for matching suggestions`);

      if (people.length === 0) {
        return res.json([]);
      }

      const suggestions = [];

      for (const face of unassignedFaces) {
        if (!face.embedding || !Array.isArray(face.embedding)) {
          console.log(`Skipping face ${face.id} - no embedding available`);
          continue;
        }

        const similarFaces = await faceDetectionService.findSimilarFaces(face.embedding, 0.75);

        if (similarFaces.length === 0) {
          console.log(`No similar faces found for face ${face.id}`);
          continue;
        }

        const personMatches = new Map<string, { count: number; totalSimilarity: number }>();

        for (const similar of similarFaces) {
          if (similar.personId) {
            const existing = personMatches.get(similar.personId) || { count: 0, totalSimilarity: 0 };
            existing.count++;
            existing.totalSimilarity += similar.similarity;
            personMatches.set(similar.personId, existing);
          }
        }

        if (personMatches.size === 0) {
          console.log(`No person matches found for face ${face.id}`);
          continue;
        }

        const faceSuggestions = [];

        for (const [personId, match] of Array.from(personMatches.entries())) {
          const person = people.find((p: any) => p.id === personId);
          if (person) {
            const avgSimilarity = match.totalSimilarity / match.count;
            const confidence = Math.round(avgSimilarity * 100);

            console.log(`Person ${person.name}: avgSimilarity=${avgSimilarity.toFixed(3)}, confidence=${confidence}%, matches=${match.count}`);

            if (confidence >= 75) {
              // Get representative face for this person
              let representativeFaceUrl = '';
              if (person.selectedThumbnailFaceId) {
                // Try to get the face data for the selected thumbnail
                const thumbnailFace = await storage.getFaceById(person.selectedThumbnailFaceId);
                if (thumbnailFace) {
                  // Use a placeholder or construct URL as needed
                  representativeFaceUrl = `/api/faces/${thumbnailFace.id}/crop`;
                }
              }

              faceSuggestions.push({
                personId: personId,
                personName: person.name,
                confidence: confidence,
                representativeFaceUrl: representativeFaceUrl
              });
            }
          }
        }

        if (faceSuggestions.length > 0) {
          // Sort by confidence and take top 3
          faceSuggestions.sort((a, b) => b.confidence - a.confidence);

          suggestions.push({
            faceId: face.id,
            suggestions: faceSuggestions.slice(0, 3)
          });

          console.log(`Created ${faceSuggestions.length} suggestions for face ${face.id}`);
        } else {
          console.log(`No valid suggestions created for face ${face.id} - confidence too low`);
        }
      }

      console.log(`Returning ${suggestions.length} face suggestions total`);
      res.json(suggestions);
    } catch (error) {
      console.error('Failed to get face suggestions:', error);
      res.status(500).json({ error: 'Failed to get face suggestions' });
    }
  });

  app.post("/api/faces/reprocess", async (req, res) => {
    try {
      const suggestions = await faceDetectionService.reprocessUnassignedFaces();
      res.json({ 
        success: true,
        suggestions: suggestions
      });
    } catch (error) {
      console.error("Error reprocessing faces:", error);
      res.status(500).json({ message: "Failed to reprocess faces" });
    }
  });

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

  app.post("/api/faces/:id/ignore", async (req, res) => {
    try {
      await storage.ignoreFace(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error ignoring face:", error);
      res.status(500).json({ message: "Failed to ignore face" });
    }
  });

  app.post("/api/faces/:id/unignore", async (req, res) => {
    try {
      await storage.unignoreFace(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unignoring face:", error);
      res.status(500).json({ message: "Failed to unignore face" });
    }
  });

  app.get("/api/faces/ignored", async (req, res) => {
    try {
      const ignoredFaces = await storage.getIgnoredFaces();
      const facesWithPhotos = await Promise.all(
        ignoredFaces.map(async (face) => {
          const photo = await storage.getFileVersion(face.photoId);
          if (photo) {
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            // Generate face crop URL
            let faceCropUrl: string;
            try {
              faceCropUrl = await faceDetectionService.generateFaceCrop(photo.filePath, face.boundingBox as [number, number, number, number]);
            } catch (error) {
              console.error('Failed to generate face crop:', error);
              faceCropUrl = photo.filePath; // Fallback to full image
            }

            return {
              ...face,
              faceCropUrl,
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
      console.error("Error fetching ignored faces:", error);
      res.status(500).json({ message: "Failed to fetch ignored faces" });
    }
  });

  app.get("/api/faces/unassigned", async (req, res) => {
    try {
      const unassignedFaces = await storage.getUnassignedFaces();

      const facesWithPhotos = await Promise.all(
        unassignedFaces.map(async (face) => {
          const photo = await storage.getFileVersion(face.photoId);
          if (photo) {
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            // Generate face crop URL
            let faceCropUrl: string;
            try {
              faceCropUrl = await faceDetectionService.generateFaceCrop(photo.filePath, face.boundingBox as [number, number, number, number]);
            } catch (error) {
              console.error('Failed to generate face crop:', error);
              faceCropUrl = photo.filePath; // Fallback to full image
            }

            return {
              ...face,
              faceCropUrl,
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
      const face = await storage.getFace(req.params.id);      if (!face) {
        return res.status(404).json({ message: "Face not found" });
      }

      const photo = await storage.getFileVersion(face.photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });


app.get("/api/smart-collections", async (req, res) => {
  try {
    const collections = await storage.getCollections();
    const smartCollections = collections.filter(c => c.isSmartCollection);
    res.json(smartCollections);
  } catch (error) {
    console.error("Failed to get smart collections:", error);
    res.status(500).json({ message: "Failed to retrieve smart collections" });
  }
});

app.post("/api/smart-collections", async (req, res) => {
  try {
    const { name, description, rules } = req.body;

    const collection = await storage.createCollection({
      name,
      description,
    });

    res.json(collection);
  } catch (error) {
    console.error("Failed to create smart collection:", error);
    res.status(500).json({ message: "Failed to create smart collection" });
  }
});

app.patch("/api/smart-collections/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    await storage.updateCollection(id, { isPublic: isActive });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to toggle smart collection:", error);
    res.status(500).json({ message: "Failed to toggle smart collection" });
  }
});

app.post("/api/smart-collections/organize", async (req, res) => {
  try {
    // TODO: Implement smart collection organization
    res.json({ message: "Smart collection organization completed", organized: 0 });
  } catch (error) {
    console.error("Failed to organize photos:", error);
    res.status(500).json({ message: "Failed to organize photos" });
  }
});

app.get("/api/smart-collections/:id/photos", async (req, res) => {
  try {
    const { id } = req.params;

    const photos = await storage.getCollectionPhotos(id);

    res.json(photos);
  } catch (error) {
    console.error("Failed to get collection photos:", error);
    res.status(500).json({ message: "Failed to retrieve collection photos" });
  }
});

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

  app.get("/api/collections", async (req, res) => {
    try {
      const collections = await storage.getCollections();
      const collectionsWithCounts = await Promise.all(
        collections.map(async (collection) => {
          const photos = await storage.getCollectionPhotos(collection.id);
          return {
            ...collection,
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

  app.delete("/api/collections/:id", async (req, res) => {
    try {
      await storage.deleteCollection(req.params.id);
      res.json({ success: true, message: "Collection deleted successfully" });
    } catch (error) {
      console.error("Error deleting collection:", error);
      res.status(500).json({ message: "Failed to delete collection" });
    }
  });

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
                ...photo,
                metadata: {
                  ...metadata,
                  ai: {
                    ...metadata.ai,
                    aiTags: newTags
                  }
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
        uploadActivity: [
          { date: '2025-01-20', count: 5 },
          { date: '2025-01-21', count: 8 },
          { date: '2025-01-22', count: 3 },
          { date: '2025-01-23', count: 12 },
          { date: '2025-01-24', count: 7 },
          { date: '2025-01-25', count: stats.totalPhotos },
        ],
        tierDistribution: [
          { tier: 'Silver', count: stats.silverCount, percentage: Math.round((stats.silverCount / stats.totalPhotos) * 100) || 0 },
          { tier: 'Gold', count: stats.goldCount, percentage: Math.round((stats.goldCount / stats.totalPhotos) * 100) || 0 },
        ],
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





  app.get("/api/burst/analyze", async (req, res) => {
    try {
      const allPhotos = await storage.getAllFileVersions();
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

      const analysis = await burstPhotoService.analyzeBurstPhotos(photosWithAssets);
      res.json(analysis);
    } catch (error) {
      console.error("Burst analysis failed:", error);
      res.status(500).json({ error: "Failed to analyze burst photos" });
    }
  });

  app.post("/api/burst/process", async (req, res) => {
    try {
      const { selections, ungroupedPhotos } = req.body;

      if (!Array.isArray(selections)) {
        return res.status(400).json({ error: "Selections must be an array" });
      }

      let processed = 0;
      let promoted = 0;
      const errors: string[] = [];

      for (const selection of selections) {
        const { groupId, selectedPhotoIds } = selection;

        if (!Array.isArray(selectedPhotoIds)) {
          continue;
        }

        for (const photoId of selectedPhotoIds) {
          try {
            const photo = await storage.getFileVersion(photoId);
            if (!photo) {
              continue;
            }

            // For silver photos: only update metadata (keep files immutable)
            if (photo.tier === 'silver') {
              if (!photo.mimeType.startsWith('image/')) {
                continue;              }

              // Run AI analysis for metadata update only
              const aiMetadata = await aiService.analyzeImage(photo.filePath, "openai");
              const enhancedMetadata = await aiService.enhanceMetadataWithShortDescription(aiMetadata, photo.filePath);

              const faceDetectionResult = await faceDetectionService.detectFaces(photo.filePath);
              const detectedFaces = faceDetectionResult.faces;

              // Get media asset for event detection
              const mediaAsset = await storage.getMediaAsset(photo.mediaAssetId);
              const photoWithAsset = { ...photo, mediaAsset: mediaAsset };
              const photoDate = extractPhotoDate(photoWithAsset);

              let eventType: string | undefined;
              let eventName: string | undefined;
              if (photoDate) {
                try {
                  const detectedEvents = await eventDetectionService.detectEvents(photoDate);
                  if (detectedEvents.length > 0) {
                    const bestEvent = detectedEvents.reduce((max, event) => 
                      event.confidence > max.confidence ? event : max
                    );
                    if (bestEvent.confidence >= 80) {
                      eventType = bestEvent.eventType;
                      eventName = bestEvent.eventName;
                    }
                  }
                } catch (error) {
                  console.error('Event detection failed for photo:', photoId, error);
                }
              }

              // Update metadata only (no file operations)
              const combinedMetadata = {
                ...(photo.metadata || {}),
              };

              await storage.updateFileVersion(photo.id, {
                metadata: combinedMetadata,
                processingState: "processed" as const
              });

              await storage.deleteFacesByPhoto(photo.id);
              for (const face of detectedFaces) {
                await storage.createFace({
                  photoId: photo.id,
                  boundingBox: face.bbox || face.boundingBox || [0, 0, 100, 100],
                  confidence: Math.round((face.confidence || 50) * 100),
                  embedding: face.embedding
                });
              }

              processed++;
              continue;
            }

            // For non-silver photos: process to silver tier (original logic)
            if (photo.tier !== 'bronze') {
              continue; // Only process bronze tier photos to silver
            }

            if (!photo.mimeType.startsWith('image/')) {
              continue;
            }

            const aiMetadata = await aiService.analyzeImage(photo.filePath, "openai");
            const enhancedMetadata = await aiService.enhanceMetadataWithShortDescription(aiMetadata, photo.filePath);

            const namingPatternSetting = await storage.getSettingByKey('silver_naming_pattern');
            const customPatternSetting = await storage.getSettingByKey('custom_naming_pattern');
            const namingPattern = namingPatternSetting?.value || 'datetime';
            const customPattern = customPatternSetting?.value || '';

            // Get media asset for filename generation
            const mediaAsset = await storage.getMediaAsset(photo.mediaAssetId);

            let newFilename: string | undefined = undefined;
            if (enhancedMetadata.shortDescription && mediaAsset) {
              const namingContext = {
                originalFilename: mediaAsset.originalFilename,
                aiMetadata: enhancedMetadata,
                exifMetadata: photo.metadata?.exif
                  ? (photo.metadata.exif as { dateTime?: string; dateTimeOriginal?: string; createDate?: string; camera?: string; lens?: string })
                  : undefined,
              };
              const finalPattern = namingPattern === 'custom' ? customPattern : namingPattern;
              newFilename = await generateSilverFilename(namingContext, finalPattern);
            }

            const photoWithAsset = { ...photo, mediaAsset: mediaAsset };
            const photoDate = extractPhotoDate(photoWithAsset);
            const silverPath = await fileManager.copyToSilver(photo.filePath, newFilename, photoDate);

           const faceDetectionResult = await faceDetectionService.detectFaces(photo.filePath);
            const detectedFaces = faceDetectionResult.faces;

            let eventType: string | undefined;
            let eventName: string | undefined;
            if (photoDate) {
              try {
                const detectedEvents = await eventDetectionService.detectEvents(photoDate);
                if (detectedEvents.length > 0) {
                  const bestEvent = detectedEvents.reduce((max, event) => 
                    event.confidence > max.confidence ? event : max
                  );
                  if (bestEvent.confidence >= 80) { // Only use high-confidence matches
                    eventType = bestEvent.eventType;
                    eventName = bestEvent.eventName;
                  }
                }
              } catch (error) {
                console.error('Event detection failed for photo:', photoId, error);
              }
            }

            // Create silver version
            const combinedMetadata = {
              ...(photo.metadata || {}),
            };

            const silverVersion = await storage.createFileVersion({
              mediaAssetId: photo.mediaAssetId,
              tier: "silver" as const,
              filePath: silverPath,
              fileHash: photo.fileHash,
              fileSize: photo.fileSize,
              mimeType: photo.mimeType,
              processingState: "processed" as const,
              metadata: combinedMetadata
            });

            for (const face of detectedFaces) {
              await storage.createFace({
                photoId: silverVersion.id,
                boundingBox: face.bbox || face.boundingBox || [0, 0, 100, 100],
                confidence: Math.round((face.confidence || 50) * 100),
                embedding: face.embedding
              });
            }

            // Mark bronze photo as promoted
            await storage.updateFileVersion(photo.id, {
              processingState: "promoted" as const
            });

            // Log promotion
            await storage.createAssetHistory({
              mediaAssetId: photo.mediaAssetId,
              action: 'promote_to_silver',
              details: `Promoted from Bronze to Silver tier`
            });

            promoted++;
          } catch (error: any) {
            errors.push(`Photo ${photoId}: ${error.message}`);
          }
        }

        // Mark remaining photos in group as processed (but keep in bronze)
        try {
          // Find all photos in this burst group from the analysis to mark non-selected ones as processed
          const allPhotos = await storage.getAllFileVersions();
          const photosWithAssets = [];
          for (const photo of allPhotos) {
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            if (asset) {
              photosWithAssets.push({ ...photo, mediaAsset: asset });
            }
          }
          const analysis = await burstPhotoService.analyzeBurstPhotos(photosWithAssets);
          const group = (analysis as any).groups?.find((g: any) => g.id === groupId);

          if (group) {
            for (const groupPhoto of group.photos) {
              const fileVersion = await storage.getFileVersion(groupPhoto.id);
              if (!selectedPhotoIds.includes(groupPhoto.id) && fileVersion?.tier === 'bronze') {
                await storage.updateFileVersion(groupPhoto.id, {
                  processingState: "processed" as const
                });
              }
            }
          }
        } catch (error) {
          console.error('Failed to update group processing states:', error);
        }
        processed++;
      }

      // Process ungrouped photos automatically
      if (Array.isArray(ungroupedPhotos)) {
        for (const photoId of ungroupedPhotos) {
          try {
            const photo = await storage.getFileVersion(photoId);
            if (!photo || photo.tier !== 'bronze' || !photo.mimeType.startsWith('image/')) {
              continue;
            }

            const aiMetadata = await aiService.analyzeImage(photo.filePath, "openai");
            const enhancedMetadata = await aiService.enhanceMetadataWithShortDescription(aiMetadata, photo.filePath);

            const namingPatternSetting = await storage.getSettingByKey('silver_naming_pattern');
            const customPatternSetting = await storage.getSettingByKey('custom_naming_pattern');
            const namingPattern = namingPatternSetting?.value || 'datetime';
            const customPattern = customPatternSetting?.value || '';

            // Get media asset for filename generation
            const mediaAsset = await storage.getMediaAsset(photo.mediaAssetId);

            let newFilename: string | undefined = undefined;
            if (enhancedMetadata.shortDescription && mediaAsset) {
              const namingContext = {
                originalFilename: mediaAsset.originalFilename,
                aiMetadata: enhancedMetadata,
                exifMetadata: photo.metadata?.exif
                  ? (photo.metadata.exif as { dateTime?: string; dateTimeOriginal?: string; createDate?: string; camera?: string; lens?: string })
                  : undefined,
              };
              const finalPattern = namingPattern === 'custom' ? customPattern : namingPattern;
              newFilename = await generateSilverFilename(namingContext, finalPattern);
            }

            const photoWithAsset = { ...photo, mediaAsset: mediaAsset };
            const photoDate = extractPhotoDate(photoWithAsset);
            const silverPath = await fileManager.copyToSilver(photo.filePath, newFilename, photoDate);

            // Face detection
            const faceDetectionResult = await faceDetectionService.detectFaces(photo.filePath);
            const detectedFaces = faceDetectionResult.faces;

            let eventType: string | undefined;
            let eventName: string | undefined;
            if (photoDate) {
              try {
                const detectedEvents = await eventDetectionService.detectEvents(photoDate);
                if (detectedEvents.length > 0) {
                  const bestEvent = detectedEvents.reduce((max, event) => 
                    event.confidence > max.confidence ? event : max
                  );
                  if (bestEvent.confidence >= 80) { // Only use high-confidence matches
                    eventType = bestEvent.eventType;
                    eventName = bestEvent.eventName;
                  }
                }
              } catch (error) {
                console.error('Event detection failed for photo:', photoId, error);
              }
            }

            const refreshedMetadata = await fileManager.extractMetadata(photo.filePath);

            const combinedMetadata = {
              ...(photo.metadata || {}),
              ...refreshedMetadata,
            };

            const silverVersion = await storage.createFileVersion({
              mediaAssetId: photo.mediaAssetId,
              tier: "silver" as const,
              filePath: photo.filePath,
              fileHash: photo.fileHash,
              fileSize: photo.fileSize,
              mimeType: photo.mimeType,
              processingState: "processed" as const,
              metadata: combinedMetadata
            });

            for (const face of detectedFaces) {
              await storage.createFace({
                photoId: silverVersion.id,
                boundingBox: face.bbox || face.boundingBox || [0, 0, 100, 100],
                confidence: Math.round((face.confidence || 50) * 100),
                embedding: face.embedding
              });
            }

            // Mark bronze photo as promoted
            await storage.updateFileVersion(photo.id, {
              processingState: "promoted" as const
            });

            await storage.createAssetHistory({
              mediaAssetId: photo.mediaAssetId,
              action: 'promote_ungrouped_to_silver',
              details: `Promoted ungrouped photo to Silver tier`
            });

            promoted++;
          } catch (error: any) {
            errors.push(`Ungrouped photo ${photoId}: ${error.message}`);
          }
        }
      }

      processed = selections.length + (ungroupedPhotos?.length || 0);

      res.json({ processed, promoted, errors });
    } catch (error) {
      console.error("Burst processing failed:", error);
      res.status(500).json({ error: "Failed to process burst selections" });
    }
  });

  app.post("/api/photos/search", async (req, res) => {
    try {
      const { filters = {}, sort = { field: 'createdAt', direction: 'desc' }, limit = 50, offset = 0 } = req.body;

      // For now, use the existing silver photos endpoint as a fallback
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

      const facets = {
        tiers: ['bronze', 'silver', 'gold'],
        ratings: [1, 2, 3, 4, 5],
        eventTypes: ['birthday', 'wedding', 'vacation', 'holiday']
      };

      const results = {
        photos: filteredPhotos.slice(offset, offset + limit),
        facets,
        total: filteredPhotos.length,
        offset,
        limit
      };

      res.json(results);
    } catch (error) {
      console.error("Error in advanced search:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

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
      const goldPath = await metadataEmbedding.embedMetadataToFile(photo.filePath, photo.metadata);

      // Create Gold file version
      const goldVersion = await storage.createFileVersion({
        mediaAssetId: photo.mediaAssetId,
        tier: 'gold' as const,
        filePath: goldPath,
        fileHash: photo.fileHash,
        fileSize: photo.fileSize,
        mimeType: photo.mimeType,
        metadata: photo.metadata,
        processingState: 'processed' as const
      });

      // Save tags to global library
      if ((photo.metadata as any)?.ai?.aiTags) {
        try {
          for (const tag of (photo.metadata as any).ai.aiTags) {
            await db.execute(sql`
              INSERT INTO global_tag_library (tag, usage_count, created_at)
              VALUES (${tag}, 1, NOW())
              ON CONFLICT (tag) 
              DO UPDATE SET usage_count = global_tag_library.usage_count + 1
            `);
          }
        } catch (tagError) {
          console.warn("Failed to save tags to global library:", tagError);
        }
      }

      // Log the embedding
      await storage.createAssetHistory({
        mediaAssetId: photo.mediaAssetId,
        action: 'promote_to_gold',
        details: 'Metadata embedded and promoted to Gold tier'
      });

      res.json({ success: true, goldVersion });
    } catch (error) {
      console.error("Error embedding metadata:", error);
      res.status(500).json({ message: "Failed to embed metadata" });
    }
  });

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

      const asset = await storage.getMediaAsset(photo.mediaAssetId);
      const photoWithAsset = { ...photo, mediaAsset: asset };
      const photoDate = extractPhotoDate(photoWithAsset);
      const goldPath = await fileManager.copyToGold(photo.filePath, photoDate);

      // Create Gold file version with embedded metadata
      const goldVersion = await storage.createFileVersion({
        mediaAssetId: photo.mediaAssetId,
        tier: 'gold' as const,
        filePath: goldPath,
        fileHash: photo.fileHash,
        fileSize: photo.fileSize,
        mimeType: photo.mimeType,
        metadata: photo.metadata,
        processingState: 'processed' as const
      });

      // Log promotion
      await storage.createAssetHistory({
        mediaAssetId: photo.mediaAssetId,
        action: 'promote_to_gold',
        details: 'Promoted from Silver to Gold tier'
      });

      res.json(goldVersion);
    } catch (error) {
      console.error("Error promoting photo:", error);
      res.status(500).json({ message: "Failed to promote photo" });
    }
  });

  app.post("/api/photos/:id/process-ai", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      if (photo.tier !== 'silver') {
        return res.status(400).json({ message: "Only Silver tier photos can be AI processed" });
      }

      if (!photo.mimeType.startsWith('image/')) {
        return res.status(400).json({ message: "AI processing only supports images" });
      }

      // Check if already has AI processing
      const existingAI = (photo.metadata as any)?.ai;
      if (existingAI?.shortDescription) {
        return res.status(400).json({ message: "Photo already has AI processing" });
      }

      const existingFaces = await storage.getFacesByPhoto(photo.id);
      const peopleContext = [];

      for (const face of existingFaces) {
        if (face.personId) {
          const person = await storage.getPerson(face.personId);
          if (person) {
            let ageInPhoto = null;
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            const photoWithAsset = { ...photo, mediaAsset: asset };
            const photoDate = extractPhotoDate(photoWithAsset);

            if (person.birthdate && photoDate) {
              ageInPhoto = eventDetectionService.calculateAgeInPhoto(new Date(person.birthdate), photoDate);
            }

            // Get relationships for this person
            const relationships = await storage.getRelationshipsByPerson(person.id);
            const relationshipInfo = relationships.map(rel => {
              const otherPersonId = rel.person1Id === person.id ? rel.person2Id : rel.person1Id;
              return {
              };
            });

            peopleContext.push({
            });
          }
        }
      }

      const aiMetadata = await aiService.analyzeImageWithPeopleContext(
        photo.filePath, 
        "openai", 
        peopleContext
      );
      const enhancedMetadata = await aiService.enhanceMetadataWithShortDescription(aiMetadata, photo.filePath);

      let eventType: string | undefined;
      let eventName: string | undefined;
      const asset = await storage.getMediaAsset(photo.mediaAssetId);
      const photoWithAsset = { ...photo, mediaAsset: asset };
      const photoDate = extractPhotoDate(photoWithAsset);
      if (photoDate) {
        try {
          const detectedEvents = await eventDetectionService.detectEvents(photoDate);
          if (detectedEvents.length > 0) {
            const bestEvent = detectedEvents.reduce((max, event) => 
              event.confidence > max.confidence ? event : max
            );
            if (bestEvent.confidence >= 80) {
              eventType = bestEvent.eventType;
              eventName = bestEvent.eventName;
            }
          }
        } catch (error) {
          console.error('Event detection failed during AI processing:', error);
        }
      }

      const combinedMetadata = {
        ...(photo.metadata || {}),
      };

      await storage.updateFileVersion(photo.id, {
        metadata: combinedMetadata
      });

      // Log AI processing
      await storage.createAssetHistory({
        mediaAssetId: photo.mediaAssetId,
        action: 'ai_processing',
        details: 'Added AI metadata and tags'
      });

      res.json({ 
        success: true,
        metadata: combinedMetadata
      });
    } catch (error) {
      console.error("Error in AI processing:", error);
      res.status(500).json({ message: "Failed to process photo with AI" });
    }
  });

  app.post("/api/photos/batch-ai-process", async (req, res) => {
    try {
      const { photoIds } = req.body;

      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ message: "photoIds array is required" });
      }

      let processed = 0;
      const errors = [];

      for (const photoId of photoIds) {
        try {
          const photo = await storage.getFileVersion(photoId);
          if (!photo || photo.tier !== 'silver') {
            continue;
          }

          if (!photo.mimeType.startsWith('image/')) {
            continue;
          }

          // Check if already has AI processing
          const existingAI = (photo.metadata as any)?.ai;
          if (existingAI?.shortDescription) {
            continue; // Skip already processed photos
          }

          // Get people context (same as single photo processing)
          const existingFaces = await storage.getFacesByPhoto(photo.id);
          const peopleContext = [];

          for (const face of existingFaces) {
            if (face.personId) {
              const person = await storage.getPerson(face.personId);
              if (person) {
                let ageInPhoto = null;
                const asset = await storage.getMediaAsset(photo.mediaAssetId);
                const photoWithAsset = { ...photo, mediaAsset: asset };
                const photoDate = extractPhotoDate(photoWithAsset);

                if (person.birthdate && photoDate) {
                  ageInPhoto = eventDetectionService.calculateAgeInPhoto(new Date(person.birthdate), photoDate);
                }

                const relationships = await storage.getRelationshipsByPerson(person.id);
                const relationshipInfo = relationships.map(rel => {
                  const otherPersonId = rel.person1Id === person.id ? rel.person2Id : rel.person1Id;
                  return {
                  };
                });

                peopleContext.push({
                });
              }
            }
          }

          const aiMetadata = await aiService.analyzeImageWithPeopleContext(
            photo.filePath, 
            "openai", 
            peopleContext
          );
          const enhancedMetadata = await aiService.enhanceMetadataWithShortDescription(aiMetadata, photo.filePath);

          // Event detection
          let eventType: string | undefined;
          let eventName: string | undefined;
          const asset = await storage.getMediaAsset(photo.mediaAssetId);
          const photoWithAsset = { ...photo, mediaAsset: asset };
          const photoDate = extractPhotoDate(photoWithAsset);
          if (photoDate) {
            try {
              const detectedEvents = await eventDetectionService.detectEvents(photoDate);
              if (detectedEvents.length > 0) {
                const bestEvent = detectedEvents.reduce((max, event) => 
                  event.confidence > max.confidence ? event : max
                );
                if (bestEvent.confidence >= 80) {
                  eventType = bestEvent.eventType;
                  eventName = bestEvent.eventName;
                }
              }
            } catch (error) {
              console.error('Event detection failed for photo:', photoId, error);
            }
          }

          // Update metadata
          const combinedMetadata = {
            ...(photo.metadata || {}),
          };

          await storage.updateFileVersion(photo.id, {
          });

          await storage.createAssetHistory({
          });

          processed++;
        } catch (error: any) {
          errors.push({ photoId, error: error.message });
        }
      }

      res.json({ processed, errors });
    } catch (error) {
      console.error("Error in batch AI processing:", error);
      res.status(500).json({ message: "Failed to batch process photos with AI" });
    }
  });

  app.post("/api/photos/batch-process", async (req, res) => {
    try {
      const { photoIds } = req.body;

      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res.status(400).json({ message: "photoIds array is required" });
      }

      let processed = 0;
      const errors = [];

      for (const photoId of photoIds) {
        try {
          const photo = await storage.getFileVersion(photoId);
          if (!photo || photo.tier !== 'silver') {
            continue;
          }

          // Check if this asset already has a Silver version
          const existingSilver = await storage.getFileVersionsByAsset(photo.mediaAssetId);
          const hasSilver = existingSilver.some(version => version.tier === 'silver');
          if (hasSilver) {
            continue;
          }

          if (!photo.mimeType.startsWith('image/')) {
            continue;
          }

          const aiMetadata = await aiService.analyzeImage(photo.filePath, "openai");
          const enhancedMetadata = await aiService.enhanceMetadataWithShortDescription(aiMetadata, photo.filePath);

          const namingPatternSetting = await storage.getSettingByKey('silver_naming_pattern');
          const customPatternSetting = await storage.getSettingByKey('custom_naming_pattern');
          const namingPattern = namingPatternSetting?.value || 'datetime';
          const customPattern = customPatternSetting?.value || '';

          // Get asset for both filename generation and photo date extraction
          const asset = await storage.getMediaAsset(photo.mediaAssetId);

          let newFilename: string | undefined;
          if (namingPattern !== 'original') {
            const namingContext = {
              originalFilename: asset?.originalFilename || '',
              aiMetadata: enhancedMetadata,
              exifMetadata: photo.metadata?.exif
                ? (photo.metadata.exif as { dateTime?: string; dateTimeOriginal?: string; createDate?: string; camera?: string; lens?: string })
                : undefined,
            };
            const finalPattern = namingPattern === 'custom' ? customPattern : namingPattern;
            newFilename = await generateSilverFilename(namingContext, finalPattern);
          }

          const photoWithAsset = { ...photo, mediaAsset: asset };
          const photoDate = extractPhotoDate(photoWithAsset);
          const silverPath = await fileManager.copyToSilver(photo.filePath, newFilename, photoDate);

          const faceDetectionResult = await faceDetectionService.detectFaces(photo.filePath);
          const detectedFaces = faceDetectionResult.faces;

          let eventType: string | undefined;
          let eventName: string | undefined;
          if (photoDate) {
            try {
              const detectedEvents = await eventDetectionService.detectEvents(photoDate);
              if (detectedEvents.length > 0) {
                const bestEvent = detectedEvents.reduce((max, event) => 
                  event.confidence > max.confidence ? event : max
                );
                if (bestEvent.confidence >= 80) {
                  eventType = bestEvent.eventType;
                  eventName = bestEvent.eventName;
                }
              }
            } catch (error) {
              console.error('Event detection failed for photo:', photoId, error);
            }
          }

          // Refresh EXIF metadata to ensure we have all date fields, then combine with AI metadata
          const refreshedMetadata = await fileManager.extractMetadata(photo.filePath);
          const existingMetadata = photo.metadata || {};
          const combinedMetadata = {
            ...existingMetadata,
            ...refreshedMetadata,
          };

          // Create Silver file version
          const silverVersion = await storage.createFileVersion({
          });

          for (const face of detectedFaces) {
            await storage.createFace({
            });
          }

          // Log promotion
          await storage.createAssetHistory({
          });

          processed++;
        } catch (error: any) {
          errors.push({ photoId, error: error.message });
        }
      }

      res.json({ processed, errors });
    } catch (error) {
      console.error("Error in batch processing:", error);
      res.status(500).json({ message: "Failed to batch process photos" });
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

          const asset = await storage.getMediaAsset(photo.mediaAssetId);
          const photoWithAsset = { ...photo, mediaAsset: asset };
          const photoDate = extractPhotoDate(photoWithAsset);
          const goldPath = await fileManager.copyToGold(photo.filePath, photoDate);

          // Create Gold file version
          await storage.createFileVersion({
          });

          // Log promotion
          await storage.createAssetHistory({
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

  app.post("/api/photos/:id/demote", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      if (photo.tier === 'bronze') {
        return res.status(400).json({ message: "Cannot demote Bronze tier photos" });
      }

      const versions = await storage.getFileVersionsByAsset(photo.mediaAssetId);
      let targetVersion = null;

      if (photo.tier === 'gold') {
        targetVersion = versions.find(v => v.tier === 'silver');
        if (!targetVersion) {
          return res.status(400).json({ message: "No Silver version found to demote to" });
        }
      } else if (photo.tier === 'silver') {
        targetVersion = versions.find(v => v.tier === 'bronze'); 
        if (!targetVersion) {
          return res.status(400).json({ message: "No Bronze version found to demote to" });
        }
      }

      // Delete the current higher tier version
      await storage.deleteFileVersion(photo.id);

      // Log demotion
      await storage.createAssetHistory({
      });

      const asset = await storage.getMediaAsset(targetVersion!.mediaAssetId);
      const enhancedAsset = {
        ...asset,
      };

      res.json({ 
      });
    } catch (error) {
      console.error("Error demoting photo:", error);
      res.status(500).json({ message: "Failed to demote photo" });
    }
  });

  // Reprocess photo (regenerate AI analysis and metadata)
  app.post("/api/photos/:id/reprocess", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      if (photo.tier === 'bronze') {
        return res.status(400).json({ message: "Use /process endpoint for Bronze photos" });
      }

      if (!photo.mimeType.startsWith('image/')) {
        return res.status(400).json({ message: "AI reprocessing only supports images" });
      }

      const existingFaces = await storage.getFacesByPhoto(photo.id);
      const peopleContext = [];

      for (const face of existingFaces) {
        if (face.personId) {
          const person = await storage.getPerson(face.personId);
          if (person) {
            let ageInPhoto = null;
            const asset = await storage.getMediaAsset(photo.mediaAssetId);
            const photoWithAsset = { ...photo, mediaAsset: asset };
            const photoDate = extractPhotoDate(photoWithAsset);

            if (person.birthdate && photoDate) {
              const { eventDetectionService } = await import("./services/eventDetection");
              ageInPhoto = eventDetectionService.calculateAgeInPhoto(person.birthdate, photoDate);
            }

            // Get relationships for this person
            const relationships = await storage.getRelationshipsByPerson(person.id);
            const relationshipInfo = relationships.map(rel => {
              const otherPersonId = rel.person1Id === person.id ? rel.person2Id : rel.person1Id;
              return {
              };
            });

            peopleContext.push({
            });
          }
        }
      }

      const aiMetadata = await aiService.analyzeImageWithPeopleContext(
        photo.filePath, 
        "openai", 
        peopleContext
      );
      const enhancedMetadata = await aiService.enhanceMetadataWithShortDescription(aiMetadata, photo.filePath);

      const detectedFaces = await faceDetectionService.detectFaces(photo.filePath);

      let eventType: string | undefined;
      let eventName: string | undefined;
      const asset = await storage.getMediaAsset(photo.mediaAssetId);
      const photoWithAsset = { ...photo, mediaAsset: asset };
      const photoDate = extractPhotoDate(photoWithAsset);
      if (photoDate) {
        try {
          const detectedEvents = await eventDetectionService.detectEvents(photoDate);
          if (detectedEvents.length > 0) {
            const bestEvent = detectedEvents.reduce((max, event) => 
              event.confidence > max.confidence ? event : max
            );
            if (bestEvent.confidence >= 80) {
              eventType = bestEvent.eventType;
              eventName = bestEvent.eventName;
            }
          }
        } catch (error) {
          console.error('Event detection failed during reprocessing:', error);
        }
      }

      // Update metadata
      const combinedMetadata = {
        ...(photo.metadata || {}),
      };

      const updatedPhoto = await storage.updateFileVersion(photo.id, {
      });

      // Preserve existing face assignments during reprocessing
      // Match new faces to existing ones based on position similarity
      const matchedFaces = [];
      const unmatchedExistingFaces = [...existingFaces];

      // Detect faces again for reprocessing
      const reprocessFaceResult = await faceDetectionService.detectFaces(photo.filePath);
      const newDetectedFaces = reprocessFaceResult.faces;

      for (const newFace of newDetectedFaces) {
        let bestMatch = null;
        let bestOverlap = 0;

        // Find existing face with highest overlap
        for (let i = 0; i < unmatchedExistingFaces.length; i++) {
          const existingFace = unmatchedExistingFaces[i];
          const overlap = calculateBoundingBoxOverlap(
            newFace.boundingBox as [number, number, number, number],
            existingFace.boundingBox as [number, number, number, number]
          );

          if (overlap > bestOverlap && overlap > 0.3) { // 30% overlap threshold
            bestMatch = existingFace;
            bestOverlap = overlap;
          }
        }

        if (bestMatch) {
          await storage.updateFace(bestMatch.id, {
            // Keep existing personId
          });

          const index = unmatchedExistingFaces.indexOf(bestMatch);
          unmatchedExistingFaces.splice(index, 1);
          matchedFaces.push(bestMatch);
        } else {
          // Create new face for unmatched detection
          await storage.createFace({
          });
        }
      }

      // Delete faces that weren't matched (faces that are no longer detected)
      for (const unmatchedFace of unmatchedExistingFaces) {
        await storage.deleteFace(unmatchedFace.id);
      }

      // Log reprocessing
      await storage.createAssetHistory({
      });

      res.json({ 
        updatedPhoto 
      });
    } catch (error) {
      console.error("Error reprocessing photo:", error);
      res.status(500).json({ message: "Failed to reprocess photo" });
    }
  });

  app.get("/api/photos/:id/versions", async (req, res) => {
    try {
      const photo = await storage.getFileVersion(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const versions = await storage.getFileVersionsByAsset(photo.mediaAssetId);
      const versionsWithAssets = await Promise.all(
        versions.map(async (version) => {
          const asset = await storage.getMediaAsset(version.mediaAssetId);
          const enhancedAsset = {
            ...asset,
          };
          return { ...version, mediaAsset: enhancedAsset };
        })
      );

      // Sort by tier priority (Gold > Silver > Bronze)
      const tierPriority = { gold: 3, silver: 2 };
      versionsWithAssets.sort((a, b) => 
        (tierPriority[b.tier as keyof typeof tierPriority] || 0) - 
        (tierPriority[a.tier as keyof typeof tierPriority] || 0)
      );

      res.json(versionsWithAssets);
    } catch (error) {
      console.error("Error fetching photo versions:", error);
      res.status(500).json({ message: "Failed to fetch photo versions" });
    }
  });

  // Get similar photos for review
  app.get("/api/photos/similarity", async (req, res) => {
    try {
      const { tier = "silver" } = req.query;
      const photos = await storage.getFileVersionsByTier(tier as "silver" | "gold");

      // Simple similarity grouping based on filename patterns and metadata
      const similarGroups = await findSimilarPhotos(photos);

      res.json(similarGroups);
    } catch (error) {
      console.error("Error finding similar photos:", error);
      res.status(500).json({ message: "Failed to analyze photo similarity" });
    }
    });

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSettingByKey(req.params.key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const setting = await storage.createSetting(req.body);
      res.status(201).json(setting);
    } catch (error) {
      console.error("Error creating setting:", error);
      res.status(500).json({ message: "Failed to create setting" });
    }
  });

  app.put("/api/settings/:key", async (req, res) => {
    try {
      const { value } = req.body;
      const setting = await storage.updateSetting(req.params.key, value);
      res.json(setting);
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  app.delete("/api/settings/:key", async (req, res) => {
    try {
      await storage.deleteSetting(req.params.key);
      res.json({ message: "Setting deleted successfully" });
    } catch (error) {
      console.error("Error deleting setting:", error);
      res.status(500).json({ message: "Failed to delete setting" });
    }
  });

  app.get("/api/settings/naming/patterns", async (req, res) => {
    try {
      const { BUILTIN_NAMING_PATTERNS } = await import("./services/aiNaming");
      res.json(BUILTIN_NAMING_PATTERNS);
    } catch (error) {
      console.error("Error fetching naming patterns:", error);
      res.status(500).json({ message: "Failed to fetch naming patterns" });
    }
  });

  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const event = await storage.createEvent(req.body);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.get("/api/events/holiday-sets", async (req, res) => {
    try {
      const { eventDetectionService } = await import("./services/eventDetection");
      const holidaySets = eventDetectionService.getAvailableHolidaySets();
      res.json(holidaySets);
    } catch (error) {
      console.error("Error fetching holiday sets:", error);
      res.status(500).json({ message: "Failed to fetch holiday sets" });
    }
  });

  app.post("/api/events/detect", async (req, res) => {
    try {
      const { photoDate } = req.body;
      if (!photoDate) {
        return res.status(400).json({ message: "Photo date is required" });
      }

      const { eventDetectionService } = await import("./services/eventDetection");
      const events = await eventDetectionService.detectEvents(new Date(photoDate));
      res.json(events);
    } catch (error) {
      console.error("Error detecting events:", error);
      res.status(500).json({ message: "Failed to detect events" });
    }
  });

  app.post("/api/people/:personId/age-in-photo", async (req, res) => {
    try {
      const { photoDate } = req.body;
      if (!photoDate) {
        return res.status(400).json({ message: "Photo date is required" });
      }

      const person = await storage.getPerson(req.params.personId);
      if (!person || !person.birthdate) {
        return res.status(404).json({ message: "Person not found or no birthdate set" });
      }

      const { eventDetectionService } = await import("./services/eventDetection");
      const age = eventDetectionService.calculateAgeInPhoto(new Date(person.birthdate), new Date(photoDate));

      res.json({ age, personName: person.name });
    } catch (error) {
      console.error("Error calculating age:", error);
      res.status(500).json({ message: "Failed to calculate age" });
    }
  });

  app.get("/api/ai/prompts", async (req, res) => {
    try {
      const prompts = await storage.getAllAIPrompts();
      res.json(prompts);
    } catch (error) {
      console.error("Error fetching AI prompts:", error);
      res.status(500).json({ message: "Failed to fetch AI prompts" });
    }
  });

  app.get("/api/ai/prompts/category/:category", async (req, res) => {
    try {
      const prompts = await storage.getAIPromptsByCategory(req.params.category);
      res.json(prompts);
    } catch (error) {
      console.error("Error fetching AI prompts by category:", error);
      res.status(500).json({ message: "Failed to fetch AI prompts" });
    }
  });

  app.get("/api/ai/prompts/provider/:provider", async (req, res) => {
    try {
      const prompts = await storage.getAIPromptsByProvider(req.params.provider);
      res.json(prompts);
    } catch (error) {
      console.error("Error fetching AI prompts by provider:", error);
      res.status(500).json({ message: "Failed to fetch AI prompts" });
    }
  });

  app.get("/api/ai/prompts/:id", async (req, res) => {
    try {
      const prompt = await storage.getAIPrompt(req.params.id);
      if (!prompt) {
        return res.status(404).json({ message: "AI prompt not found" });
      }
      res.json(prompt);
    } catch (error) {
      console.error("Error fetching AI prompt:", error);
      res.status(500).json({ message: "Failed to fetch AI prompt" });
    }
  });

  app.post("/api/ai/prompts", async (req, res) => {
    try {
      const { insertAIPromptSchema } = await import("@shared/schema");
      const promptData = insertAIPromptSchema.parse(req.body);
      const prompt = await storage.createAIPrompt(promptData);
      res.status(201).json(prompt);
    } catch (error) {
      console.error("Error creating AI prompt:", error);
      res.status(500).json({ message: "Failed to create AI prompt" });
    }
  });

  app.put("/api/ai/prompts/:id", async (req, res) => {
    try {
      const updates = req.body;
      const prompt = await storage.updateAIPrompt(req.params.id, updates);
      res.json(prompt);
    } catch (error) {
      console.error("Error updating AI prompt:", error);
      res.status(500).json({ message: "Failed to update AI prompt" });
    }
  });

  app.delete("/api/ai/prompts/:id", async (req, res) => {
    try {
      await storage.deleteAIPrompt(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting AI prompt:", error);
      res.status(500).json({ message: "Failed to delete AI prompt" });
    }
  });

  app.post("/api/ai/prompts/reset-to-defaults", async (req, res) => {
    try {
      await storage.resetAIPromptsToDefaults();
      res.json({ message: "AI prompts reset to defaults successfully" });
    } catch (error) {
      console.error("Error resetting AI prompts to defaults:", error);
      res.status(500).json({ message: "Failed to reset AI prompts to defaults" });
    }
  });

  app.get("/api/ai/prompts/defaults/available", async (req, res) => {
    try {
      const { DEFAULT_PROMPTS, PROMPT_CATEGORIES } = await import("@shared/ai-prompts");
      res.json({ prompts: DEFAULT_PROMPTS, categories: PROMPT_CATEGORIES });
    } catch (error) {
      console.error("Error fetching default prompts:", error);
      res.status(500).json({ message: "Failed to fetch default prompts" });
    }
  });

  app.use("/api/locations", locationRoutes);

app.put('/api/photos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedPhoto = await storage.updatePhoto(id, updates);

    // Log the update activity
    await storage.createAssetHistory({
    });

    res.json(updatedPhoto);
  } catch (error) {
    console.error('Error updating photo:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

app.get('/api/tags/library', async (req, res) => {
  try {
    const tags = await storage.getAllTags();
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags library:', error);
    res.status(500).json({ error: 'Failed to fetch tags library' });
  }
});

app.post('/api/tags/library', async (req, res) => {
  try {
    const { tag } = req.body;
    await storage.addTagToLibrary(tag);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding tag to library:', error);
    res.status(500).json({ error: 'Failed to add tag to library' });
  }
});

  const httpServer = createServer(app);
  return httpServer;
}