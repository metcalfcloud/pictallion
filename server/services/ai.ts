import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import type { AIMetadata } from "@shared/schema";
import { logger } from "../utils/logger.js";

// AI Provider configuration
export type AIProvider = "ollama" | "openai" | "both";

interface AIConfig {
  provider: AIProvider;
  ollama: {
    baseUrl: string;
    visionModel: string;
    textModel: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
}

const DEFAULT_CONFIG: AIConfig = {
  provider: (process.env.AI_PROVIDER as AIProvider) || (process.env.OPENAI_API_KEY ? "openai" : "ollama"),
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    visionModel: process.env.OLLAMA_MODEL || "llava:latest",
    textModel: process.env.OLLAMA_TEXT_MODEL || "llama3.2:latest"
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o"
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
    imagePath: string, 
    preferredProvider?: AIProvider, 
    peopleContext?: Array<{
      name: string;
      ageInPhoto?: number | null;
      relationships: Array<{ type: string; otherPersonId: string }>;
      boundingBox: any;
    }>
  ): Promise<AIMetadata> {
    const provider = preferredProvider || this.config.provider;
    
    try {
      // Try OpenAI first if it's the preferred provider or available
      if ((provider === "openai" || provider === "both") && this.config.openai.apiKey) {
        logger.debug("Using OpenAI for image analysis", { hasApiKey: !!this.config.openai.apiKey });
        try {
          return await this.analyzeWithOpenAI(imagePath, peopleContext);
        } catch (openaiError: any) {
          logger.error("OpenAI analysis failed", openaiError);
          // Check if it's a quota/rate limit error
          if (openaiError?.status === 429 || openaiError?.code === 'insufficient_quota') {
            logger.warn("OpenAI quota exceeded, falling back to alternative processing");
          }
          // Continue to try Ollama if OpenAI fails
        }
      } else {
        logger.debug("OpenAI not available", { provider, hasApiKey: !!this.config.openai.apiKey });
      }

      // Try Ollama if OpenAI failed or if it's the preferred provider
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

      // Fallback to basic metadata
      logger.debug("No AI providers available, returning basic metadata");
      return this.generateBasicMetadata(imagePath, peopleContext);
    } catch (error) {
      logger.error("AI analysis failed", error);
      return this.generateBasicMetadata(imagePath, peopleContext);
    }
  }

  private async analyzeWithOllama(imagePath: string, peopleContext?: Array<{
    name: string;
    ageInPhoto?: number | null;
    relationships: Array<{ type: string; otherPersonId: string }>;
    boundingBox: any;
  }>): Promise<AIMetadata> {

      // Read and encode image to base64
      const imageBuffer = await fs.readFile(path.join(process.cwd(), 'data', imagePath));
      const base64Image = imageBuffer.toString('base64');

      // Create context string for known people
      const peopleContextStr = peopleContext && peopleContext.length > 0 
        ? `\n\nKNOWN PEOPLE IN THIS IMAGE:\n${peopleContext.map(person => 
            `- ${person.name}${person.ageInPhoto ? ` (age ${person.ageInPhoto} in this photo)` : ''}${
              person.relationships.length > 0 
                ? ` - relationships: ${person.relationships.map(r => r.type).join(', ')}` 
                : ''
            }`
          ).join('\n')}\n\nUse this information to enhance your analysis and descriptions. Consider the people's ages and relationships when describing the image context and generating tags.`
        : '';

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
- Return ONLY valid JSON, no additional text${peopleContextStr}`;

      const response = await fetch(`${this.config.ollama.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.ollama.visionModel,
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
  }

  private async analyzeWithOpenAI(imagePath: string, peopleContext?: Array<{
    name: string;
    ageInPhoto?: number | null;
    relationships: Array<{ type: string; otherPersonId: string }>;
    boundingBox: any;
  }>): Promise<AIMetadata> {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: this.config.openai.apiKey });

    // Read and encode image to base64
    const imageBuffer = await fs.readFile(path.join(process.cwd(), 'data', imagePath));
    const base64Image = imageBuffer.toString('base64');

    // Create context string for known people
    const peopleContextStr = peopleContext && peopleContext.length > 0 
      ? `\n\nKNOWN PEOPLE IN THIS IMAGE:\n${peopleContext.map(person => 
          `- ${person.name}${person.ageInPhoto ? ` (age ${person.ageInPhoto} in this photo)` : ''}${
            person.relationships.length > 0 
              ? ` - relationships: ${person.relationships.map(r => r.type).join(', ')}` 
              : ''
          }`
        ).join('\n')}\n\nUse this information to enhance your analysis and descriptions. Consider the people's ages and relationships when describing the image context and generating tags.`
      : '';

    const response = await openai.chat.completions.create({
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert image analysis AI. Analyze the provided image and return a JSON object with the following structure:
          {
            "aiTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
            "shortDescription": "Brief description under 100 characters",
            "longDescription": "Detailed description of the image content, scene, mood, and notable aspects",
            "detectedObjects": [{"name": "object_name", "confidence": 0.95, "boundingBox": [x,y,w,h]}],
            "detectedFaces": [{"faceId": "uuid", "personName": null, "confidence": 0.95, "boundingBox": [x,y,w,h]}],
            "detectedEvents": [{"eventType": "holiday", "eventName": "Christmas", "confidence": 0.9}],
            "placeName": "Location or place name if identifiable",
            "gpsCoordinates": {"latitude": 40.7128, "longitude": -74.0060},
            "aiConfidenceScores": {"tags": 0.9, "description": 0.85, "objects": 0.8, "faces": 0.7, "events": 0.6, "place": 0.7}
          }
          
          CRITICAL FACE DETECTION INSTRUCTIONS:
          - Only include detectedFaces if you can clearly see human faces in the image
          - Bounding box format: [x, y, width, height] where x,y is top-left corner
          - Coordinates must be in absolute pixels, not relative (0-1) values
          - Carefully locate the actual face area - head, eyes, nose, mouth - not clothing or background
          - Double-check coordinates point to actual faces before including them
          - If uncertain about face locations, omit detectedFaces entirely rather than guess
          - For people seen from behind or with obscured faces, do NOT include face detection
          
          For events, detect holidays, celebrations, activities, and life events. Generate unique faceIds but leave personName null.${peopleContextStr}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and provide comprehensive metadata in the specified JSON format. For face detection, be extremely careful about coordinate accuracy - only include faces you can clearly see and precisely locate. Verify each bounding box actually contains a human face before including it in the response."
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const aiResult = JSON.parse(response.choices[0].message.content || '{}');

    // Generate perceptual hash for similarity detection
    const perceptualHash = await this.generatePerceptualHash(imagePath);

    return {
      aiTags: Array.isArray(aiResult.aiTags) ? aiResult.aiTags.slice(0, 8) : [],
      shortDescription: aiResult.shortDescription || "OpenAI analysis unavailable",
      longDescription: aiResult.longDescription || "Detailed OpenAI analysis unavailable for this image.",
      detectedObjects: Array.isArray(aiResult.detectedObjects) ? aiResult.detectedObjects : [],
      detectedFaces: Array.isArray(aiResult.detectedFaces) ? aiResult.detectedFaces : [],
      detectedEvents: Array.isArray(aiResult.detectedEvents) ? aiResult.detectedEvents : [],
      placeName: aiResult.placeName || undefined,
      gpsCoordinates: aiResult.gpsCoordinates || undefined,
      perceptualHash: perceptualHash,
      aiConfidenceScores: aiResult.aiConfidenceScores || {
        tags: 0.8,
        description: 0.8,
        objects: 0.7,
        faces: 0.7,
        events: 0.6,
        place: 0.6
      }
    };
  }

  private async checkOllamaAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ollama.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error: any) {
      return false;
    }
  }

  private async generateBasicMetadata(imagePath: string, peopleContext?: Array<{
    name: string;
    ageInPhoto?: number | null;
    relationships: Array<{ type: string; otherPersonId: string }>;
    boundingBox: any;
  }>): Promise<AIMetadata> {
    // Extract basic info from filename and path
    const filename = path.basename(imagePath);
    const extension = path.extname(filename).toLowerCase();
    
    let tags = ["photo", "image"];
    let shortDescription = "Photo";
    let longDescription = "Basic metadata generated from filename.";
    
    // Enhanced classification with people context
    if (peopleContext && peopleContext.length > 0) {
      const peopleNames = peopleContext.map(p => p.name).join(", ");
      tags.push("people", "family");
      shortDescription = `Photo with ${peopleNames}`;
      
      // Add age-based tags
      if (peopleContext.some(p => p.ageInPhoto && p.ageInPhoto < 18)) {
        tags.push("children");
      }
      if (peopleContext.some(p => p.ageInPhoto && p.ageInPhoto >= 60)) {
        tags.push("elderly");
      }
      
      // Add relationship-based context
      const relationships = peopleContext.flatMap(p => p.relationships.map(r => r.type));
      if (relationships.includes("spouse") || relationships.includes("partner")) {
        tags.push("couple");
      }
      if (relationships.includes("parent") || relationships.includes("child")) {
        tags.push("family");
      }
      
      longDescription = `A photo featuring ${peopleNames}. ` +
        (peopleContext.some(p => p.ageInPhoto) 
          ? `Ages in photo: ${peopleContext.filter(p => p.ageInPhoto).map(p => `${p.name} (${p.ageInPhoto})`).join(", ")}. `
          : '') +
        `Metadata enhanced with known people information.`;
    } else {
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
      longDescription = "Basic metadata generated from filename. AI analysis requires OpenAI API key or Ollama to be running locally with a vision model like llava:latest.";
    }

    return {
      aiTags: tags,
      shortDescription,
      longDescription,
      detectedObjects: [],
      detectedFaces: [],
      detectedEvents: [],
      placeName: undefined,
      gpsCoordinates: undefined,
      perceptualHash: await this.generatePerceptualHash(imagePath),
      aiConfidenceScores: {
        tags: peopleContext && peopleContext.length > 0 ? 0.6 : 0.3,
        description: peopleContext && peopleContext.length > 0 ? 0.6 : 0.2,
        objects: 0.0,
        faces: 0.0,
        events: 0.0,
        place: 0.0
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
          shortDescription: shortDescription
        };
      }
      
      return metadata;
    } catch (error) {
      console.error("Failed to enhance metadata with short description:", error);
      return metadata;
    }
  }

  /**
   * Generate perceptual hash for visual similarity detection
   */
  async generatePerceptualHash(imagePath: string): Promise<string> {
    try {
      const fullPath = path.join(process.cwd(), 'data', imagePath);
      
      // Resize image to 8x8 grayscale and get average pixel value
      const { data, info } = await sharp(fullPath)
        .resize(8, 8)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // Calculate average pixel value
      const totalPixels = data.length;
      let sum = 0;
      for (let i = 0; i < totalPixels; i++) {
        sum += data[i];
      }
      const average = sum / totalPixels;
      
      // Generate hash: 1 if pixel > average, 0 otherwise
      let hash = '';
      for (let i = 0; i < totalPixels; i++) {
        hash += data[i] > average ? '1' : '0';
      }
      
      // Convert binary string to hex for compact storage
      let hexHash = '';
      for (let i = 0; i < hash.length; i += 4) {
        const binary = hash.substring(i, i + 4);
        hexHash += parseInt(binary, 2).toString(16);
      }
      
      return hexHash;
    } catch (error) {
      console.error("Failed to generate perceptual hash:", error);
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
      // Try Ollama first if available
      if ((provider === "ollama" || provider === "both") && await this.checkOllamaAvailability()) {
        const response = await fetch(`${this.config.ollama.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.config.ollama.textModel,
            prompt: `Generate 5-8 relevant tags for this image description. Return as JSON array of strings.

Description: ${description}

Return ONLY a JSON array like: ["tag1", "tag2", "tag3"]`,
            stream: false,
            format: "json"
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const result = JSON.parse(data.response || '[]');
          return Array.isArray(result) ? result.slice(0, 8) : this.extractTagsFromDescription(description);
        }
      }

      // Try OpenAI if available
      if ((provider === "openai" || provider === "both") && this.config.openai.apiKey) {
        const OpenAI = (await import("openai")).default;
        const openai = new OpenAI({ apiKey: this.config.openai.apiKey });
        
        const response = await openai.chat.completions.create({
          // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          model: "gpt-4o",
          messages: [
            { role: "system", content: "Generate 5-8 relevant tags for the given image description. Return as JSON array of strings." },
            { role: "user", content: `Generate tags for: ${description}` }
          ],
          response_format: { type: "json_object" },
          max_tokens: 200,
        });

        const result = JSON.parse(response.choices[0].message.content || '{"tags": []}');
        return Array.isArray(result.tags) ? result.tags.slice(0, 8) : this.extractTagsFromDescription(description);
      }

      return this.extractTagsFromDescription(description);
    } catch (error) {
      console.error("Tag generation failed:", error);
      return this.extractTagsFromDescription(description);
    }
  }

  async getAvailableProviders(): Promise<{ ollama: boolean; openai: boolean }> {
    const [ollamaAvailable] = await Promise.all([
      this.checkOllamaAvailability(),
    ]);
    
    return {
      ollama: ollamaAvailable,
      openai: !!this.config.openai.apiKey
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
