import { z } from "zod";

// AI Prompt Configuration Schema
export const aiPromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['analysis', 'naming', 'description']),
  provider: z.enum(['openai', 'ollama', 'both']),
  systemPrompt: z.string(),
  userPrompt: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type AIPrompt = z.infer<typeof aiPromptSchema>;

// Default prompts for out-of-the-box functionality
export const DEFAULT_PROMPTS: AIPrompt[] = [
  {
    id: 'openai-image-analysis',
    name: 'OpenAI Image Analysis',
    description: 'Comprehensive image analysis for family photos with warm, natural descriptions',
    category: 'analysis',
    provider: 'openai',
    systemPrompt: `You are an expert family photo analyst. Create warm, natural descriptions perfect for a family album. When people are identified, write descriptions as if this is a cherished family memory.

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

For events, detect holidays, celebrations, activities, and life events.`,
    userPrompt: `Analyze this family photo and provide comprehensive metadata in the specified JSON format. Focus on creating warm, natural descriptions that would be perfect for a family album. For face detection, be extremely careful about coordinate accuracy.`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ollama-image-analysis',
    name: 'Ollama Image Analysis',
    description: 'Local image analysis optimized for family photos',
    category: 'analysis',
    provider: 'ollama',
    systemPrompt: `Analyze this image and provide detailed metadata optimized for family photo management in JSON format:
{
  "aiTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "shortDescription": "Brief description under 100 characters",
  "longDescription": "Warm family-friendly description of the image",
  "detectedObjects": [{"name": "object_name", "confidence": 0.95}],
  "placeName": "Location or place name if identifiable",
  "aiConfidenceScores": {"tags": 0.9, "description": 0.85, "objects": 0.8, "place": 0.7}
}

Rules:
- Write descriptions as family memories, not technical analysis
- Use warm, natural language appropriate for a family album
- Provide 5-8 relevant tags describing content, mood, and setting
- Keep short description under 100 characters
- Make long description warm and detailed (200-500 characters)
- Focus on emotions, relationships, and special moments
- Only include highly confident object detections (>0.7 confidence)
- Only specify placeName if you can clearly identify a specific location
- Return ONLY valid JSON, no additional text`,
    userPrompt: `Please analyze this family photo and provide warm, natural metadata in the specified JSON format.`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'openai-short-description',
    name: 'OpenAI Short Description Generator',
    description: 'Generates concise 2-3 word descriptions for file naming using OpenAI',
    category: 'naming',
    provider: 'openai',
    systemPrompt: `Generate a very short 2-3 word description for this image in PascalCase format (e.g., SunsetBeach, FamilyDinner, MountainHike). 

Focus on the main subject or scene. Be concise and descriptive. For family photos, use names when known or general terms like FamilyTime, PlayDate, etc.

Respond with JSON format: {"description": "YourDescription"}`,
    userPrompt: `Generate a short PascalCase description for this image perfect for file naming.`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ollama-short-description',
    name: 'Ollama Short Description Generator',
    description: 'Generates concise 2-3 word descriptions for file naming using local Ollama',
    category: 'naming',
    provider: 'ollama',
    systemPrompt: `Generate a very short 2-3 word description for this image in PascalCase format (e.g., SunsetBeach, FamilyDinner, MountainHike). 

Focus on the main subject or scene. Be concise and descriptive. For family photos, use names when known or general terms like FamilyTime, PlayDate, etc.

Return ONLY the description in JSON format: {"description": "YourDescription"}
No additional text or explanations.`,
    userPrompt: `Generate a short PascalCase description for this image perfect for file naming.`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'family-description-generator',
    name: 'Family Description Generator',
    description: 'Creates natural family album descriptions when people are identified',
    category: 'description',
    provider: 'both',
    systemPrompt: `You are creating descriptions for a family photo album. Write warm, natural descriptions that capture the moment and relationships.

Guidelines:
- Write as if describing a cherished family memory
- Use natural, conversational language
- Include ages naturally when provided (e.g., "3-year-old Ellie", "Ellie at age 3")
- Describe activities, emotions, or special moments when visible
- For relationships, weave them naturally into the description
- Avoid technical or robotic language
- Keep descriptions between 50-150 characters for main description
- Create longer detailed descriptions (200-400 characters) when requested

Example good descriptions:
- "A precious moment with Ellie and her grandparents in the garden"
- "Birthday celebration - Kim and Paul with little Ellie enjoying cake"
- "Family beach day with the whole crew having fun in the sun"
- "Quiet afternoon reading time with Mom and the kids"`,
    userPrompt: `Create a warm, natural family album description for this photo using the provided people information.`,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Prompt categories for organization
export const PROMPT_CATEGORIES = {
  analysis: 'Image Analysis',
  naming: 'File Naming',
  description: 'Description Generation'
} as const;

// Helper function to get default prompt by category and provider
export function getDefaultPrompt(category: string, provider: 'openai' | 'ollama' | 'both'): AIPrompt | undefined {
  return DEFAULT_PROMPTS.find(p => 
    p.category === category && 
    (p.provider === provider || p.provider === 'both') &&
    p.isDefault
  );
}

// Helper function to get all prompts for a category
export function getPromptsForCategory(category: string): AIPrompt[] {
  return DEFAULT_PROMPTS.filter(p => p.category === category);
}