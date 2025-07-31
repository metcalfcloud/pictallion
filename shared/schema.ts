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
  rating: integer("rating").default(0), // 0-5 star rating
  keywords: text("keywords").array().default(sql`'{}'`), // searchable keywords
  location: text("location"), // GPS coordinates or place name
  eventType: text("event_type"), // holiday, birthday, vacation, etc.
  eventName: text("event_name"), // specific event name
  perceptualHash: text("perceptual_hash"), // for visual similarity detection
  aiShortDescription: text("ai_short_description"), // 2-3 word AI description in PascalCase
  processingState: text("processing_state", { enum: ["processed", "promoted", "rejected"] }).default("processed"), // State management for files
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
  isSmartCollection: boolean("is_smart_collection").default(false),
  smartRules: jsonb("smart_rules"), // JSON rules for auto-updating collections
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
  notes: text("notes"),
  birthdate: timestamp("birthdate"), // Birthday for age calculation and event detection
  faceCount: integer("face_count").default(0),
  representativeFace: text("representative_face"),
  selectedThumbnailFaceId: text("selected_thumbnail_face_id"), // ID of the face to use as thumbnail
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category").notNull().default('general'),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiPrompts = pgTable("ai_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category", { enum: ["analysis", "naming", "description"] }).notNull(),
  provider: text("provider", { enum: ["openai", "ollama", "both"] }).notNull(),
  systemPrompt: text("system_prompt").notNull(),
  userPrompt: text("user_prompt").notNull(),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type", { enum: ["holiday", "birthday", "custom"] }).notNull(),
  date: timestamp("date").notNull(), // For recurring events, this is the base date
  isRecurring: boolean("is_recurring").default(false),
  recurringType: text("recurring_type", { enum: ["yearly", "monthly", "weekly"] }),
  country: text("country"), // For holidays: US, UK, etc.
  region: text("region"), // For regional holidays
  personId: varchar("person_id").references(() => people.id), // For birthday events
  isEnabled: boolean("is_enabled").default(true),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const faces = pgTable("faces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id").references(() => fileVersions.id).notNull(),
  personId: varchar("person_id").references(() => people.id),
  boundingBox: jsonb("bounding_box").notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  embedding: jsonb("embedding"),
  ignored: boolean("ignored").default(false).notNull(), // Mark face as ignored
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const globalTagLibrary = pgTable("global_tag_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tag: text("tag").notNull().unique(),
  usageCount: integer("usage_count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const relationships = pgTable("relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  person1Id: varchar("person1_id").references(() => people.id).notNull(),
  person2Id: varchar("person2_id").references(() => people.id).notNull(),
  relationshipType: text("relationship_type", { 
    enum: ["spouse", "partner", "sibling", "parent", "child", "friend", "relative"] 
  }).notNull(),
  notes: text("notes"), // Optional notes about the relationship
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
  birthdays: many(events),
  relationshipsAsPerson1: many(relationships, { relationName: "person1" }),
  relationshipsAsPerson2: many(relationships, { relationName: "person2" }),
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
  person1: one(people, {
    fields: [relationships.person1Id],
    references: [people.id],
    relationName: "person1",
  }),
  person2: one(people, {
    fields: [relationships.person2Id],
    references: [people.id],
    relationName: "person2",
  }),
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

export const eventsRelations = relations(events, ({ one }) => ({
  person: one(people, {
    fields: [events.personId],
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

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export const insertGlobalTagLibrarySchema = createInsertSchema(globalTagLibrary).omit({
  id: true,
  createdAt: true,
});

export const insertRelationshipSchema = createInsertSchema(relationships).omit({
  id: true,
  createdAt: true,
});

export const insertAIPromptSchema = createInsertSchema(aiPrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof insertUserSchema._output;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof insertMediaAssetSchema._output;
export type FileVersion = typeof fileVersions.$inferSelect;
export type InsertFileVersion = typeof insertFileVersionSchema._output;
export type AssetHistory = typeof assetHistory.$inferSelect;
export type InsertAssetHistory = typeof insertAssetHistorySchema._output;
export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof insertCollectionSchema._output;
export type CollectionPhoto = typeof collectionPhotos.$inferSelect;
export type InsertCollectionPhoto = typeof insertCollectionPhotoSchema._output;
export type Person = typeof people.$inferSelect;
export type InsertPerson = typeof insertPersonSchema._output;
export type Face = typeof faces.$inferSelect;
export type InsertFace = typeof insertFaceSchema._output;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof insertSettingSchema._output;
export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof insertEventSchema._output;
export type GlobalTagLibrary = typeof globalTagLibrary.$inferSelect;
export type InsertGlobalTagLibrary = typeof insertGlobalTagLibrarySchema._output;
export type Relationship = typeof relationships.$inferSelect;
export type InsertRelationship = typeof insertRelationshipSchema._output;
export type AIPrompt = typeof aiPrompts.$inferSelect;
export type InsertAIPrompt = typeof insertAIPromptSchema._output;

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
  detectedFaces?: Array<{
    faceId: string;
    personName?: string;
    confidence: number;
    boundingBox: [number, number, number, number];
  }>;
  detectedEvents?: Array<{
    eventType: string;
    eventName: string;
    confidence: number;
  }>;
  placeName?: string;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
  perceptualHash?: string;
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
  dateTaken?: string;
  // All available date/time fields from EXIF
  dateTimeOriginal?: string;  // When photo was actually taken (most important)
  createDate?: string;        // When photo was created
  modifyDate?: string;        // When photo was last modified
  gpsLatitude?: number;
  gpsLongitude?: number;
  // Enhanced metadata fields
  software?: string;
  flash?: string;
  whiteBalance?: string;
  exposureMode?: string;
  meteringMode?: string;
  sceneType?: string;
  colorSpace?: string;
  orientation?: string;
  xResolution?: string;
  yResolution?: string;
  resolutionUnit?: string;
}

export interface CombinedMetadata {
  exif?: ExifMetadata;
  ai?: AIMetadata;
}

// Smart Collection Rules
export interface SmartCollectionRule {
  field: string; // rating, keywords, eventType, location, etc.
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in';
  value: any;
}

export interface SmartCollectionRules {
  rules: SmartCollectionRule[];
  operator: 'AND' | 'OR'; // how to combine multiple rules
}