import { 
  users, 
  mediaAssets, 
  fileVersions, 
  assetHistory,
  collections,
  collectionPhotos,
  people,
  faces,
  settings,
  events,
  type User, 
  type InsertUser,
  type MediaAsset,
  type InsertMediaAsset,
  type FileVersion,
  type InsertFileVersion,
  type AssetHistory,
  type InsertAssetHistory,
  type Collection,
  type InsertCollection,
  type InsertCollectionPhoto,
  type Person,
  type InsertPerson,
  type Face,
  type InsertFace,
  type Setting,
  type InsertSetting,
  type Event,
  type InsertEvent
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, sql } from "drizzle-orm";
import path from "path";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Media asset methods
  createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset>;
  getMediaAsset(id: string): Promise<MediaAsset | undefined>;
  getAllMediaAssets(): Promise<MediaAsset[]>;
  updateMediaAsset(id: string, updates: Partial<MediaAsset>): Promise<MediaAsset>;

  // File version methods
  createFileVersion(version: InsertFileVersion): Promise<FileVersion>;
  getFileVersion(id: string): Promise<FileVersion | undefined>;
  getFileVersionsByAsset(assetId: string): Promise<FileVersion[]>;
  getFileVersionsByTier(tier: "bronze" | "silver" | "gold"): Promise<FileVersion[]>;
  getAllFileVersions(): Promise<FileVersion[]>;
  updateFileVersion(id: string, updates: Partial<FileVersion>): Promise<FileVersion>;
  updateFileVersionPerceptualHash(id: string, perceptualHash: string): Promise<void>;
  getFileByHash(hash: string): Promise<FileVersion | undefined>;
  deleteFileVersion(id: string): Promise<void>;

  // Asset history methods
  createAssetHistory(history: InsertAssetHistory): Promise<AssetHistory>;
  getAssetHistory(assetId: string): Promise<AssetHistory[]>;

  // Statistics
  getCollectionStats(): Promise<{
    totalPhotos: number;
    bronzeCount: number;
    silverCount: number;
    goldCount: number;
    aiProcessedCount: number;
    pendingReviewCount: number;
  }>;

  // Recent activity
  getRecentActivity(limit?: number): Promise<AssetHistory[]>;

  // Recent photos with metadata
  getRecentPhotos(limit?: number): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>>;

  // Collections methods
  createCollection(collection: InsertCollection): Promise<Collection>;
  getCollections(): Promise<Collection[]>;
  getCollection(id: string): Promise<Collection | undefined>;
  deleteCollection(id: string): Promise<void>;
  addPhotoToCollection(collectionId: string, photoId: string): Promise<void>;
  getCollectionPhotos(collectionId: string): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>>;

  // People & Faces methods
  createPerson(person: InsertPerson): Promise<Person>;
  getPeople(): Promise<Person[]>;
  updatePerson(id: string, updates: Partial<Person>): Promise<Person | undefined>;
  deletePerson(id: string): Promise<void>;
  getPersonPhotos?(personId: string): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>>;
  createFace(face: InsertFace): Promise<Face>;
  getAllFaces(): Promise<Face[]>;
  getFacesByPerson(personId: string): Promise<Face[]>;
  getUnassignedFaces(): Promise<Face[]>;
  linkFaceToPerson(faceId: string, personId: string): Promise<void>;
  assignFaceToPerson?(faceId: string, personId: string): Promise<void>;

  // Settings methods
  getAllSettings(): Promise<Setting[]>;
  getSettingByKey(key: string): Promise<Setting | null>;
  createSetting(data: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string): Promise<Setting>;
  deleteSetting(key: string): Promise<void>;

  // Events methods
  createEvent(event: InsertEvent): Promise<Event>;
  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  updateEvent(id: string, updates: Partial<Event>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;
  getEventsByType(type: 'holiday' | 'birthday' | 'custom'): Promise<Event[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset> {
    const [mediaAsset] = await db
      .insert(mediaAssets)
      .values(asset)
      .returning();
    return mediaAsset;
  }

  async getMediaAsset(id: string): Promise<MediaAsset | undefined> {
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    return asset || undefined;
  }

  async getAllMediaAssets(): Promise<MediaAsset[]> {
    return await db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt));
  }

  async updateMediaAsset(id: string, updates: Partial<MediaAsset>): Promise<MediaAsset> {
    const [updated] = await db
      .update(mediaAssets)
      .set(updates)
      .where(eq(mediaAssets.id, id))
      .returning();
    return updated;
  }

  async createFileVersion(version: InsertFileVersion): Promise<FileVersion> {
    const [fileVersion] = await db
      .insert(fileVersions)
      .values(version)
      .returning();
    return fileVersion;
  }

  async getFileVersion(id: string): Promise<FileVersion | undefined> {
    const [version] = await db.select().from(fileVersions).where(eq(fileVersions.id, id));
    return version || undefined;
  }

  async getFileVersionsByAsset(assetId: string): Promise<FileVersion[]> {
    return await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.mediaAssetId, assetId))
      .orderBy(desc(fileVersions.createdAt));
  }

  async getFileVersionsByTier(tier: "bronze" | "silver" | "gold"): Promise<FileVersion[]> {
    return await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.tier, tier))
      .orderBy(desc(fileVersions.createdAt));
  }

  async getAllFileVersions(): Promise<FileVersion[]> {
    return await db.select().from(fileVersions).orderBy(desc(fileVersions.createdAt));
  }

  async updateFileVersion(id: string, updates: Partial<FileVersion>): Promise<FileVersion> {
    const [updated] = await db
      .update(fileVersions)
      .set(updates)
      .where(eq(fileVersions.id, id))
      .returning();
    return updated;
  }

  async updateFileVersionPerceptualHash(id: string, perceptualHash: string): Promise<void> {
    await db
      .update(fileVersions)
      .set({ perceptualHash })
      .where(eq(fileVersions.id, id));
  }

  async getFileByHash(hash: string): Promise<FileVersion | undefined> {
    const [version] = await db.select().from(fileVersions).where(eq(fileVersions.fileHash, hash));
    return version || undefined;
  }

  async deleteFileVersion(id: string): Promise<void> {
    await db.delete(fileVersions).where(eq(fileVersions.id, id));
  }

  async getAllFileVersions() {
    return await db.select().from(fileVersions).orderBy(desc(fileVersions.createdAt));
  }

  async deleteFacesByPhoto(photoId: string): Promise<void> {
    await db.delete(faces).where(eq(faces.photoId, photoId));
  }

  async createAssetHistory(history: InsertAssetHistory): Promise<AssetHistory> {
    const [record] = await db
      .insert(assetHistory)
      .values(history)
      .returning();
    return record;
  }

  async getAssetHistory(assetId: string): Promise<AssetHistory[]> {
    return await db
      .select()
      .from(assetHistory)
      .where(eq(assetHistory.mediaAssetId, assetId))
      .orderBy(desc(assetHistory.timestamp));
  }

  async getCollectionStats() {
    const totalPhotosResult = await db.select({ count: count() }).from(fileVersions);
    const totalPhotos = totalPhotosResult[0]?.count || 0;

    const bronzeResult = await db.select({ count: count() }).from(fileVersions).where(eq(fileVersions.tier, "bronze"));
    const bronzeCount = bronzeResult[0]?.count || 0;

    const silverResult = await db.select({ count: count() }).from(fileVersions).where(eq(fileVersions.tier, "silver"));
    const silverCount = silverResult[0]?.count || 0;

    const goldResult = await db.select({ count: count() }).from(fileVersions).where(eq(fileVersions.tier, "gold"));
    const goldCount = goldResult[0]?.count || 0;

    const aiProcessedResult = await db.select({ count: count() }).from(fileVersions)
      .where(sql`metadata->>'ai' IS NOT NULL`);
    const aiProcessedCount = aiProcessedResult[0]?.count || 0;

    const pendingReviewResult = await db.select({ count: count() }).from(fileVersions)
      .where(and(eq(fileVersions.tier, "silver"), eq(fileVersions.isReviewed, false)));
    const pendingReviewCount = pendingReviewResult[0]?.count || 0;

    return {
      totalPhotos,
      bronzeCount,
      silverCount,
      goldCount,
      aiProcessedCount,
      pendingReviewCount,
    };
  }

  async getRecentActivity(limit = 10): Promise<AssetHistory[]> {
    return await db
      .select()
      .from(assetHistory)
      .orderBy(desc(assetHistory.timestamp))
      .limit(limit);
  }

  async getRecentPhotos(limit = 6): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>> {
    const results = await db
      .select()
      .from(fileVersions)
      .leftJoin(mediaAssets, eq(fileVersions.mediaAssetId, mediaAssets.id))
      .orderBy(desc(fileVersions.createdAt))
      .limit(limit);

    return results.map(result => ({
      ...result.file_versions,
      mediaAsset: {
        ...result.media_assets!,
        displayFilename: path.basename(result.file_versions.filePath)
      }
    }));
  }

  // Collections methods
  async createCollection(collection: InsertCollection): Promise<Collection> {
    const [newCollection] = await db
      .insert(collections)
      .values(collection)
      .returning();
    return newCollection;
  }

  async getCollections(): Promise<Collection[]> {
    return await db.select().from(collections).orderBy(desc(collections.createdAt));
  }

  async getCollection(id: string): Promise<Collection | undefined> {
    const [collection] = await db.select().from(collections).where(eq(collections.id, id));
    return collection || undefined;
  }

  async deleteCollection(id: string): Promise<void> {
    // First delete all photos from the collection
    await db.delete(collectionPhotos).where(eq(collectionPhotos.collectionId, id));

    // Then delete the collection itself
    await db.delete(collections).where(eq(collections.id, id));
  }

  async addPhotoToCollection(collectionId: string, photoId: string): Promise<void> {
    await db.insert(collectionPhotos).values({
      collectionId,
      photoId,
    });
  }

  async getCollectionPhotos(collectionId: string): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>> {
    const photos = await db
      .select()
      .from(collectionPhotos)
      .leftJoin(fileVersions, eq(collectionPhotos.photoId, fileVersions.id))
      .leftJoin(mediaAssets, eq(fileVersions.mediaAssetId, mediaAssets.id))
      .where(eq(collectionPhotos.collectionId, collectionId))
      .orderBy(desc(collectionPhotos.addedAt));

    return photos.map(row => ({
      ...row.file_versions!,
      mediaAsset: row.media_assets!,
    }));
  }

  // People & Faces methods
  async createPerson(person: InsertPerson): Promise<Person> {
    // Convert birthdate string to Date if provided
    const processedPerson = { ...person };
    if (processedPerson.birthdate && typeof processedPerson.birthdate === 'string') {
      processedPerson.birthdate = new Date(processedPerson.birthdate);
    }

    const [newPerson] = await db
      .insert(people)
      .values(processedPerson)
      .returning();
    return newPerson;
  }

  async getPeople(): Promise<Person[]> {
    return await db.select().from(people).orderBy(desc(people.createdAt));
  }

  async updatePerson(id: string, updates: Partial<Person>): Promise<Person | undefined> {
    try {
      // Convert birthdate string to Date if provided
      const processedUpdates = { ...updates };
      if (processedUpdates.birthdate && typeof processedUpdates.birthdate === 'string') {
        processedUpdates.birthdate = new Date(processedUpdates.birthdate);
      }

      const [updated] = await db
        .update(people)
        .set(processedUpdates)
        .where(eq(people.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error('Error updating person:', error);
      return undefined;
    }
  }

  async deletePerson(id: string): Promise<void> {
    // First unassign all faces from this person
    await db.update(faces).set({ personId: null }).where(eq(faces.personId, id));

    // Then delete the person
    await db.delete(people).where(eq(people.id, id));
  }

  async setPersonThumbnail(personId: string, faceId: string): Promise<void> {
    await db
      .update(people)
      .set({ selectedThumbnailFaceId: faceId })
      .where(eq(people.id, personId));
  }

  async createFace(face: InsertFace): Promise<Face> {
    const [newFace] = await db
      .insert(faces)
      .values(face)
      .returning();
    return newFace;
  }

  async getAllFaces(): Promise<Face[]> {
    return await db.select().from(faces);
  }

  async getFacesByPerson(personId: string): Promise<Face[]> {
    return await db.select().from(faces).where(eq(faces.personId, personId));
  }

  async linkFaceToPerson(faceId: string, personId: string): Promise<void> {
    await db
      .update(faces)
      .set({ personId })
      .where(eq(faces.id, faceId));
  }

  async assignFaceToPerson(faceId: string, personId: string): Promise<void> {
    await this.linkFaceToPerson(faceId, personId);
  }

  async getFace(faceId: string): Promise<Face | undefined> {
    const [face] = await db.select().from(faces).where(eq(faces.id, faceId));
    return face || undefined;
  }

  async getFaceById(faceId: string): Promise<Face | undefined> {
    const [face] = await db.select().from(faces).where(eq(faces.id, faceId));
    return face || undefined;
  }

  async getPerson(personId: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, personId));
    return person || undefined;
  }

  async getUnassignedFaces(): Promise<Face[]> {
    return await db.select().from(faces).where(sql`${faces.personId} IS NULL AND ${faces.ignored} = false`);
  }

  async updatePersonFaceCount(personId: string, faceCount: number): Promise<void> {
    await db
      .update(people)
      .set({ faceCount })
      .where(eq(people.id, personId));
  }

  async ignoreFace(faceId: string): Promise<void> {
    await db
      .update(faces)
      .set({ ignored: true })
      .where(eq(faces.id, faceId));
  }

  async unignoreFace(faceId: string): Promise<void> {
    await db
      .update(faces)
      .set({ ignored: false })
      .where(eq(faces.id, faceId));
  }

  async getIgnoredFaces(): Promise<Face[]> {
    return await db.select().from(faces).where(eq(faces.ignored, true));
  }

  async updatePersonRepresentativeFace(personId: string, filePath: string): Promise<void> {
    await db
      .update(people)
      .set({ representativeFace: filePath })
      .where(eq(people.id, personId));
  }

  async getPersonPhotos(personId: string): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>> {
    const personFaces = await this.getFacesByPerson(personId);
    const photoIds = Array.from(new Set(personFaces.map(face => face.photoId)));

    const photos = [];
    for (const photoId of photoIds) {
      const photo = await this.getFileVersion(photoId);
      if (photo) {
        const asset = await this.getMediaAsset(photo.mediaAssetId);
        if (asset) {
          photos.push({ ...photo, mediaAsset: asset });
        }
      }
    }

    return photos;
  }

  // Settings methods
  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings).orderBy(settings.category, settings.key);
  }

  async getSettingByKey(key: string): Promise<Setting | null> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || null;
  }

  async createSetting(data: InsertSetting): Promise<Setting> {
    const [setting] = await db.insert(settings).values(data).returning();
    return setting;
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    const [setting] = await db.update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, key))
      .returning();
    return setting;
  }

  async deleteSetting(key: string): Promise<void> {
    await db.delete(settings).where(eq(settings.key, key));
  }

  // Events methods
  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(events.date);
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<Event> {
    const [event] = await db.update(events)
      .set(updates)
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async getEventsByType(type: 'holiday' | 'birthday' | 'custom'): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.type, type));
  }
}

export const storage = new DatabaseStorage();