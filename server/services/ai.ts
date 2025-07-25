import fs from "fs/promises";
import path from "path";
import type { AIMetadata } from "@shared/schema";

// Default Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llava:latest"; // Default vision model

class AIService {
  async analyzeImage(imagePath: string): Promise<AIMetadata> {
    try {
      // Check if Ollama is available
      const isOllamaAvailable = await this.checkOllamaAvailability();
      if (!isOllamaAvailable) {
        console.log("Ollama not available, returning basic metadata");
        return this.generateBasicMetadata(imagePath);
      }

      // Read and encode image to base64
      const imageBuffer = await fs.readFile(path.join(process.cwd(), 'data', imagePath));
      const base64Image = imageBuffer.toString('base64');

      const prompt = `Analyze this image and provide detailed metadata in JSON format:
{
  "aiTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "shortDescription": "Brief description under 100 characters",
  "longDescription": "Detailed description of the image content, scene, mood, and notable aspects",
  "detectedObjects": [{"name": "object_name", "confidence": 0.95}],
  "placeName": "Location or place name if identifiable",
  "aiConfidenceScores": {"tags": 0.9, "description": 0.85, "objects": 0.8, "place": 0.7}
}

Rules:
- Provide 5-8 relevant tags describing the image content, style, mood, and setting
- Keep short description under 100 characters
- Make long description detailed and informative (200-500 characters)
- Only include highly confident object detections (>0.7 confidence)
- Only specify placeName if you can clearly identify a specific location
- Provide confidence scores for each analysis type (0.0 to 1.0)
- Focus on visual elements, composition, lighting, colors, and subject matter
- Return ONLY valid JSON, no additional text`;

      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: prompt,
          images: [base64Image],
          stream: false,
          format: "json"
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResult = JSON.parse(data.response || '{}');

      // Validate and structure the response
      const metadata: AIMetadata = {
        aiTags: Array.isArray(aiResult.aiTags) ? aiResult.aiTags.slice(0, 8) : [],
        shortDescription: aiResult.shortDescription || "AI analysis unavailable",
        longDescription: aiResult.longDescription || "Detailed AI analysis unavailable for this image.",
        detectedObjects: Array.isArray(aiResult.detectedObjects) ? aiResult.detectedObjects : [],
        placeName: aiResult.placeName || undefined,
        aiConfidenceScores: aiResult.aiConfidenceScores || {
          tags: 0.5,
          description: 0.5,
          objects: 0.5,
          place: 0.0
        }
      };

      return metadata;

    } catch (error) {
      console.error("AI analysis failed:", error);
      return this.generateBasicMetadata(imagePath);
    }
  }

  private async checkOllamaAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error: any) {
      console.log("Ollama not available:", error?.message || "Unknown error");
      return false;
    }
  }

  private async generateBasicMetadata(imagePath: string): Promise<AIMetadata> {
    // Extract basic info from filename and path
    const filename = path.basename(imagePath);
    const extension = path.extname(filename).toLowerCase();
    
    let tags = ["photo", "image"];
    let shortDescription = "Photo";
    
    // Basic classification based on filename patterns
    if (filename.toLowerCase().includes('portrait')) {
      tags.push("portrait", "person");
      shortDescription = "Portrait photograph";
    } else if (filename.toLowerCase().includes('landscape')) {
      tags.push("landscape", "outdoor", "nature");
      shortDescription = "Landscape photograph";
    } else if (filename.toLowerCase().includes('food')) {
      tags.push("food", "cuisine");
      shortDescription = "Food photograph";
    } else {
      tags.push("photography");
      shortDescription = "Digital photograph";
    }

    return {
      aiTags: tags,
      shortDescription,
      longDescription: "Basic metadata generated from filename. AI analysis requires Ollama to be running locally with a vision model like llava:latest.",
      detectedObjects: [],
      aiConfidenceScores: {
        tags: 0.3,
        description: 0.2,
        objects: 0.0,
        place: 0.0
      }
    };
  }

  async generateTags(description: string): Promise<string[]> {
    try {
      const isOllamaAvailable = await this.checkOllamaAvailability();
      if (!isOllamaAvailable) {
        // Return basic tags based on description analysis
        return this.extractTagsFromDescription(description);
      }

      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OLLAMA_TEXT_MODEL || "llama3.2:latest",
          prompt: `Generate 5-8 relevant tags for this image description. Return as JSON array of strings. Focus on content, style, mood, and visual elements.

Description: ${description}

Return ONLY a JSON array like: ["tag1", "tag2", "tag3"]`,
          stream: false,
          format: "json"
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const result = JSON.parse(data.response || '[]');
      return Array.isArray(result) ? result.slice(0, 8) : ["photo", "image"];
    } catch (error) {
      console.error("Tag generation failed:", error);
      return this.extractTagsFromDescription(description);
    }
  }

  private extractTagsFromDescription(description: string): string[] {
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'];
    const words = description.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word))
      .slice(0, 6);
    
    return words.length > 0 ? words : ["photo", "image"];
  }
}

export const aiService = new AIService();
