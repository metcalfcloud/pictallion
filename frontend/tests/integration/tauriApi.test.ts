// Integration tests for Tauri IPC communication
import { describe, it, expect, beforeEach } from "vitest";
import {
  addPhoto,
  getPhotoMetadata,
  promotePhotoTier,
  listPeople,
  createPerson,
  updatePerson,
  deletePerson,
  mergePeople,
  listRelationships,
  listPhotos,
  promotePhoto,
  detectFaces,
  generateFaceEmbedding,
  faceDetectionHealthCheck,
} from "../../src/lib/tauriApi";
import {
  mockTauriSuccess,
  mockTauriFailure,
  mockTauriDelay,
  getTauriCallHistory,
  TauriMockManager,
} from "../mocks/tauriMocks";

describe("Tauri API Integration Tests", () => {
  let mockManager: TauriMockManager;

  beforeEach(() => {
    mockManager = TauriMockManager.getInstance();
    mockManager.reset();
  });

  describe("Photo Management", () => {
    it("should add photo successfully", async () => {
      mockTauriSuccess();

      const result = await addPhoto("/path/to/photo.jpg");

      expect(result).toBe("Photo added successfully: /path/to/photo.jpg");

      const callHistory = getTauriCallHistory();
      expect(callHistory).toHaveLength(1);
      expect(callHistory[0].command).toBe("add_photo");
      expect(callHistory[0].args).toEqual({ filePath: "/path/to/photo.jpg" });
    });

    it("should handle add photo errors", async () => {
      mockTauriFailure("File not found");

      await expect(addPhoto("/invalid/path.jpg")).rejects.toThrow(
        "File not found",
      );

      const callHistory = getTauriCallHistory();
      expect(callHistory).toHaveLength(1);
      expect(callHistory[0].command).toBe("add_photo");
    });

    it("should get photo metadata", async () => {
      const mockMetadata = {
        id: "photo-123",
        filePath: "/path/to/photo.jpg",
        metadata: {
          camera: "Canon EOS R5",
          dateTime: "2024-01-01T12:00:00Z",
          location: "New York",
        },
      };

      mockTauriSuccess({ get_photo_metadata: JSON.stringify(mockMetadata) });

      const result = await getPhotoMetadata("photo-123");

      expect(result).toBe(JSON.stringify(mockMetadata));

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("get_photo_metadata");
      expect(callHistory[0].args).toEqual({ photoId: "photo-123" });
    });

    it("should promote photo tier", async () => {
      mockTauriSuccess();

      const result = await promotePhotoTier("photo-123", "silver");

      expect(result).toBe("Photo promoted to silver tier");

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("promote_photo_tier");
      expect(callHistory[0].args).toEqual({
        photoId: "photo-123",
        tier: "silver",
      });
    });

    it("should list photos", async () => {
      const mockPhotos = [
        { id: "photo-1", filePath: "/path/photo1.jpg", tier: "bronze" },
        { id: "photo-2", filePath: "/path/photo2.jpg", tier: "silver" },
      ];

      mockTauriSuccess({ list_photos: mockPhotos });

      const result = await listPhotos();

      expect(result).toEqual(mockPhotos);

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("list_photos");
    });

    it("should promote photo (alternative method)", async () => {
      mockTauriSuccess();

      const result = await promotePhoto("photo-123", "gold");

      expect(result).toBe("Photo promoted to gold tier");

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("promote_photo");
      expect(callHistory[0].args).toEqual({
        photoId: "photo-123",
        tier: "gold",
      });
    });
  });

  describe("People Management", () => {
    it("should list people", async () => {
      const mockPeople = [
        { id: "person-1", name: "John Doe" },
        { id: "person-2", name: "Jane Smith" },
      ];

      mockTauriSuccess({ list_people: mockPeople });

      const result = await listPeople();

      expect(result).toEqual(mockPeople);

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("list_people");
    });

    it("should create person", async () => {
      const newPerson = { id: "person-new", name: "New Person" };
      const createRequest = { name: "New Person" };

      mockTauriSuccess({ create_person: newPerson });

      const result = await createPerson(createRequest);

      expect(result).toEqual(newPerson);

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("create_person");
      expect(callHistory[0].args).toEqual({ req: createRequest });
    });

    it("should update person", async () => {
      const updatedPerson = { id: "person-123", name: "Updated Name" };
      const updateRequest = { name: "Updated Name" };

      mockTauriSuccess({ update_person: updatedPerson });

      const result = await updatePerson("person-123", updateRequest);

      expect(result).toEqual(updatedPerson);

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("update_person");
      expect(callHistory[0].args).toEqual({
        personId: "person-123",
        req: updateRequest,
      });
    });

    it("should delete person", async () => {
      mockTauriSuccess();

      const result = await deletePerson("person-123");

      expect(result).toBe("Person person-123 deleted successfully");

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("delete_person");
      expect(callHistory[0].args).toEqual({ personId: "person-123" });
    });

    it("should merge people", async () => {
      const mergeRequest = { personIds: ["person-1", "person-2", "person-3"] };

      mockTauriSuccess();

      const result = await mergePeople(mergeRequest);

      expect(result).toBe("Merged 3 people successfully");

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("merge_people");
      expect(callHistory[0].args).toEqual({ req: mergeRequest });
    });

    it("should list relationships", async () => {
      const mockRelationships = [
        { id: "rel-1", type: "friend" },
        { id: "rel-2", type: "family" },
      ];

      mockTauriSuccess({ list_relationships: mockRelationships });

      const result = await listRelationships("person-123");

      expect(result).toEqual(mockRelationships);

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("list_relationships");
      expect(callHistory[0].args).toEqual({ personId: "person-123" });
    });
  });

  describe("Face Detection", () => {
    it("should detect faces", async () => {
      const mockFaces = [
        {
          boundingBox: [100, 100, 200, 200] as [number, number, number, number],
          embedding: new Array(128).fill(0).map(() => Math.random()),
        },
      ];

      mockTauriSuccess({ detect_faces: mockFaces });

      const result = await detectFaces("/path/to/image.jpg");

      expect(result).toEqual(mockFaces);

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("detect_faces");
      expect(callHistory[0].args).toEqual({ imagePath: "/path/to/image.jpg" });
    });

    it("should generate face embedding", async () => {
      const mockEmbedding = new Array(128).fill(0).map(() => Math.random());
      const boundingBox: [number, number, number, number] = [50, 50, 150, 150];

      mockTauriSuccess({ generate_face_embedding: mockEmbedding });

      const result = await generateFaceEmbedding(
        "/path/to/image.jpg",
        boundingBox,
      );

      expect(result).toEqual(mockEmbedding);

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("generate_face_embedding");
      expect(callHistory[0].args).toEqual({
        imagePath: "/path/to/image.jpg",
        boundingBox,
      });
    });

    it("should perform face detection health check", async () => {
      mockTauriSuccess({ face_detection_health_check: true });

      const result = await faceDetectionHealthCheck();

      expect(result).toBe(true);

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("face_detection_health_check");
    });

    it("should handle face detection errors", async () => {
      mockTauriFailure("Face detection service unavailable");

      await expect(detectFaces("/invalid/path.jpg")).rejects.toThrow(
        "Face detection service unavailable",
      );

      const callHistory = getTauriCallHistory();
      expect(callHistory[0].command).toBe("detect_faces");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle network timeouts", async () => {
      mockTauriDelay(1000);
      mockTauriFailure("Request timeout");

      await expect(addPhoto("/path/to/photo.jpg")).rejects.toThrow(
        "Request timeout",
      );
    });

    it("should handle invalid parameters", async () => {
      mockTauriFailure("Invalid parameters");

      await expect(getPhotoMetadata("")).rejects.toThrow("Invalid parameters");
    });

    it("should handle Tauri runtime unavailable", async () => {
      // Simulate Tauri not being available
      const globalWindow = global as unknown as {
        window?: { __TAURI_IPC__?: unknown };
      };
      delete globalWindow.window?.__TAURI_IPC__;

      mockTauriFailure("Tauri runtime not available");

      await expect(listPhotos()).rejects.toThrow("Tauri runtime not available");
    });

    it("should handle concurrent API calls", async () => {
      mockTauriSuccess();

      // Make multiple concurrent calls
      const promises = [
        addPhoto("/photo1.jpg"),
        addPhoto("/photo2.jpg"),
        addPhoto("/photo3.jpg"),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toBe(`Photo added successfully: /photo${index + 1}.jpg`);
      });

      const callHistory = getTauriCallHistory();
      expect(callHistory).toHaveLength(3);
      callHistory.forEach((call, index) => {
        expect(call.command).toBe("add_photo");
        expect(call.args).toEqual({ filePath: `/photo${index + 1}.jpg` });
      });
    });

    it("should maintain call history across multiple operations", async () => {
      mockTauriSuccess();

      // Perform multiple operations
      await addPhoto("/photo.jpg");
      await listPeople();
      await detectFaces("/image.jpg");

      const callHistory = getTauriCallHistory();
      expect(callHistory).toHaveLength(3);
      expect(callHistory[0].command).toBe("add_photo");
      expect(callHistory[1].command).toBe("list_people");
      expect(callHistory[2].command).toBe("detect_faces");
    });
  });

  describe("Performance and Reliability", () => {
    it("should handle large data responses", async () => {
      // Mock a large list of photos
      const largePhotoList = Array.from({ length: 1000 }, (_, i) => ({
        id: `photo-${i}`,
        filePath: `/path/photo${i}.jpg`,
        tier: i % 3 === 0 ? "gold" : i % 2 === 0 ? "silver" : "bronze",
      }));

      mockTauriSuccess({ list_photos: largePhotoList });

      const result = await listPhotos();

      expect(result).toHaveLength(1000);
      expect(result[0]).toEqual({
        id: "photo-0",
        filePath: "/path/photo0.jpg",
        tier: "gold",
      });
      // Index 999 is divisible by 3, so tier should be 'gold' per generator
      expect(result[999]).toEqual({
        id: "photo-999",
        filePath: "/path/photo999.jpg",
        tier: "gold",
      });
    });

    it("should handle rapid successive calls", async () => {
      mockTauriSuccess();

      const startTime = Date.now();

      // Make 10 rapid calls
      const promises = Array.from({ length: 10 }, (_, i) =>
        getPhotoMetadata(`photo-${i}`),
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly (less than 1 second)
      expect(duration).toBeLessThan(1000);

      const callHistory = getTauriCallHistory();
      expect(callHistory).toHaveLength(10);
    });
  });
});
