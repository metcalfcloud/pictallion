import express from "express";
import { storage } from "../storage";
import { insertLocationSchema } from "@shared/schema";
import { z } from "zod";

const router = express.Router();

// Get all locations
router.get("/", async (req, res) => {
  try {
    const locations = await storage.getLocations();
    res.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ message: "Failed to fetch locations" });
  }
});

// Get location statistics and hotspots
router.get("/stats", async (req, res) => {
  try {
    const stats = await storage.getLocationStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching location stats:", error);
    res.status(500).json({ message: "Failed to fetch location statistics" });
  }
});

// Get location hotspots
router.get("/hotspots", async (req, res) => {
  try {
    const hotspots = await storage.findLocationHotspots();
    res.json(hotspots);
  } catch (error) {
    console.error("Error fetching hotspots:", error);
    res.status(500).json({ message: "Failed to fetch hotspots" });
  }
});

// Get specific location
router.get("/:id", async (req, res) => {
  try {
    const location = await storage.getLocation(req.params.id);
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }
    res.json(location);
  } catch (error) {
    console.error("Error fetching location:", error);
    res.status(500).json({ message: "Failed to fetch location" });
  }
});

// Create new location
router.post("/", async (req, res) => {
  try {
    // Validate request body
    const validatedData = insertLocationSchema.parse(req.body);
    
    const location = await storage.createLocation(validatedData);
    res.status(201).json(location);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Invalid location data", 
        errors: error.errors 
      });
    }
    console.error("Error creating location:", error);
    res.status(500).json({ message: "Failed to create location" });
  }
});

// Update location
router.patch("/:id", async (req, res) => {
  try {
    const location = await storage.updateLocation(req.params.id, req.body);
    res.json(location);
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({ message: "Failed to update location" });
  }
});

// Delete location
router.delete("/:id", async (req, res) => {
  try {
    await storage.deleteLocation(req.params.id);
    res.json({ message: "Location deleted successfully" });
  } catch (error) {
    console.error("Error deleting location:", error);
    res.status(500).json({ message: "Failed to delete location" });
  }
});

export default router;