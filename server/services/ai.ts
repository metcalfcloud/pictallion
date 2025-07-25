import fs from "fs/promises";
import path from "path";
import type { AIMetadata } from "@shared/schema";

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
    const provider = preferredProvider || this.config.provider;
    
    try {
      // Try OpenAI first if it's the preferred provider or available
      if ((provider === "openai" || provider === "both") && this.config.openai.apiKey) {
        console.log("Using OpenAI for image analysis with API key:", this.config.openai.apiKey ? "present" : "missing");
        try {
          return await this.analyzeWithOpenAI(imagePath);
        } catch (openaiError) {
          console.error("OpenAI analysis failed:", openaiError);
          // Continue to try Ollama if OpenAI fails
        }
      } else {
        console.log("OpenAI not available - provider:", provider, "apiKey:", this.config.openai.apiKey ? "present" : "missing");
      }

      // Try Ollama if OpenAI failed or if it's the preferred provider
      if (provider === "ollama" || provider === "both") {
        const isOllamaAvailable = await this.checkOllamaAvailability();
        if (isOllamaAvailable) {
          console.log("Using Ollama for image analysis");
          return await this.analyzeWithOllama(imagePath);
        } else if (provider === "ollama") {
          console.log("Ollama not available, falling back to basic metadata");
          return this.generateBasicMetadata(imagePath);
        }
      }

      // Fallback to basic metadata
      console.log("No AI providers available, returning basic metadata");
      return this.generateBasicMetadata(imagePath);
    } catch (error) {
      console.error("AI analysis failed:", error);
      return this.generateBasicMetadata(imagePath);
    }
  }

  private async analyzeWithOllama(imagePath: string): Promise<AIMetadata> {

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

  private async analyzeWithOpenAI(imagePath: string): Promise<AIMetadata> {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: this.config.openai.apiKey });

    // Read and encode image to base64
    const imageBuffer = await fs.readFile(path.join(process.cwd(), 'data', imagePath));
    const base64Image = imageBuffer.toString('base64');

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
            "detectedObjects": [{"name": "object_name", "confidence": 0.95}],
            "placeName": "Location or place name if identifiable",
            "aiConfidenceScores": {"tags": 0.9, "description": 0.85, "objects": 0.8, "place": 0.7}
          }`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and provide detailed metadata in the specified JSON format."
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const aiResult = JSON.parse(response.choices[0].message.content || '{}');

    return {
      aiTags: Array.isArray(aiResult.aiTags) ? aiResult.aiTags.slice(0, 8) : [],
      shortDescription: aiResult.shortDescription || "OpenAI analysis unavailable",
      longDescription: aiResult.longDescription || "Detailed OpenAI analysis unavailable for this image.",
      detectedObjects: Array.isArray(aiResult.detectedObjects) ? aiResult.detectedObjects : [],
      placeName: aiResult.placeName || undefined,
      aiConfidenceScores: aiResult.aiConfidenceScores || {
        tags: 0.8,
        description: 0.8,
        objects: 0.7,
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
