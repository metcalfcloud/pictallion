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
  relationships,
  locations,
  aiPrompts,
  globalTagLibrary,
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
  type InsertEvent,
  type Relationship,
  type InsertRelationship,
  type Location,
  type InsertLocation,
  type AIPrompt,
  type InsertAIPrompt
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, sql } from "drizzle-orm";
import path from "path";
import crypto from 'crypto';

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset>;
  getMediaAsset(id: string): Promise<MediaAsset | undefined>;
  getAllMediaAssets(): Promise<MediaAsset[]>;
  updateMediaAsset(id: string, updates: Partial<MediaAsset>): Promise<MediaAsset>;

  createFileVersion(version: InsertFileVersion): Promise<FileVersion>;
  getFileVersion(id: string): Promise<FileVersion | undefined>;
  getFileVersionsByAsset(assetId: string): Promise<FileVersion[]>;
  getFileVersionsByTier(tier: "bronze" | "silver" | "gold"): Promise<FileVersion[]>;
  getAllFileVersions(): Promise<FileVersion[]>;
  updateFileVersion(id: string, updates: Partial<FileVersion>): Promise<FileVersion>;
  updateFileVersionPerceptualHash(id: string, perceptualHash: string): Promise<void>;
  getFileByHash(hash: string): Promise<FileVersion | undefined>;
  deleteFileVersion(id: string): Promise<void>;

  createAssetHistory(history: InsertAssetHistory): Promise<AssetHistory>;
  getAssetHistory(assetId: string): Promise<AssetHistory[]>;

  getCollectionStats(): Promise<{
  }>;

  // Recent activity
  getRecentActivity(limit?: number): Promise<AssetHistory[]>;

  getRecentPhotos(limit?: number): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>>;

  createCollection(collection: InsertCollection): Promise<Collection>;
  getCollections(): Promise<Collection[]>;
  getCollection(id: string): Promise<Collection | undefined>;
  updateCollection(id: string, updates: Partial<Collection>): Promise<Collection>;
  deleteCollection(id: string): Promise<void>;
  addPhotoToCollection(collectionId: string, photoId: string): Promise<void>;
  getCollectionPhotos(collectionId: string): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>>;

  createPerson(person: InsertPerson): Promise<Person>;
  getPeople(): Promise<Person[]>;
  updatePerson(id: string, updates: Partial<Person>): Promise<Person | undefined>;
  deletePerson(id: string): Promise<void>;
  getPersonPhotos?(personId: string): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>>;
  createFace(face: InsertFace): Promise<Face>;
  getAllFaces(): Promise<Face[]>;
  getFacesByPerson(personId: string): Promise<Face[]>;
  getFacesByPhoto(photoId: string): Promise<Face[]>;
  getUnassignedFaces(): Promise<Face[]>;
  linkFaceToPerson(faceId: string, personId: string): Promise<void>;
  assignFaceToPerson?(faceId: string, personId: string): Promise<void>;
  updateFace(id: string, updates: Partial<Face>): Promise<Face>;
  deleteFace(id: string): Promise<void>;
  deleteFacesByPhoto(photoId: string): Promise<void>;

  getAllSettings(): Promise<Setting[]>;
  getSettingByKey(key: string): Promise<Setting | null>;
  createSetting(data: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string): Promise<Setting>;
  deleteSetting(key: string): Promise<void>;

  createEvent(event: InsertEvent): Promise<Event>;
  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  updateEvent(id: string, updates: Partial<Event>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;
  getEventsByType(type: 'holiday' | 'birthday' | 'custom'): Promise<Event[]>;

  createRelationship(relationship: InsertRelationship): Promise<Relationship>;
  getRelationshipsByPerson(personId: string): Promise<Array<Relationship & { person1?: Person; person2?: Person }>>;
  updateRelationship(id: string, updates: Partial<Relationship>): Promise<Relationship>;
  deleteRelationship(id: string): Promise<void>;
  getPerson(id: string): Promise<Person | undefined>;

  getAllAIPrompts(): Promise<AIPrompt[]>;
  getAIPrompt(id: string): Promise<AIPrompt | undefined>;
  getAIPromptsByCategory(category: string): Promise<AIPrompt[]>;
  getAIPromptsByProvider(provider: string): Promise<AIPrompt[]>;
  createAIPrompt(prompt: InsertAIPrompt): Promise<AIPrompt>;
  updateAIPrompt(id: string, updates: Partial<AIPrompt>): Promise<AIPrompt>;
  deleteAIPrompt(id: string): Promise<void>;
  getActiveAIPrompts(): Promise<AIPrompt[]>;
  resetAIPromptsToDefaults(): Promise<void>;

  createLocation(location: InsertLocation): Promise<Location>;
  getLocations(): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  updateLocation(id: string, updates: Partial<Location>): Promise<Location | null>;
  deleteLocation(id: string): Promise<boolean>;
  getLocationStats(): Promise<{
    total: number;
    byCountry: Array<{ country: string; count: number }>;
    recent: Array<{ name: string; usageCount: number; suggestedName?: string }>;
  }>;
  findLocationHotspots(): Promise<Array<{
    lat: number;
    lng: number;
    count: number;
    name?: string;
  }>>;

  updatePhoto(id: string, updates: any): Promise<any>;
  getAllTags(): Promise<string[]>;

  createSmartCollection?(collection: InsertCollection): Promise<Collection>;
  getSmartCollections?(): Promise<Collection[]>;
  getSmartCollection?(id: string): Promise<Collection | undefined>;
  deleteSmartCollection?(id: string): Promise<void>;
  addPhotoToSmartCollection?(collectionId: string, photoId: string): Promise<void>;
  getSmartCollectionPhotos?(collectionId: string): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>>;
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

  async getFileVersionsByTier(tier: "silver" | "gold"): Promise<FileVersion[]> {
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
    // Total unique photos = count of unique media assets (not file versions)
    const totalPhotosResult = await db.select({ count: count() }).from(mediaAssets);
    const totalPhotos = totalPhotosResult[0]?.count || 0;

    const silverResult = await db.select({ count: count() }).from(fileVersions).where(eq(fileVersions.tier, "silver"));
    const silverCount = silverResult[0]?.count || 0;

    const goldResult = await db.select({ count: count() }).from(fileVersions).where(eq(fileVersions.tier, "gold"));
    const goldCount = goldResult[0]?.count || 0;

    return {
      totalPhotos,
      silverCount,
      goldCount,
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
      }
    }));
  }

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

  async updateCollection(id: string, updates: Partial<Collection>): Promise<Collection> {
    const [updatedCollection] = await db
      .update(collections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(collections.id, id))
      .returning();
    return updatedCollection;
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
    }));
  }

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
    try {
      return await db.select().from(people).orderBy(desc(people.createdAt));
    } catch (error) {
      console.error('Error fetching people:', error);
      return [];
    }
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
    try {
      return await db.select().from(faces).where(eq(faces.personId, personId));
    } catch (error) {
      console.error(`Error fetching faces for person ${personId}:`, error);
      return [];
    }
  }

  async getFacesByPhoto(photoId: string): Promise<Face[]> {
    return await db.select().from(faces).where(eq(faces.photoId, photoId));
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

  async updateFace(id: string, updates: Partial<Face>): Promise<Face> {
    const [updatedFace] = await db
      .update(faces)
      .set(updates)
      .where(eq(faces.id, id))
      .returning();
    return updatedFace;
  }

  async deleteFace(id: string): Promise<void> {
    await db.delete(faces).where(eq(faces.id, id));
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

  async createRelationship(relationship: InsertRelationship): Promise<Relationship> {
    const [newRelationship] = await db.insert(relationships).values(relationship).returning();
    return newRelationship;
  }

  async getRelationshipsByPerson(personId: string): Promise<Array<Relationship & { person1?: Person; person2?: Person }>> {
    // Get all relationships where the person is either person1 or person2
    const relationshipsRaw = await db
      .select()
      .from(relationships)
      .where(sql`${relationships.person1Id} = ${personId} OR ${relationships.person2Id} = ${personId}`)
      .orderBy(desc(relationships.createdAt));

    // Fetch person details for each relationship
    const relationshipsWithPeople = await Promise.all(
      relationshipsRaw.map(async (rel) => {
        const person1 = await this.getPerson(rel.person1Id);
        const person2 = await this.getPerson(rel.person2Id);
        return {
          ...rel,
          person1,
          person2,
        };
      })
    );

    return relationshipsWithPeople;
  }

  async updateRelationship(id: string, updates: Partial<Relationship>): Promise<Relationship> {
    const [updated] = await db
      .update(relationships)
      .set(updates)
      .where(eq(relationships.id, id))
      .returning();
    return updated;
  }

  async deleteRelationship(id: string): Promise<void> {
    await db.delete(relationships).where(eq(relationships.id, id));
  }

  async getPerson(id: string): Promise<Person | undefined> {
    const [person] = await db.select().from(people).where(eq(people.id, id));
    return person || undefined;
  }

  async getAllAIPrompts(): Promise<AIPrompt[]> {
    return await db.select().from(aiPrompts).orderBy(aiPrompts.category, aiPrompts.name);
  }

  async getAIPrompt(id: string): Promise<AIPrompt | undefined> {
    const [prompt] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, id));
    return prompt || undefined;
  }

  async getAIPromptsByCategory(category: string): Promise<AIPrompt[]> {
    return await db.select().from(aiPrompts).where(sql`${aiPrompts.category} = ${category}`);
  }

  async getAIPromptsByProvider(provider: string): Promise<AIPrompt[]> {
    return await db.select().from(aiPrompts)
      .where(sql`${aiPrompts.provider} = ${provider} OR ${aiPrompts.provider} = 'both'`);
  }

  async createAIPrompt(prompt: InsertAIPrompt): Promise<AIPrompt> {
    const [newPrompt] = await db.insert(aiPrompts).values(prompt).returning();
    return newPrompt;
  }

  async updateAIPrompt(id: string, updates: Partial<AIPrompt>): Promise<AIPrompt> {
    const [updated] = await db
      .update(aiPrompts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiPrompts.id, id))
      .returning();
    return updated;
  }

  async deleteAIPrompt(id: string): Promise<void> {
    await db.delete(aiPrompts).where(eq(aiPrompts.id, id));
  }

  async getActiveAIPrompts(): Promise<AIPrompt[]> {
    return await db.select().from(aiPrompts).where(eq(aiPrompts.isActive, true));
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
  }

  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations).orderBy(locations.photoCount, locations.name);
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location || undefined;
  }

  async updateLocation(id: string, updates: Partial<Location>): Promise<Location | null> {
    const [updated] = await db
      .update(locations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();
    return updated || null;
  }

  async deleteLocation(id: string): Promise<boolean> {
    const result = await db.delete(locations).where(eq(locations.id, id)).returning();
    return result.length > 0;
  }

  async getLocationStats(): Promise<{
    total: number;
    topLocations: Location[];
    recentLocations: Location[];
    hotspots: Array<{ lat: number; lng: number; count: number; name?: string; suggestedName?: string }>;
  }> {
    const { locationClusteringService } = await import('./services/location-clustering');

    const allLocations = await this.getLocations();

    const allPhotos = await this.getAllFileVersionsWithAssets();

    const photosWithLocation = locationClusteringService.extractCoordinates(allPhotos);

    const hotspots = locationClusteringService.findHotspots(allPhotos, 2);

    const topLocations = allLocations
      .sort((a, b) => (b.photoCount || 0) - (a.photoCount || 0))
      .slice(0, 5);

    const recentLocations = allLocations
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);



    return {
      total: allLocations.length,
      topLocations,
      recentLocations,
      hotspots,
    };
  }

  async findLocationHotspots(): Promise<Array<{
    lat: number;
    lng: number;
    count: number;
    name?: string;
  }>> {
    const { locationClusteringService } = await import('./services/location-clustering');
    const allPhotos = await this.getAllFileVersionsWithAssets();
    return locationClusteringService.findHotspots(allPhotos, 2);
  }

  async getAllFileVersionsWithAssets(): Promise<Array<FileVersion & { mediaAsset: MediaAsset }>> {
    const result = await db
      .select()
      .from(fileVersions)
      .leftJoin(mediaAssets, eq(fileVersions.mediaAssetId, mediaAssets.id));

    return result.map(row => ({
      ...row.file_versions,
    }));
  }

  async resetAIPromptsToDefaults(): Promise<void> {
    const { DEFAULT_PROMPTS } = await import("@shared/ai-prompts");

    await db.delete(aiPrompts);

    for (const prompt of DEFAULT_PROMPTS) {
      await db.insert(aiPrompts).values({
      });
    }
  }

  async updatePhoto(id: string, updates: any): Promise<any> {
    const photo = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (photo.length === 0) {
      throw new Error('Photo not found');
    }

    // Handle tags separately if they're included
    const { tags, ...otherUpdates } = updates;

    await db.update(mediaAssets)
      .set({
        ...otherUpdates,
        ...(tags && { tags: JSON.stringify(tags) }),
      })
      .where(eq(mediaAssets.id, id));

    // Add new tags to the global library
    if (tags) {
      for (const tag of tags) {
        await this.addTagToLibrary(tag);
      }
    }

    return this.getMediaAsset(id);
  }

  async getAllTags(): Promise<string[]> {
    try {
      const result = await db.select().from(globalTagLibrary);
      return result.map(row => row.tag);
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  }

  async addTagToLibrary(tag: string): Promise<void> {
    try {
      // Insert only if tag doesn't exist (ignore conflicts)
      await db.insert(globalTagLibrary)
        .values({
        })
        .onConflictDoNothing();
    } catch (error) {
      console.log(`Tag '${tag}' already exists in library`);
    }
  }
}

export const storage = new DatabaseStorage();