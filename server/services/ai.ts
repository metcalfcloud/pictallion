import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import type { AIMetadata } from "@shared/schema";
import { logger } from "../utils/logger.js";
import { promptManager } from "./promptManager";

// AI Provider configuration
export type AIProvider = "ollama" | "openai" | "both";

interface AIConfig {
  };
  };
}

const DEFAULT_CONFIG: AIConfig = {
  },
  }
};

class AIService {
  private config: AIConfig = DEFAULT_CONFIG;

  setConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AIConfig {
    return this.config;
  }

  async analyzeImage(imagePath: string, preferredProvider?: AIProvider): Promise<AIMetadata> {
    return this.analyzeImageWithPeopleContext(imagePath, preferredProvider, []);
  }

  async analyzeImageWithPeopleContext(
    preferredProvider?: AIProvider, 
    peopleContext?: Array<{
      ageInPhoto?: number | null;
    }>
  ): Promise<AIMetadata> {
    const provider = preferredProvider || this.config.provider;
    
    try {
      if ((provider === "openai" || provider === "both") && this.config.openai.apiKey) {
        logger.debug("Using OpenAI for image analysis", { hasApiKey: !!this.config.openai.apiKey });
        try {
          return await this.analyzeWithOpenAI(imagePath, peopleContext);
        } catch (openaiError: any) {
          logger.error("OpenAI analysis failed", openaiError);
          if (openaiError?.status === 429 || openaiError?.code === 'insufficient_quota') {
            logger.warn("OpenAI quota exceeded, falling back to alternative processing");
          }
        }
      } else {
        logger.debug("OpenAI not available", { provider, hasApiKey: !!this.config.openai.apiKey });
      }

      if (provider === "ollama" || provider === "both") {
        const isOllamaAvailable = await this.checkOllamaAvailability();
        if (isOllamaAvailable) {
          logger.debug("Using Ollama for image analysis");
          return await this.analyzeWithOllama(imagePath, peopleContext);
        } else if (provider === "ollama") {
          logger.debug("Ollama not available, falling back to basic metadata");
          return this.generateBasicMetadata(imagePath, peopleContext);
        }
      }

      logger.debug("No AI providers available, returning basic metadata");
      return this.generateBasicMetadata(imagePath, peopleContext);
    } catch (error) {
      logger.error("AI analysis failed", error);
      return this.generateBasicMetadata(imagePath, peopleContext);
    }
  }

  private async analyzeWithOllama(imagePath: string, peopleContext?: Array<{
    ageInPhoto?: number | null;
  }>): Promise<AIMetadata> {

      // Read and encode image to base64
      const imageBuffer = await fs.readFile(path.join(process.cwd(), 'data', imagePath));
      const base64Image = imageBuffer.toString('base64');

      const aiPrompt = await promptManager.getPrompt('analysis', 'ollama');
      
      const peopleContextStr = peopleContext && peopleContext.length > 0 
        ? `\n\nKNOWN PEOPLE IN THIS IMAGE:\n${peopleContext.map(person => 
            `- ${person.name}${person.ageInPhoto ? ` (age ${person.ageInPhoto} in this photo)` : ''}${
              person.relationships.length > 0 
                ? ` - relationships: ${person.relationships.map(r => r.type).join(', ')}` 
                : ''
            }`
          ).join('\n')}\n\nUse this information to enhance your analysis and descriptions. Consider the people's ages and relationships when describing the image context and generating tags.`
        : '';

      const systemPrompt = aiPrompt?.systemPrompt || `Analyze this image and provide detailed metadata in JSON format:
{
  "aiTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "shortDescription": "Brief description under 100 characters",
  "longDescription": "Warm family-friendly description of the image",
  "detectedObjects": [{"name": "object_name", "confidence": 0.95}],
  "placeName": "Location or place name if identifiable",
  "aiConfidenceScores": {"tags": 0.9, "description": 0.85, "objects": 0.8, "place": 0.7}
}

- Write descriptions as family memories, not technical analysis
- Use warm, natural language appropriate for a family album
- Provide 5-8 relevant tags describing content, mood, and setting
- Keep short description under 100 characters
- Make long description warm and detailed (200-500 characters)
- Focus on emotions, relationships, and special moments
- Only include highly confident object detections (>0.7 confidence)
- Only specify placeName if you can clearly identify a specific location
- Return ONLY valid JSON, no additional text`;

      const userPrompt = aiPrompt?.userPrompt || "Please analyze this family photo and provide warm, natural metadata in the specified JSON format.";
      const fullPrompt = systemPrompt + peopleContextStr + "\n\n" + userPrompt;

      const response = await fetch(`${this.config.ollama.baseUrl}/api/generate`, {
          'Content-Type': 'application/json',
        },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResult = JSON.parse(data.response || '{}');

      const metadata: AIMetadata = {
        }
      };

      return metadata;
  }

  private async analyzeWithOpenAI(imagePath: string, peopleContext?: Array<{
    ageInPhoto?: number | null;
  }>): Promise<AIMetadata> {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: this.config.openai.apiKey });

    // Read and encode image to base64
    const imageBuffer = await fs.readFile(path.join(process.cwd(), 'data', imagePath));
    const base64Image = imageBuffer.toString('base64');

    const aiPrompt = await promptManager.getPrompt('analysis', 'openai');

    const peopleContextStr = peopleContext && peopleContext.length > 0 
      ? `\n\nKNOWN PEOPLE IN THIS IMAGE:\n${peopleContext.map(person => 
          `- ${person.name}${person.ageInPhoto ? ` (age ${person.ageInPhoto} in this photo)` : ''}${
            person.relationships.length > 0 
              ? ` - relationships: ${person.relationships.map(r => r.type).join(', ')}` 
              : ''
          }`
        ).join('\n')}\n\nUse this information to enhance your analysis and descriptions. Consider the people's ages and relationships when describing the image context and generating tags.`
      : '';

    // Use dynamic prompt from prompt manager with fallback
    const systemPrompt = aiPrompt?.systemPrompt || `You are an expert family photo analyst. Create warm, natural descriptions perfect for a family album. When people are identified, write descriptions as if this is a cherished family memory.

Analyze the image and return a JSON object with this structure:
{
  "aiTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "shortDescription": "Brief description under 100 characters",
  "longDescription": "Warm, natural description perfect for a family album",
  "detectedObjects": [{"name": "object_name", "confidence": 0.95, "boundingBox": [x,y,w,h]}],
  "detectedFaces": [{"faceId": "uuid", "personName": null, "confidence": 0.95, "boundingBox": [x,y,w,h]}],
  "detectedEvents": [{"eventType": "holiday", "eventName": "Christmas", "confidence": 0.9}],
  "placeName": "Location or place name if identifiable",
  "gpsCoordinates": {"latitude": 40.7128, "longitude": -74.0060},
  "aiConfidenceScores": {"tags": 0.9, "description": 0.85, "objects": 0.8, "faces": 0.7, "events": 0.6, "place": 0.7}
}

DESCRIPTION GUIDELINES:
- Write descriptions as warm family memories, not technical analysis
- Use natural language like "A delightful moment with..." or "Family time captured..."
- Include emotions and atmosphere when visible
- For children, mention activities or expressions naturally
- For group photos, describe the gathering warmly
- Avoid robotic phrases like "Metadata enhanced with known people information"

FACE DETECTION INSTRUCTIONS:
- Only include detectedFaces if you can clearly see human faces
- Bounding box format: [x, y, width, height] where x,y is top-left corner
- Coordinates must be in absolute pixels, not relative values
- Double-check coordinates point to actual faces before including them
- If uncertain about face locations, omit detectedFaces entirely

For events, detect holidays, celebrations, activities, and life events.`;

    const userPrompt = aiPrompt?.userPrompt || "Analyze this family photo and provide comprehensive metadata in the specified JSON format. Focus on creating warm, natural descriptions that would be perfect for a family album.";

    const response = await openai.chat.completions.create({
        {
        },
        {
            {
            },
            {
            }
          ],
        },
      ],
    });

    const aiResult = JSON.parse(response.choices[0].message.content || '{}');

    // Generate perceptual hash for similarity detection
    const perceptualHash = await this.generatePerceptualHash(imagePath);

    return {
      }
    };
  }

  private async checkOllamaAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ollama.baseUrl}/api/tags`, {
      });
      return response.ok;
    } catch (error: any) {
      return false;
    }
  }

  private async generateBasicMetadata(imagePath: string, peopleContext?: Array<{
    ageInPhoto?: number | null;
  }>): Promise<AIMetadata> {
    // Extract basic info from filename and path
    const filename = path.basename(imagePath);
    const extension = path.extname(filename).toLowerCase();
    
    let tags = ["photo", "image"];
    let shortDescription = "Photo";
    let longDescription = "A moment captured in time.";
    
    if (peopleContext && peopleContext.length > 0) {
      // Use the prompt manager to generate a natural family description
      const familyDescription = await promptManager.generateFamilyDescription(peopleContext);
      
      const peopleNames = peopleContext.map(p => p.name);
      const displayNames = peopleNames.length <= 3 
        ? peopleNames.join(", ")
        : `${peopleNames.slice(0, 2).join(", ")} and ${peopleNames.length - 2} others`;
      
      tags.push("people", "family");
      
      // Create natural short description
      if (peopleNames.length === 1) {
        shortDescription = `A special moment with ${peopleNames[0]}`;
      } else if (peopleNames.length === 2) {
        shortDescription = `${peopleNames.join(" and ")} together`;
      } else {
        shortDescription = `Family time with ${displayNames}`;
      }
      
      // Add age-based tags naturally
      const children = peopleContext.filter(p => p.ageInPhoto && p.ageInPhoto < 13);
      const teens = peopleContext.filter(p => p.ageInPhoto && p.ageInPhoto >= 13 && p.ageInPhoto < 18);
      const adults = peopleContext.filter(p => p.ageInPhoto && p.ageInPhoto >= 18 && p.ageInPhoto < 60);
      const seniors = peopleContext.filter(p => p.ageInPhoto && p.ageInPhoto >= 60);
      
      if (children.length > 0) tags.push("children", "family-time");
      if (teens.length > 0) tags.push("teenagers");
      if (adults.length > 0) tags.push("adults");
      if (seniors.length > 0) tags.push("grandparents", "generations");
      
      const relationships = peopleContext.flatMap(p => p.relationships.map(r => r.type));
      if (relationships.includes("spouse") || relationships.includes("partner")) {
        tags.push("couple", "love");
      }
      if (relationships.includes("parent") || relationships.includes("child")) {
        tags.push("family", "bonding");
      }
      if (relationships.includes("sibling")) {
        tags.push("siblings", "family");
      }
      
      // Create warm, natural long description
      longDescription = familyDescription;
      
      const agesInfo = peopleContext.filter(p => p.ageInPhoto).map(p => `${p.name} (${p.ageInPhoto})`);
      if (agesInfo.length > 0 && agesInfo.length <= 4) {
        longDescription += ` Everyone captured beautifully - ${agesInfo.join(", ")}.`;
      }
      
    } else {
      if (filename.toLowerCase().includes('portrait')) {
        tags.push("portrait", "person");
        shortDescription = "Portrait photograph";
        longDescription = "A beautiful portrait capturing a special moment.";
      } else if (filename.toLowerCase().includes('landscape')) {
        tags.push("landscape", "outdoor", "nature");
        shortDescription = "Landscape photograph";
        longDescription = "A scenic landscape view captured with care.";
      } else if (filename.toLowerCase().includes('food')) {
        tags.push("food", "cuisine");
        shortDescription = "Food photograph";
        longDescription = "Delicious food captured to remember the moment.";
      } else {
        tags.push("photography", "memories");
        shortDescription = "Digital photograph";
        longDescription = "A photograph preserving a meaningful moment. Enhanced AI analysis available with OpenAI API key or local Ollama vision model.";
      }
    }

    return {
      shortDescription,
      longDescription,
      }
    };
  }

  /**
   * Enhance AI metadata with short description for naming
   */
  async enhanceMetadataWithShortDescription(metadata: AIMetadata, imagePath: string): Promise<AIMetadata> {
    try {
      // Only generate AI short description if using OpenAI
      if (this.config.openai.apiKey && (this.config.provider === "openai" || this.config.provider === "both")) {
        const { generateAIShortDescription } = await import("./aiNaming");
        
        // Convert image to base64 for OpenAI
        const fullPath = path.join(process.cwd(), 'data', imagePath);
        const imageBuffer = await fs.readFile(fullPath);
        const base64Image = imageBuffer.toString('base64');
        
        const shortDescription = await generateAIShortDescription(base64Image);
        
        return {
          ...metadata,
        };
      }
      
      return metadata;
    } catch (error) {
      // error("Failed to enhance metadata with short description:", error);
      return metadata;
    }
  }

  /**
   * Generate perceptual hash for visual similarity detection
   */
  async generatePerceptualHash(imagePath: string): Promise<string> {
    try {
      const fullPath = path.join(process.cwd(), 'data', imagePath);
      
      const { data, info } = await sharp(fullPath)
        .resize(8, 8)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const totalPixels = data.length;
      let sum = 0;
      for (let i = 0; i < totalPixels; i++) {
        sum += data[i];
      }
      const average = sum / totalPixels;
      
      let hash = '';
      for (let i = 0; i < totalPixels; i++) {
        hash += data[i] > average ? '1' : '0';
      }
      
      let hexHash = '';
      for (let i = 0; i < hash.length; i += 4) {
        const binary = hash.substring(i, i + 4);
        hexHash += parseInt(binary, 2).toString(16);
      }
      
      return hexHash;
    } catch (error) {
      // error("Failed to generate perceptual hash:", error);
      return "0000000000000000"; // fallback hash
    }
  }

  /**
   * Calculate Hamming distance between two perceptual hashes (similarity measure)
   */
  calculateHashSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return 0;
    
    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) differences++;
    }
    
    // Return similarity as percentage (0-100)
    return Math.round((1 - differences / hash1.length) * 100);
  }

  async generateTags(description: string, preferredProvider?: AIProvider): Promise<string[]> {
    const provider = preferredProvider || this.config.provider;
    
    try {
      if ((provider === "ollama" || provider === "both") && await this.checkOllamaAvailability()) {
        const response = await fetch(`${this.config.ollama.baseUrl}/api/generate`, {


Return ONLY a JSON array like: ["tag1", "tag2", "tag3"]`,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const result = JSON.parse(data.response || '[]');
          return Array.isArray(result) ? result.slice(0, 8) : this.extractTagsFromDescription(description);
        }
      }

      if ((provider === "openai" || provider === "both") && this.config.openai.apiKey) {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: this.config.openai.apiKey });
        
        const response = await openai.chat.completions.create({
            { role: "system", content: "Generate 5-8 relevant tags for the given image description. Return as JSON array of strings." },
            { role: "user", content: `Generate tags for: ${description}` }
          ],
        });

        const result = JSON.parse(response.choices[0].message.content || '{"tags": []}');
        return Array.isArray(result.tags) ? result.tags.slice(0, 8) : this.extractTagsFromDescription(description);
      }

      return this.extractTagsFromDescription(description);
    } catch (error) {
      // error("Tag generation failed:", error);
      return this.extractTagsFromDescription(description);
    }
  }

  async getAvailableProviders(): Promise<{ ollama: boolean; openai: boolean }> {
    const [ollamaAvailable] = await Promise.all([
      this.checkOllamaAvailability(),
    ]);
    
    return {
    };
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
