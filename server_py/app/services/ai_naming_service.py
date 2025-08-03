"""
AI Naming Service for Pictallion

Handles intelligent filename generation using AI descriptions and various naming patterns.
Supports multiple naming patterns including AI-generated descriptions, date/time formatting,
and camera metadata integration.
"""

import json
import re
from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

import openai
from pydantic import BaseModel

from ..core.config import get_settings


class NamingContext(BaseModel):
    """Context information for generating filenames"""
    ai_metadata: Optional[Dict[str, Any]] = None
    exif_metadata: Optional[Dict[str, Any]] = None
    original_filename: str
    tier: str  # 'bronze', 'silver', or 'gold'


@dataclass
class NamingPattern:
    """Definition of a naming pattern"""
    id: str
    name: str
    description: str
    pattern: str
    example: str


# Built-in naming patterns
BUILTIN_NAMING_PATTERNS: List[NamingPattern] = [
    NamingPattern(
        id="original",
        name="Keep Original",
        description="Preserve the original filename",
        pattern="{originalFilename}",
        example="IMG_2023.jpg"
    ),
    NamingPattern(
        id="datetime",
        name="Date & Time",
        description="YYYY-MM-DD_HH-mm-ss format",
        pattern="{year}-{month}-{day}_{hour}-{minute}-{second}",
        example="2024-07-26_14-30-25.jpg"
    ),
    NamingPattern(
        id="datetime_camera",
        name="Date & Time + Camera",
        description="Date, time, and camera model",
        pattern="{year}-{month}-{day}_{hour}-{minute}-{second}_{camera}",
        example="2024-07-26_14-30-25_CanonEOSR5.jpg"
    ),
    NamingPattern(
        id="ai_descriptive",
        name="AI Descriptive (Pictallion)",
        description="AI-generated description with date",
        pattern="{year}-{month}-{day}_{aiDescription}",
        example="2024-07-26_SunsetBeach.jpg"
    ),
    NamingPattern(
        id="ai_detailed",
        name="AI Detailed (Pictallion)",
        description="Full AI description with time and camera",
        pattern="{year}-{month}-{day}_{hour}-{minute}_{aiDescription}_{camera}",
        example="2024-07-26_14-30_SunsetBeach_CanonEOSR5.jpg"
    )
]


class AINamingService:
    """Service for AI-powered filename generation"""
    
    def __init__(self):
        self.settings = get_settings()
        if self.settings.openai_api_key:
            openai.api_key = self.settings.openai_api_key
        
    async def generate_ai_short_description(self, base64_image: str) -> str:
        """
        Generate a short AI description (2-3 words in PascalCase) for an image
        
        Args:
            base64_image: Base64 encoded image data
            
        Returns:
            Short PascalCase description or 'UnknownImage' if generation fails
        """
        if not self.settings.openai_api_key:
            return "UnknownImage"
            
        try:
            response = await openai.ChatCompletion.acreate(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Generate a very short 2-3 word description for this image in PascalCase format "
                            "(e.g., SunsetBeach, FamilyDinner, MountainHike). "
                            "Focus on the main subject or scene. Be concise and descriptive. "
                            'Respond with JSON format: {"description": "YourDescription"}'
                        )
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Generate a short PascalCase description for this image."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=50
            )
            
            result = json.loads(response.choices[0].message.content or '{}')
            return result.get("description", "UnknownImage")
            
        except Exception as e:
            print(f"Failed to generate AI description: {e}")
            return "UnknownImage"
    
    def apply_naming_pattern(self, pattern: str, context: NamingContext) -> str:
        """
        Apply a naming pattern to generate a filename
        
        Args:
            pattern: The naming pattern string with placeholders
            context: Context information for filename generation
            
        Returns:
            Generated filename (without extension)
        """
        filename = pattern
        
        # Extract date components from EXIF (prioritize dateTimeOriginal) or use current date
        date = datetime.now()
        
        if context.exif_metadata:
            exif_date = None
            
            # Try different EXIF date fields in priority order
            for date_field in ['dateTimeOriginal', 'createDate', 'dateTime']:
                if date_field in context.exif_metadata and context.exif_metadata[date_field]:
                    try:
                        exif_date = datetime.fromisoformat(
                            str(context.exif_metadata[date_field]).replace(':', '-', 2)
                        )
                        break
                    except (ValueError, TypeError):
                        continue
            
            if exif_date:
                date = exif_date
        
        # If no valid EXIF date found, try to extract from filename
        if date == datetime.now():
            timestamp_match = re.match(r'^(\d{8})_(\d{6})', context.original_filename)
            if timestamp_match:
                try:
                    date_str = timestamp_match.group(1)  # YYYYMMDD
                    time_str = timestamp_match.group(2)  # HHMMSS
                    
                    year = int(date_str[:4])
                    month = int(date_str[4:6])
                    day = int(date_str[6:8])
                    hour = int(time_str[:2])
                    minute = int(time_str[2:4])
                    second = int(time_str[4:6])
                    
                    extracted_date = datetime(year, month, day, hour, minute, second)
                    date = extracted_date
                except (ValueError, IndexError):
                    pass
        
        # Replace date/time placeholders
        filename = filename.replace('{year}', str(date.year))
        filename = filename.replace('{month}', f"{date.month:02d}")
        filename = filename.replace('{day}', f"{date.day:02d}")
        filename = filename.replace('{hour}', f"{date.hour:02d}")
        filename = filename.replace('{minute}', f"{date.minute:02d}")
        filename = filename.replace('{second}', f"{date.second:02d}")
        
        # Replace camera info
        camera = "UnknownCamera"
        if context.exif_metadata and context.exif_metadata.get('camera'):
            camera = re.sub(r'\s+', '', str(context.exif_metadata['camera']))
        filename = filename.replace('{camera}', camera)
        
        # Replace lens info
        lens = "UnknownLens"
        if context.exif_metadata and context.exif_metadata.get('lens'):
            lens = re.sub(r'\s+', '', str(context.exif_metadata['lens']))
        filename = filename.replace('{lens}', lens)
        
        # Replace AI description
        ai_description = "UnknownImage"
        if (context.ai_metadata and 
            context.ai_metadata.get('shortDescription')):
            ai_description = context.ai_metadata['shortDescription']
        filename = filename.replace('{aiDescription}', ai_description)
        
        # Replace original filename (without extension)
        original_name = re.sub(r'\.[^/.]+$', '', context.original_filename)
        filename = filename.replace('{originalFilename}', original_name)
        
        # Clean up any remaining placeholders or invalid characters
        filename = re.sub(r'[{}]', '', filename)
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        filename = re.sub(r'_+', '_', filename)
        filename = filename.strip('_')
        
        return filename
    
    async def generate_silver_filename(
        self, 
        context: NamingContext, 
        naming_pattern: str
    ) -> str:
        """
        Generate filename based on current Silver tier naming settings
        
        Args:
            context: Context information for filename generation
            naming_pattern: The naming pattern ID or custom pattern string
            
        Returns:
            Complete filename with extension
        """
        # Find the pattern or use custom
        pattern = naming_pattern
        for builtin_pattern in BUILTIN_NAMING_PATTERNS:
            if builtin_pattern.id == naming_pattern:
                pattern = builtin_pattern.pattern
                break
        
        # Apply the pattern
        base_filename = self.apply_naming_pattern(pattern, context)
        
        # Add appropriate extension based on original file
        extension = context.original_filename.split('.')[-1] if '.' in context.original_filename else 'jpg'
        
        return f"{base_filename}.{extension}"
    
    def get_builtin_naming_patterns(self) -> List[Dict[str, str]]:
        """
        Get all built-in naming patterns
        
        Returns:
            List of naming pattern dictionaries
        """
        return [
            {
                "id": pattern.id,
                "name": pattern.name,
                "description": pattern.description,
                "pattern": pattern.pattern,
                "example": pattern.example
            }
            for pattern in BUILTIN_NAMING_PATTERNS
        ]
    
    def validate_naming_pattern(self, pattern: str) -> bool:
        """
        Validate a naming pattern string
        
        Args:
            pattern: The pattern string to validate
            
        Returns:
            True if pattern is valid, False otherwise
        """
        # Check for balanced braces
        open_braces = pattern.count('{')
        close_braces = pattern.count('}')
        
        if open_braces != close_braces:
            return False
        
        # Check for valid placeholders
        valid_placeholders = {
            'year', 'month', 'day', 'hour', 'minute', 'second',
            'camera', 'lens', 'aiDescription', 'originalFilename'
        }
        
        # Extract all placeholders
        placeholders = re.findall(r'\{([^}]+)\}', pattern)
        
        # Check if all placeholders are valid
        for placeholder in placeholders:
            if placeholder not in valid_placeholders:
                return False
        
        return True


# Global service instance
ai_naming_service = AINamingService()


async def generate_ai_short_description(base64_image: str) -> str:
    """Generate a short AI description for an image"""
    return await ai_naming_service.generate_ai_short_description(base64_image)


def apply_naming_pattern(pattern: str, context: NamingContext) -> str:
    """Apply a naming pattern to generate a filename"""
    return ai_naming_service.apply_naming_pattern(pattern, context)


async def generate_silver_filename(context: NamingContext, naming_pattern: str) -> str:
    """Generate filename based on Silver tier naming settings"""
    return await ai_naming_service.generate_silver_filename(context, naming_pattern)


def get_builtin_naming_patterns() -> List[Dict[str, str]]:
    """Get all built-in naming patterns"""
    return ai_naming_service.get_builtin_naming_patterns()


def validate_naming_pattern(pattern: str) -> bool:
    """Validate a naming pattern string"""
    return ai_naming_service.validate_naming_pattern(pattern)