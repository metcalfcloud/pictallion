import { 
  users, 
  mediaAssets, 
  fileVersions, 
  assetHistory,
  type User, 
  type InsertUser,
  type MediaAsset,
  type InsertMediaAsset,
  type FileVersion,
  type InsertFileVersion,
  type AssetHistory,
  type InsertAssetHistory
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
}

export const storage = new DatabaseStorage();
