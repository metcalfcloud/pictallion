import express from "express";
import { storage } from "../storage";
import { insertLocationSchema } from "@shared/schema";
import { z } from "zod";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const locations = await storage.getLocations();
    res.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ message: "Failed to fetch locations" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const stats = await storage.getLocationStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching location stats:", error);
    res.status(500).json({ message: "Failed to fetch location statistics" });
  }
});

router.get("/hotspots", async (req, res) => {
  try {
    const hotspots = await storage.findLocationHotspots();
    res.json(hotspots);
  } catch (error) {
    console.error("Error fetching hotspots:", error);
    res.status(500).json({ message: "Failed to fetch hotspots" });
  }
});

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

router.post("/", async (req, res) => {
  try {
    // Validate request body
    const validatedData = insertLocationSchema.parse(req.body);
    
    const location = await storage.createLocation(validatedData);
    res.status(201).json(location);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
      });
    }
    console.error("Error creating location:", error);
    res.status(500).json({ message: "Failed to create location" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const updateData = insertLocationSchema.partial().parse(req.body);
    
    const location = await storage.updateLocation(req.params.id, updateData);
    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }
    res.json(location);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
      });
    }
    console.error("Error updating location:", error);
    res.status(500).json({ message: "Failed to update location" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteLocation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Location not found" });
    }
    res.json({ message: "Location deleted successfully" });
  } catch (error) {
    console.error("Error deleting location:", error);
    res.status(500).json({ message: "Failed to delete location" });
  }
});

// Create location from coordinates with reverse geocoding
router.post("/from-coordinates", async (req, res) => {
  try {
    const { latitude, longitude, name, description } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }
    
    let placeName = undefined;
    let placeType = undefined;
    
    try {
      const { reverseGeocodingService } = await import("../services/reverse-geocoding");
      const geocodingResult = await reverseGeocodingService.reverseGeocode(
        parseFloat(latitude), 
        parseFloat(longitude)
      );
      
      if (geocodingResult) {
        placeName = geocodingResult.placeName;
        placeType = geocodingResult.placeType;
      }
    } catch (geocodingError) {
      console.warn("Reverse geocoding failed:", geocodingError);
    }
    
    const locationData = {
      placeName,
      placeType,
    };
    
    const location = await storage.createLocation(locationData);
    res.status(201).json(location);
  } catch (error) {
    console.error("Error creating location from coordinates:", error);
    res.status(500).json({ message: "Failed to create location" });
  }
});

export default router;