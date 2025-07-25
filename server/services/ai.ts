import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import type { AIMetadata } from "@shared/schema";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "sk-default-key"
});

class AIService {
  async analyzeImage(imagePath: string): Promise<AIMetadata> {
    try {
      // Read and encode image to base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert image analysis AI. Analyze the provided image and return a JSON object with the following structure:
            {
              "aiTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
              "shortDescription": "Brief description under 100 characters",
              "longDescription": "Detailed description of the image content, scene, mood, and notable aspects",
              "detectedObjects": [
                {
                  "name": "object_name",
                  "confidence": 0.95
                }
              ],
              "placeName": "Location or place name if identifiable",
              "aiConfidenceScores": {
                "tags": 0.9,
                "description": 0.85,
                "objects": 0.8,
                "place": 0.7
              }
            }

            Rules:
            - Provide 5-8 relevant tags describing the image content, style, mood, and setting
            - Keep short description under 100 characters
            - Make long description detailed and informative (200-500 characters)
            - Only include highly confident object detections (>0.7 confidence)
            - Only specify placeName if you can clearly identify a specific location
            - Provide confidence scores for each analysis type (0.0 to 1.0)
            - Focus on visual elements, composition, lighting, colors, and subject matter
            `
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
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const aiResult = JSON.parse(response.choices[0].message.content || '{}');

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
      
      // Return fallback metadata
      return {
        aiTags: ["photo", "image"],
        shortDescription: "AI analysis failed",
        longDescription: "Unable to analyze this image with AI. The image may be corrupted or in an unsupported format.",
        detectedObjects: [],
        aiConfidenceScores: {
          tags: 0.1,
          description: 0.1,
          objects: 0.0,
          place: 0.0
        }
      };
    }
  }

  async generateTags(description: string): Promise<string[]> {
    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Generate 5-8 relevant tags for the given image description. Return as JSON array of strings. Focus on content, style, mood, and visual elements."
          },
          {
            role: "user",
            content: `Generate tags for this image description: ${description}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{"tags": []}');
      return Array.isArray(result.tags) ? result.tags : [];
    } catch (error) {
      console.error("Tag generation failed:", error);
      return ["photo", "image"];
    }
  }
}

export const aiService = new AIService();
