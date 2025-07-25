import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const mediaAssets = pgTable("media_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalFilename: text("original_filename").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fileVersions = pgTable("file_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mediaAssetId: varchar("media_asset_id").references(() => mediaAssets.id).notNull(),
  tier: text("tier", { enum: ["bronze", "silver", "gold"] }).notNull(),
  filePath: text("file_path").notNull(),
  fileHash: text("file_hash").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  metadata: jsonb("metadata"),
  isReviewed: boolean("is_reviewed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assetHistory = pgTable("asset_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mediaAssetId: varchar("media_asset_id").references(() => mediaAssets.id).notNull(),
  action: text("action").notNull(),
  details: text("details"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const collections = pgTable("collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  coverPhoto: text("cover_photo"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const collectionPhotos = pgTable("collection_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectionId: varchar("collection_id").references(() => collections.id).notNull(),
  photoId: varchar("photo_id").references(() => fileVersions.id).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const people = pgTable("people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  faceCount: integer("face_count").default(0),
  representativeFace: text("representative_face"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const faces = pgTable("faces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id").references(() => fileVersions.id).notNull(),
  personId: varchar("person_id").references(() => people.id),
  boundingBox: jsonb("bounding_box").notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  embedding: jsonb("embedding"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const mediaAssetsRelations = relations(mediaAssets, ({ many }) => ({
  fileVersions: many(fileVersions),
  history: many(assetHistory),
}));

export const fileVersionsRelations = relations(fileVersions, ({ one }) => ({
  mediaAsset: one(mediaAssets, {
    fields: [fileVersions.mediaAssetId],
    references: [mediaAssets.id],
  }),
}));

export const assetHistoryRelations = relations(assetHistory, ({ one }) => ({
  mediaAsset: one(mediaAssets, {
    fields: [assetHistory.mediaAssetId],
    references: [mediaAssets.id],
  }),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  photos: many(collectionPhotos),
}));

export const collectionPhotosRelations = relations(collectionPhotos, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionPhotos.collectionId],
    references: [collections.id],
  }),
  photo: one(fileVersions, {
    fields: [collectionPhotos.photoId],
    references: [fileVersions.id],
  }),
}));

export const peopleRelations = relations(people, ({ many }) => ({
  faces: many(faces),
}));

export const facesRelations = relations(faces, ({ one }) => ({
  photo: one(fileVersions, {
    fields: [faces.photoId],
    references: [fileVersions.id],
  }),
  person: one(people, {
    fields: [faces.personId],
    references: [people.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMediaAssetSchema = createInsertSchema(mediaAssets).pick({
  originalFilename: true,
});

export const insertFileVersionSchema = createInsertSchema(fileVersions).omit({
  id: true,
  createdAt: true,
});

export const insertAssetHistorySchema = createInsertSchema(assetHistory).omit({
  id: true,
  timestamp: true,
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCollectionPhotoSchema = createInsertSchema(collectionPhotos).omit({
  id: true,
  addedAt: true,
});

export const insertPersonSchema = createInsertSchema(people).omit({
  id: true,
  createdAt: true,
});

export const insertFaceSchema = createInsertSchema(faces).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type FileVersion = typeof fileVersions.$inferSelect;
export type InsertFileVersion = z.infer<typeof insertFileVersionSchema>;
export type AssetHistory = typeof assetHistory.$inferSelect;
export type InsertAssetHistory = z.infer<typeof insertAssetHistorySchema>;
export type Collection = typeof collections.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type CollectionPhoto = typeof collectionPhotos.$inferSelect;
export type InsertCollectionPhoto = z.infer<typeof insertCollectionPhotoSchema>;
export type Person = typeof people.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Face = typeof faces.$inferSelect;
export type InsertFace = z.infer<typeof insertFaceSchema>;

// Metadata interfaces
export interface AIMetadata {
  aiTags: string[];
  shortDescription: string;
  longDescription: string;
  detectedObjects: Array<{
    name: string;
    confidence: number;
    boundingBox?: [number, number, number, number];
  }>;
  placeName?: string;
  aiConfidenceScores: Record<string, number>;
}

export interface ExifMetadata {
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: string;
  focalLength?: string;
  dateTime?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
}

export interface CombinedMetadata {
  exif?: ExifMetadata;
  ai?: AIMetadata;
}
