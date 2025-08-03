"""
AI Service

Handles AI-powered image analysis using OpenAI and Ollama APIs.
Provides image tagging, description generation, and content analysis.
Converts TypeScript AIService to Python with equivalent functionality.
"""

import logging
import asyncio
import json
import base64
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import httpx
from PIL import Image
import aiofiles

from app.core.config import settings
from app.models.schemas import AIMetadata

logger = logging.getLogger(__name__)


@dataclass
class PersonContext:
    """Context information about people in photos."""
    name: str
    age_in_photo: Optional[int] = None
    relationships: List[Dict[str, str]] = None
    bounding_box: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.relationships is None:
            self.relationships = []


@dataclass
class AIConfig:
    """AI service configuration."""
    provider: str
    ollama: Dict[str, str]
    openai: Dict[str, str]


class AIService:
    """
    Service for AI-powered image analysis and processing.
    
    Supports both OpenAI and Ollama providers with automatic fallback
    and comprehensive image analysis capabilities.
    """
    
    def __init__(self):
        self.config = AIConfig(
            provider=settings.ai_provider,
            ollama={
                "base_url": settings.ollama_base_url,
                "vision_model": settings.ollama_model,
                "text_model": settings.ollama_text_model
            },
            openai={
                "api_key": settings.openai_api_key or "",
                "model": settings.openai_model
            }
        )
        
        self.data_dir = Path(settings.media_base_path).parent
        self.openai_client = None
        
        # Initialize OpenAI client if API key is provided
        if self.config.openai["api_key"]:
            try:
                import openai
                self.openai_client = openai.AsyncOpenAI(api_key=self.config.openai["api_key"])
            except ImportError:
                logger.warning("OpenAI library not available")
    
    def set_config(self, config: Dict[str, Any]) -> None:
        """Update AI service configuration."""
        if "provider" in config:
            self.config.provider = config["provider"]
        if "ollama" in config:
            self.config.ollama.update(config["ollama"])
        if "openai" in config:
            self.config.openai.update(config["openai"])
    
    def get_config(self) -> Dict[str, Any]:
        """Get current AI service configuration."""
        return {
            "provider": self.config.provider,
            "ollama": self.config.ollama,
            "openai": {
                "api_key": bool(self.config.openai["api_key"]),  # Don't expose actual key
                "model": self.config.openai["model"]
            }
        }
    
    async def analyze_image(
        self,
        image_path: str,
        preferred_provider: Optional[str] = None
    ) -> AIMetadata:
        """
        Analyze an image using the configured AI provider.
        
        Args:
            image_path: Path to the image file
            preferred_provider: Optional preferred provider override
            
        Returns:
            AIMetadata: Analysis results including tags, descriptions, and confidence scores
        """
        return await self.analyze_image_with_people_context(image_path, preferred_provider, [])
    
    async def analyze_image_with_people_context(
        self,
        image_path: str,
        preferred_provider: Optional[str] = None,
        people_context: Optional[List[PersonContext]] = None
    ) -> AIMetadata:
        """
        Analyze an image with additional context about people in the photo.
        
        Args:
            image_path: Path to the image file
            preferred_provider: Optional preferred provider override
            people_context: Context about people in the photo
            
        Returns:
            AIMetadata: Comprehensive analysis results
        """
        provider = preferred_provider or self.config.provider
        people_context = people_context or []
        
        try:
            # Try OpenAI first if it's the preferred provider or available
            if (provider in ["openai", "both"] and self.config.openai["api_key"]):
                logger.debug("Using OpenAI for image analysis")
                try:
                    return await self._analyze_with_openai(image_path, people_context)
                except Exception as e:
                    logger.error(f"OpenAI analysis failed: {e}")
                    # Check for quota/rate limit errors
                    if "429" in str(e) or "quota" in str(e).lower():
                        logger.warning("OpenAI quota exceeded, falling back to alternative processing")
            else:
                logger.debug(f"OpenAI not available - provider: {provider}, has_key: {bool(self.config.openai['api_key'])}")
            
            # Try Ollama if OpenAI failed or if it's the preferred provider
            if provider in ["ollama", "both"]:
                is_available = await self._check_ollama_availability()
                if is_available:
                    logger.debug("Using Ollama for image analysis")
                    return await self._analyze_with_ollama(image_path, people_context)
                elif provider == "ollama":
                    logger.debug("Ollama not available, falling back to basic metadata")
                    return await self._generate_basic_metadata(image_path, people_context)
            
            # Fallback to basic metadata
            logger.debug("No AI providers available, returning basic metadata")
            return await self._generate_basic_metadata(image_path, people_context)
            
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return await self._generate_basic_metadata(image_path, people_context)
    
    async def _analyze_with_openai(self, image_path: str, people_context: List[PersonContext]) -> AIMetadata:
        """Analyze image using OpenAI GPT-4 Vision."""
        if not self.openai_client:
            raise Exception("OpenAI client not initialized")
        
        # Read and encode image
        full_path = self.data_dir / image_path
        async with aiofiles.open(full_path, 'rb') as f:
            image_data = await f.read()
        
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Create people context string
        people_context_str = ""
        if people_context:
            people_list = []
            for person in people_context:
                person_str = person.name
                if person.age_in_photo:
                    person_str += f" (age {person.age_in_photo} in this photo)"
                if person.relationships:
                    rel_types = [r.get("type", "") for r in person.relationships]
                    if rel_types:
                        person_str += f" - relationships: {', '.join(rel_types)}"
                people_list.append(f"- {person_str}")
            
            people_context_str = f"\n\nKNOWN PEOPLE IN THIS IMAGE:\n{chr(10).join(people_list)}\n\nUse this information to enhance your analysis and descriptions. Consider the people's ages and relationships when describing the image context and generating tags."
        
        # System prompt for comprehensive analysis
        system_prompt = f"""You are an expert family photo analyst. Create warm, natural descriptions perfect for a family album. When people are identified, write descriptions as if this is a cherished family memory.

Analyze the image and return a JSON object with this structure:
{{
  "aiTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "shortDescription": "Brief description under 100 characters",
  "longDescription": "Warm, natural description perfect for a family album",
  "detectedObjects": [{{"name": "object_name", "confidence": 0.95, "boundingBox": [x,y,w,h]}}],
  "detectedFaces": [{{"faceId": "uuid", "personName": null, "confidence": 0.95, "boundingBox": [x,y,w,h]}}],
  "detectedEvents": [{{"eventType": "holiday", "eventName": "Christmas", "confidence": 0.9}}],
  "placeName": "Location or place name if identifiable",
  "gpsCoordinates": {{"latitude": 40.7128, "longitude": -74.0060}},
  "aiConfidenceScores": {{"tags": 0.9, "description": 0.85, "objects": 0.8, "faces": 0.7, "events": 0.6, "place": 0.7}}
}}

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

For events, detect holidays, celebrations, activities, and life events.{people_context_str}"""
        
        user_prompt = "Analyze this family photo and provide comprehensive metadata in the specified JSON format. Focus on creating warm, natural descriptions that would be perfect for a family album."
        
        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                            }
                        ]
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=1500,
            )
            
            ai_result = json.loads(response.choices[0].message.content or '{}')
            
            # Generate perceptual hash
            perceptual_hash = await self._generate_perceptual_hash(image_path)
            
            return AIMetadata(
                ai_tags=ai_result.get("aiTags", [])[:8],
                short_description=ai_result.get("shortDescription", "OpenAI analysis unavailable"),
                long_description=ai_result.get("longDescription", "Detailed OpenAI analysis unavailable for this image."),
                detected_objects=ai_result.get("detectedObjects", []),
                detected_faces=ai_result.get("detectedFaces", []),
                detected_events=ai_result.get("detectedEvents", []),
                place_name=ai_result.get("placeName"),
                gps_coordinates=ai_result.get("gpsCoordinates"),
                perceptual_hash=perceptual_hash,
                ai_confidence_scores=ai_result.get("aiConfidenceScores", {
                    "tags": 0.8,
                    "description": 0.8,
                    "objects": 0.7,
                    "faces": 0.7,
                    "events": 0.6,
                    "place": 0.6
                })
            )
            
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}")
            raise
    
    async def _analyze_with_ollama(self, image_path: str, people_context: List[PersonContext]) -> AIMetadata:
        """Analyze image using Ollama local AI."""
        # Read and encode image
        full_path = self.data_dir / image_path
        async with aiofiles.open(full_path, 'rb') as f:
            image_data = await f.read()
        
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Create people context string
        people_context_str = ""
        if people_context:
            people_list = []
            for person in people_context:
                person_str = person.name
                if person.age_in_photo:
                    person_str += f" (age {person.age_in_photo} in this photo)"
                if person.relationships:
                    rel_types = [r.get("type", "") for r in person.relationships]
                    if rel_types:
                        person_str += f" - relationships: {', '.join(rel_types)}"
                people_list.append(f"- {person_str}")
            
            people_context_str = f"\n\nKNOWN PEOPLE IN THIS IMAGE:\n{chr(10).join(people_list)}\n\nUse this information to enhance your analysis and descriptions. Consider the people's ages and relationships when describing the image context and generating tags."
        
        # System prompt for Ollama
        system_prompt = f"""Analyze this image and provide detailed metadata in JSON format:
{{
  "aiTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "shortDescription": "Brief description under 100 characters",
  "longDescription": "Warm family-friendly description of the image",
  "detectedObjects": [{{"name": "object_name", "confidence": 0.95}}],
  "placeName": "Location or place name if identifiable",
  "aiConfidenceScores": {{"tags": 0.9, "description": 0.85, "objects": 0.8, "place": 0.7}}
}}

Rules:
- Write descriptions as family memories, not technical analysis
- Use warm, natural language appropriate for a family album
- Provide 5-8 relevant tags describing content, mood, and setting
- Keep short description under 100 characters
- Make long description warm and detailed (200-500 characters)
- Focus on emotions, relationships, and special moments
- Only include highly confident object detections (>0.7 confidence)
- Only specify placeName if you can clearly identify a specific location
- Return ONLY valid JSON, no additional text{people_context_str}"""
        
        user_prompt = "Please analyze this family photo and provide warm, natural metadata in the specified JSON format."
        full_prompt = system_prompt + "\n\n" + user_prompt
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.config.ollama['base_url']}/api/generate",
                    json={
                        "model": self.config.ollama["vision_model"],
                        "prompt": full_prompt,
                        "images": [base64_image],
                        "stream": False,
                        "format": "json"
                    }
                )
                
                if not response.is_success:
                    raise Exception(f"Ollama API error: {response.status_code}")
                
                data = response.json()
                ai_result = json.loads(data.get("response", "{}"))
                
                return AIMetadata(
                    ai_tags=ai_result.get("aiTags", [])[:8],
                    short_description=ai_result.get("shortDescription", "AI analysis unavailable"),
                    long_description=ai_result.get("longDescription", "Detailed AI analysis unavailable for this image."),
                    detected_objects=ai_result.get("detectedObjects", []),
                    place_name=ai_result.get("placeName"),
                    perceptual_hash=await self._generate_perceptual_hash(image_path),
                    ai_confidence_scores=ai_result.get("aiConfidenceScores", {
                        "tags": 0.5,
                        "description": 0.5,
                        "objects": 0.5,
                        "place": 0.0
                    })
                )
                
        except Exception as e:
            logger.error(f"Ollama API call failed: {e}")
            raise
    
    async def _check_ollama_availability(self) -> bool:
        """Check if Ollama service is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.config.ollama['base_url']}/api/tags")
                return response.is_success
        except Exception:
            return False
    
    async def _generate_basic_metadata(self, image_path: str, people_context: List[PersonContext]) -> AIMetadata:
        """Generate basic metadata when AI providers are unavailable."""
        filename = Path(image_path).name
        
        tags = ["photo", "image"]
        short_description = "Photo"
        long_description = "A moment captured in time."
        
        # Enhanced classification with people context
        if people_context:
            people_names = [p.name for p in people_context]
            display_names = (
                ", ".join(people_names) if len(people_names) <= 3
                else f"{', '.join(people_names[:2])} and {len(people_names) - 2} others"
            )
            
            tags.extend(["people", "family"])
            
            # Create natural descriptions
            if len(people_names) == 1:
                short_description = f"A special moment with {people_names[0]}"
            elif len(people_names) == 2:
                short_description = f"{' and '.join(people_names)} together"
            else:
                short_description = f"Family time with {display_names}"
            
            # Add age-based tags
            children = [p for p in people_context if p.age_in_photo and p.age_in_photo < 13]
            teens = [p for p in people_context if p.age_in_photo and 13 <= p.age_in_photo < 18]
            adults = [p for p in people_context if p.age_in_photo and 18 <= p.age_in_photo < 60]
            seniors = [p for p in people_context if p.age_in_photo and p.age_in_photo >= 60]
            
            if children:
                tags.extend(["children", "family-time"])
            if teens:
                tags.append("teenagers")
            if adults:
                tags.append("adults")
            if seniors:
                tags.extend(["grandparents", "generations"])
            
            # Add relationship-based context
            all_relationships = []
            for person in people_context:
                all_relationships.extend([r.get("type", "") for r in person.relationships])
            
            if "spouse" in all_relationships or "partner" in all_relationships:
                tags.extend(["couple", "love"])
            if "parent" in all_relationships or "child" in all_relationships:
                tags.extend(["family", "bonding"])
            if "sibling" in all_relationships:
                tags.extend(["siblings", "family"])
            
            # Create warm long description
            long_description = f"A wonderful family moment captured with {display_names}."
            
            # Add age context if available
            aged_people = [p for p in people_context if p.age_in_photo]
            if aged_people and len(aged_people) <= 4:
                ages_info = [f"{p.name} ({p.age_in_photo})" for p in aged_people]
                long_description += f" Everyone captured beautifully - {', '.join(ages_info)}."
        else:
            # Basic classification based on filename
            filename_lower = filename.lower()
            if "portrait" in filename_lower:
                tags.extend(["portrait", "person"])
                short_description = "Portrait photograph"
                long_description = "A beautiful portrait capturing a special moment."
            elif "landscape" in filename_lower:
                tags.extend(["landscape", "outdoor", "nature"])
                short_description = "Landscape photograph"
                long_description = "A scenic landscape view captured with care."
            elif "food" in filename_lower:
                tags.extend(["food", "cuisine"])
                short_description = "Food photograph"
                long_description = "Delicious food captured to remember the moment."
            else:
                tags.extend(["photography", "memories"])
                short_description = "Digital photograph"
                long_description = "A photograph preserving a meaningful moment. Enhanced AI analysis available with OpenAI API key or local Ollama vision model."
        
        return AIMetadata(
            ai_tags=tags[:8],
            short_description=short_description,
            long_description=long_description,
            detected_objects=[],
            detected_faces=[],
            detected_events=[],
            perceptual_hash=await self._generate_perceptual_hash(image_path),
            ai_confidence_scores={
                "tags": 0.7 if people_context else 0.4,
                "description": 0.8 if people_context else 0.3,
                "objects": 0.0,
                "faces": 0.0,
                "events": 0.0,
                "place": 0.0
            }
        )
    
    async def _generate_perceptual_hash(self, image_path: str) -> str:
        """Generate perceptual hash for visual similarity detection."""
        try:
            def _sync_generate_hash():
                """Synchronous hash generation for thread pool."""
                full_path = self.data_dir / image_path
                
                # Resize to 8x8 grayscale and calculate hash
                with Image.open(full_path) as img:
                    # Convert to grayscale and resize
                    img = img.convert('L').resize((8, 8), Image.Resampling.LANCZOS)
                    pixels = list(img.getdata())
                
                # Calculate average pixel value
                avg = sum(pixels) / len(pixels)
                
                # Generate hash: 1 if pixel > average, 0 otherwise
                hash_bits = ''.join('1' if p > avg else '0' for p in pixels)
                
                # Convert binary to hex
                hex_hash = ''
                for i in range(0, len(hash_bits), 4):
                    binary = hash_bits[i:i+4]
                    hex_hash += format(int(binary, 2), 'x')
                
                return hex_hash
            
            # Run in thread pool
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, _sync_generate_hash)
            
        except Exception as e:
            logger.error(f"Failed to generate perceptual hash: {e}")
            return "0000000000000000"  # fallback hash
    
    def calculate_hash_similarity(self, hash1: str, hash2: str) -> int:
        """Calculate similarity between two perceptual hashes (0-100)."""
        if len(hash1) != len(hash2):
            return 0
        
        differences = sum(c1 != c2 for c1, c2 in zip(hash1, hash2))
        similarity = (1 - differences / len(hash1)) * 100
        return round(similarity)
    
    async def generate_tags(self, description: str, preferred_provider: Optional[str] = None) -> List[str]:
        """
        Generate tags from a description.
        
        Args:
            description: Text description to generate tags from
            preferred_provider: Optional preferred provider
            
        Returns:
            list: Generated tags
        """
        provider = preferred_provider or self.config.provider
        
        try:
            # Try Ollama first if available
            if provider in ["ollama", "both"] and await self._check_ollama_availability():
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await client.post(
                        f"{self.config.ollama['base_url']}/api/generate",
                        json={
                            "model": self.config.ollama["text_model"],
                            "prompt": f"Generate 5-8 relevant tags for this image description. Return as JSON array of strings.\n\nDescription: {description}\n\nReturn ONLY a JSON array like: [\"tag1\", \"tag2\", \"tag3\"]",
                            "stream": False,
                            "format": "json"
                        }
                    )
                    
                    if response.is_success:
                        data = response.json()
                        result = json.loads(data.get("response", "[]"))
                        if isinstance(result, list):
                            return result[:8]
            
            # Try OpenAI if available
            if provider in ["openai", "both"] and self.openai_client:
                response = await self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "Generate 5-8 relevant tags for the given image description. Return as JSON array of strings."},
                        {"role": "user", "content": f"Generate tags for: {description}"}
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=200,
                )
                
                result = json.loads(response.choices[0].message.content or '{"tags": []}')
                if isinstance(result.get("tags"), list):
                    return result["tags"][:8]
            
            # Fallback to simple extraction
            return self._extract_tags_from_description(description)
            
        except Exception as e:
            logger.error(f"Tag generation failed: {e}")
            return self._extract_tags_from_description(description)
    
    def _extract_tags_from_description(self, description: str) -> List[str]:
        """Extract tags from description using simple text processing."""
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'}
        
        words = description.lower()
        # Remove punctuation and split
        import re
        words = re.sub(r'[^\w\s]', ' ', words)
        words = [w for w in words.split() if len(w) > 2 and w not in common_words]
        
        return words[:6] if words else ["photo", "image"]
    
    async def get_available_providers(self) -> Dict[str, bool]:
        """Get availability status of AI providers."""
        ollama_available = await self._check_ollama_availability()
        
        return {
            "ollama": ollama_available,
            "openai": bool(self.config.openai["api_key"])
        }
    
    async def enhance_metadata_with_short_description(self, metadata: AIMetadata, image_path: str) -> AIMetadata:
        """
        Enhance metadata with AI-generated short description for naming.
        
        Args:
            metadata: Existing metadata
            image_path: Path to image file
            
        Returns:
            AIMetadata: Enhanced metadata with short description
        """
        try:
            # Only generate if using OpenAI
            if self.config.openai["api_key"] and self.config.provider in ["openai", "both"]:
                # This would integrate with AI naming service
                # For now, return metadata as-is
                pass
            
            return metadata
            
        except Exception as e:
            logger.error(f"Failed to enhance metadata with short description: {e}")
            return metadata
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check the health of AI services.
        
        Returns:
            dict: Health status of AI providers
        """
        try:
            providers = await self.get_available_providers()
            
            # Test basic functionality
            can_generate_hash = True
            try:
                # Test hash generation with dummy data
                test_hash = await self._generate_perceptual_hash("test")
            except Exception:
                can_generate_hash = False
            
            status = "healthy" if (providers["openai"] or providers["ollama"]) else "degraded"
            
            return {
                "status": status,
                "providers": providers,
                "config": {
                    "provider": self.config.provider,
                    "ollama_url": self.config.ollama["base_url"],
                    "openai_configured": bool(self.config.openai["api_key"])
                },
                "functionality": {
                    "can_generate_hash": can_generate_hash,
                    "can_analyze_images": providers["openai"] or providers["ollama"]
                }
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "providers": {"openai": False, "ollama": False},
                "functionality": {"can_generate_hash": False, "can_analyze_images": False}
            }


# Global AI service instance
ai_service = AIService()