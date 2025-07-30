import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface NamingContext {
  aiMetadata?: {
    shortDescription?: string;
    detectedObjects?: Array<{ name: string; confidence: number }>;
    aiTags?: string[];
  };
  exifMetadata?: {
    dateTime?: string;
    dateTimeOriginal?: string;
    createDate?: string;
    camera?: string;
    lens?: string;
  };
  originalFilename: string;
  tier: 'bronze' | 'silver' | 'gold';
}

export interface NamingPattern {
  id: string;
  name: string;
  description: string;
  pattern: string;
  example: string;
}

export const BUILTIN_NAMING_PATTERNS: NamingPattern[] = [
  {
    id: 'original',
    name: 'Keep Original',
    description: 'Preserve the original filename',
    pattern: '{originalFilename}',
    example: 'IMG_2023.jpg'
  },
  {
    id: 'datetime',
    name: 'Date & Time',
    description: 'YYYY-MM-DD_HH-mm-ss format',
    pattern: '{year}-{month}-{day}_{hour}-{minute}-{second}',
    example: '2024-07-26_14-30-25.jpg'
  },
  {
    id: 'datetime_camera',
    name: 'Date & Time + Camera',
    description: 'Date, time, and camera model',
    pattern: '{year}-{month}-{day}_{hour}-{minute}-{second}_{camera}',
    example: '2024-07-26_14-30-25_CanonEOSR5.jpg'
  },
  {
    id: 'ai_descriptive',
    name: 'AI Descriptive (Pictallion)',
    description: 'AI-generated description with date',
    pattern: '{year}-{month}-{day}_{aiDescription}',
    example: '2024-07-26_SunsetBeach.jpg'
  },
  {
    id: 'ai_detailed',
    name: 'AI Detailed (Pictallion)',
    description: 'Full AI description with time and camera',
    pattern: '{year}-{month}-{day}_{hour}-{minute}_{aiDescription}_{camera}',
    example: '2024-07-26_14-30_SunsetBeach_CanonEOSR5.jpg'
  }
];

/**
 * Generate a short AI description (2-3 words in PascalCase) for an image
 */
export async function generateAIShortDescription(base64Image: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Generate a very short 2-3 word description for this image in PascalCase format (e.g., SunsetBeach, FamilyDinner, MountainHike). 
          Focus on the main subject or scene. Be concise and descriptive. Respond with JSON format: {"description": "YourDescription"}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Generate a short PascalCase description for this image."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 50
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.description || 'UnknownImage';
  } catch (error) {
    console.error('Failed to generate AI description:', error);
    return 'UnknownImage';
  }
}

/**
 * Apply a naming pattern to generate a filename
 */
export function applyNamingPattern(pattern: string, context: NamingContext): string {
  let filename = pattern;
  
  // Extract date components from EXIF (prioritize dateTimeOriginal) or use current date
  let date = new Date();
  
  // Debug: Log the EXIF metadata to understand its structure
  console.log('EXIF metadata in naming:', JSON.stringify(context.exifMetadata, null, 2));
  
  if (context.exifMetadata?.dateTimeOriginal) {
    const parsedDate = new Date(context.exifMetadata.dateTimeOriginal);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate;
      console.log('Using EXIF dateTimeOriginal for naming:', date.toISOString());
    }
  } else if (context.exifMetadata?.createDate) {
    const parsedDate = new Date(context.exifMetadata.createDate);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate;
      console.log('Using EXIF createDate for naming:', date.toISOString());
    }
  } else if (context.exifMetadata?.dateTime) {
    const parsedDate = new Date(context.exifMetadata.dateTime);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate;
      console.log('Using EXIF dateTime for naming:', date.toISOString());
    }
  }
  
  // If no valid EXIF date found, try to extract from filename
  if (date.getTime() === new Date().getTime()) {
    const filename = context.originalFilename;
    const timestampMatch = filename.match(/^(\d{8})_(\d{6})/);
    if (timestampMatch) {
      const dateStr = timestampMatch[1]; // YYYYMMDD
      const timeStr = timestampMatch[2]; // HHMMSS
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(0, 2));
      const minute = parseInt(timeStr.substring(2, 4));
      const second = parseInt(timeStr.substring(4, 6));

      const extractedDate = new Date(year, month, day, hour, minute, second);
      if (!isNaN(extractedDate.getTime())) {
        date = extractedDate;
        console.log('Using filename timestamp for naming:', date.toISOString());
      }
    }
  }
  
  console.log('Final date used for naming pattern:', date.toISOString());
  
  // Replace date/time placeholders
  filename = filename.replace('{year}', date.getFullYear().toString());
  filename = filename.replace('{month}', (date.getMonth() + 1).toString().padStart(2, '0'));
  filename = filename.replace('{day}', date.getDate().toString().padStart(2, '0'));
  filename = filename.replace('{hour}', date.getHours().toString().padStart(2, '0'));
  filename = filename.replace('{minute}', date.getMinutes().toString().padStart(2, '0'));
  filename = filename.replace('{second}', date.getSeconds().toString().padStart(2, '0'));
  
  // Replace camera info
  const camera = context.exifMetadata?.camera?.replace(/\s+/g, '') || 'UnknownCamera';
  filename = filename.replace('{camera}', camera);
  
  // Replace lens info
  const lens = context.exifMetadata?.lens?.replace(/\s+/g, '') || 'UnknownLens';
  filename = filename.replace('{lens}', lens);
  
  // Replace AI description
  const aiDescription = context.aiMetadata?.shortDescription || 'UnknownImage';
  filename = filename.replace('{aiDescription}', aiDescription);
  
  // Replace original filename (without extension)
  const originalName = context.originalFilename.replace(/\.[^/.]+$/, '');
  filename = filename.replace('{originalFilename}', originalName);
  
  // Clean up any remaining placeholders or invalid characters
  filename = filename.replace(/[{}]/g, '');
  filename = filename.replace(/[<>:"/\\|?*]/g, '_');
  filename = filename.replace(/_+/g, '_');
  filename = filename.replace(/^_|_$/g, '');
  
  return filename;
}

/**
 * Generate filename based on current Silver tier naming settings
 */
export async function generateSilverFilename(
  context: NamingContext, 
  namingPattern: string
): Promise<string> {
  // Find the pattern or use custom
  const pattern = BUILTIN_NAMING_PATTERNS.find(p => p.id === namingPattern)?.pattern || namingPattern;
  
  // Apply the pattern
  const baseFilename = applyNamingPattern(pattern, context);
  
  // Add appropriate extension based on original file
  const extension = context.originalFilename.split('.').pop() || 'jpg';
  
  return `${baseFilename}.${extension}`;
}