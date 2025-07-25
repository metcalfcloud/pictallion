import { 
  users, 
  mediaAssets, 
  fileVersions, 
  assetHistory,
  collections,
  collectionPhotos,
  people,
  faces,
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
  type InsertFace
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Media asset methods
  createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset>;
  getMediaAsset(id: string): Promise<MediaAsset | undefined>;
  getAllMediaAssets(): Promise<MediaAsset[]>;
  
  // File version methods
  createFileVersion(version: InsertFileVersion): Promise<FileVersion>;
  getFileVersion(id: string): Promise<FileVersion | undefined>;
  getFileVersionsByAsset(assetId: string): Promise<FileVersion[]>;
  getFileVersionsByTier(tier: "bronze" | "silver" | "gold"): Promise<FileVersion[]>;
  getAllFileVersions(): Promise<FileVersion[]>;
  updateFileVersion(id: string, updates: Partial<FileVersion>): Promise<FileVersion>;
  getFileByHash(hash: string): Promise<FileVersion | undefined>;
  
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
  addPhotoToCollection(collectionId: string, photoId: string): Promise<void>;
  getCollectionPhotos(collectionId: string): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>>;

  // People & Faces methods
  createPerson(person: InsertPerson): Promise<Person>;
  getPeople(): Promise<Person[]>;
  createFace(face: InsertFace): Promise<Face>;
  getAllFaces(): Promise<Face[]>;
  getFacesByPerson(personId: string): Promise<Face[]>;
  linkFaceToPerson(faceId: string, personId: string): Promise<void>;
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

  async getFileByHash(hash: string): Promise<FileVersion | undefined> {
    const [version] = await db.select().from(fileVersions).where(eq(fileVersions.fileHash, hash));
    return version || undefined;
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
      mediaAsset: result.media_assets!
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
    const [newPerson] = await db
      .insert(people)
      .values(person)
      .returning();
    return newPerson;
  }

  async getPeople(): Promise<Person[]> {
    return await db.select().from(people).orderBy(desc(people.createdAt));
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

  async getPersonPhotos(personId: string): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>> {
    const personFaces = await this.getFacesByPerson(personId);
    const photoIds = [...new Set(personFaces.map(face => face.photoId))];
    
    const photos = [];
    for (const photoId of photoIds) {
      const photo = await this.getFileVersion(photoId);
      if (photo) {
        const asset = await this.getMediaAsset(photo.mediaAssetId);
        photos.push({ ...photo, mediaAsset: asset });
      }
    }
    
    return photos;
  }
}

export const storage = new DatabaseStorage();
