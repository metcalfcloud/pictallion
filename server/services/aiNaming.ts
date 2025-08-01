import OpenAI from "openai";
import { error } from "@shared/logger";

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
}

export interface NamingPattern {
}

export const BUILTIN_NAMING_PATTERNS: NamingPattern[] = [
  {
  },
  {
  },
  {
  },
  {
  },
  {
  }
];

/**
 * Generate a short AI description (2-3 words in PascalCase) for an image
 */
export async function generateAIShortDescription(base64Image: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
        {
          Focus on the main subject or scene. Be concise and descriptive. Respond with JSON format: {"description": "YourDescription"}`
        },
        {
            {
            },
            {
              }
            }
          ]
        }
      ],
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.description || 'UnknownImage';
  } catch (err) {
    error('Failed to generate AI description', "AINaming", { error: err });
    return 'UnknownImage';
  }
}

/**
 * Apply a naming pattern to generate a filename
 */
export function applyNamingPattern(pattern: string, context: NamingContext): string {
  let filename = pattern;
  
  let date = new Date();
  
  if (context.exifMetadata?.dateTimeOriginal) {
    const parsedDate = new Date(context.exifMetadata.dateTimeOriginal);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate;
    }
  } else if (context.exifMetadata?.createDate) {
    const parsedDate = new Date(context.exifMetadata.createDate);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate;
    }
  } else if (context.exifMetadata?.dateTime) {
    const parsedDate = new Date(context.exifMetadata.dateTime);
    if (!isNaN(parsedDate.getTime())) {
      date = parsedDate;
    }
  }
  
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
      }
    }
  }
  
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
  
  const aiDescription = context.aiMetadata?.shortDescription || 'UnknownImage';
  filename = filename.replace('{aiDescription}', aiDescription);
  
  // Replace original filename (without extension)
  const originalName = context.originalFilename.replace(/\.[^/.]+$/, '');
  filename = filename.replace('{originalFilename}', originalName);
  
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
): Promise<string> {
  const pattern = BUILTIN_NAMING_PATTERNS.find(p => p.id === namingPattern)?.pattern || namingPattern;
  
  const baseFilename = applyNamingPattern(pattern, context);
  
  const extension = context.originalFilename.split('.').pop() || 'jpg';
  
  return `${baseFilename}.${extension}`;
}