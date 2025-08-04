"""
Prompt Management Service for Pictallion

Manages AI prompts with caching, CRUD operations, and initialization of default prompts.
Provides a singleton pattern for centralized prompt management across the application.
"""

import asyncio
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from ..core.config import settings
from ..core.database import get_async_session
from ..models.ai_prompt import AIPrompt, AIPromptCreate, AIPromptUpdate

# Default prompts configuration - these would typically come from a shared module
DEFAULT_PROMPTS = [
    {
        "name": "Image Analysis - OpenAI",
        "description": "Analyze images with OpenAI GPT-4 Vision",
        "category": "analysis",
        "provider": "openai",
        "system_prompt": """You are an expert family photo analyst. Create warm, natural descriptions perfect for a family album. When people are identified, write descriptions as if this is a cherished family memory.

Focus on:
- Main subjects and their activities
- Setting and atmosphere
- Emotions and relationships visible
- Important objects or details
- Time of day/lighting if notable

Be specific but concise. Use family-friendly language.""",
        "user_prompt": "Analyze this image and describe what you see, focusing on the people, setting, and mood.",
        "is_default": True,
        "is_active": True,
    },
    {
        "name": "Image Analysis - Ollama",
        "description": "Analyze images with Ollama local models",
        "category": "analysis",
        "provider": "ollama",
        "system_prompt": """Analyze this image and provide detailed metadata in JSON format:
{
  "description": "Brief description of the image",
  "objects": ["list", "of", "detected", "objects"],
  "people": ["list", "of", "people", "if", "any"],
  "setting": "indoor/outdoor/studio/etc",
  "mood": "happy/serious/casual/formal/etc",
  "colors": ["dominant", "colors"],
  "tags": ["relevant", "tags"]
}""",
        "user_prompt": "Analyze this image and provide structured metadata.",
        "is_default": True,
        "is_active": True,
    },
    {
        "name": "Family Description",
        "description": "Generate family-friendly descriptions",
        "category": "family",
        "provider": "both",
        "system_prompt": """Create warm, natural descriptions for family photos. Focus on relationships, emotions, and memorable moments. Use language that would be appropriate in a family album or scrapbook.""",
        "user_prompt": "Describe this family moment in a warm, natural way.",
        "is_default": True,
        "is_active": True,
    },
    {
        "name": "Object Detection",
        "description": "Detect and identify objects in images",
        "category": "objects",
        "provider": "both",
        "system_prompt": """Identify and list all significant objects, items, and elements visible in the image. Be specific but practical - focus on objects that would be useful for searching and organizing photos.""",
        "user_prompt": "What objects and items can you see in this image?",
        "is_default": True,
        "is_active": True,
    },
]

PROMPT_CATEGORIES = [
    {
        "id": "analysis",
        "name": "Image Analysis",
        "description": "General image analysis and description",
    },
    {
        "id": "family",
        "name": "Family Photos",
        "description": "Family-focused descriptions and analysis",
    },
    {
        "id": "objects",
        "name": "Object Detection",
        "description": "Object and item identification",
    },
    {
        "id": "events",
        "name": "Event Detection",
        "description": "Event and occasion identification",
    },
    {
        "id": "locations",
        "name": "Location Analysis",
        "description": "Location and setting analysis",
    },
]


class PromptManagementService:
    """Service for managing AI prompts with caching and CRUD operations"""

    _instance: Optional["PromptManagementService"] = None
    _initialized = False

    def __new__(cls) -> "PromptManagementService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "_prompt_cache"):
            return
        self._prompt_cache: Dict[str, AIPrompt] = {}
        self._settings = settings

    @classmethod
    def get_instance(cls) -> "PromptManagementService":
        """Get singleton instance of the prompt management service"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def initialize(self) -> None:
        """Initialize the prompt management service"""
        if self._initialized:
            return

        try:
            async with get_async_session() as session:
                # Check if we have any prompts in the database
                result = await session.execute(select(AIPrompt))
                existing_prompts = result.scalars().all()

                if not existing_prompts:
                    print("Initializing default AI prompts...")
                    await self._initialize_default_prompts(session)

                # Cache all prompts
                await self._refresh_cache(session)
                self._initialized = True
                print("Prompt management service initialized successfully")
        except Exception as e:
            print(f"Failed to initialize prompt management service: {e}")
            raise e

    async def _initialize_default_prompts(self, session: AsyncSession) -> None:
        """Initialize default prompts in the database"""
        for prompt_data in DEFAULT_PROMPTS:
            try:
                prompt = AIPrompt(**prompt_data)
                session.add(prompt)
                await session.commit()
                await session.refresh(prompt)
            except Exception as e:
                print(f"Failed to create default prompt {prompt_data['name']}: {e}")
                await session.rollback()

    async def _refresh_cache(self, session: Optional[AsyncSession] = None) -> None:
        """Refresh the prompt cache from database"""
        try:
            if session is None:
                async with get_async_session() as session:
                    await self._refresh_cache(session)
                    return

            # Get active prompts
            result = await session.execute(
                select(AIPrompt).where(AIPrompt.is_active == True)
            )
            prompts = result.scalars().all()

            self._prompt_cache.clear()

            for prompt in prompts:
                # Cache by category-provider key
                key = f"{prompt.category}-{prompt.provider}"
                self._prompt_cache[key] = prompt

                # Also cache by ID for easy lookup
                self._prompt_cache[prompt.id] = prompt

        except Exception as e:
            print(f"Failed to refresh prompt cache: {e}")

    async def get_prompt(self, category: str, provider: str) -> Optional[AIPrompt]:
        """
        Get a prompt by category and provider

        Args:
            category: The prompt category (e.g., 'analysis', 'family')
            provider: The AI provider (e.g., 'openai', 'ollama', 'both')

        Returns:
            AIPrompt object or None if not found
        """
        await self.initialize()

        # First try exact match
        key = f"{category}-{provider}"
        prompt = self._prompt_cache.get(key)

        if not prompt and provider != "both":
            # Try with 'both' provider
            key = f"{category}-both"
            prompt = self._prompt_cache.get(key)

        if not prompt:
            # Fallback to database query
            try:
                async with get_async_session() as session:
                    result = await session.execute(
                        select(AIPrompt).where(
                            AIPrompt.category == category,
                            AIPrompt.provider.in_([provider, "both"]),
                            AIPrompt.is_active == True,
                        )
                    )
                    prompts = result.scalars().all()

                    # Prefer active prompts, then any prompt
                    prompt = next((p for p in prompts if p.is_active), None)
                    if not prompt and prompts:
                        prompt = prompts[0]

            except Exception as e:
                print(f"Failed to fetch prompt from database: {e}")
                return None

        return prompt

    async def get_prompt_by_id(self, prompt_id: str) -> Optional[AIPrompt]:
        """
        Get a prompt by its ID

        Args:
            prompt_id: The prompt ID

        Returns:
            AIPrompt object or None if not found
        """
        await self.initialize()

        prompt = self._prompt_cache.get(prompt_id)
        if not prompt:
            try:
                async with get_async_session() as session:
                    result = await session.execute(
                        select(AIPrompt).where(AIPrompt.id == prompt_id)
                    )
                    prompt = result.scalar_one_or_none()
            except Exception as e:
                print(f"Failed to fetch prompt by ID: {e}")
                return None

        return prompt

    async def create_prompt(self, prompt_data: AIPromptCreate) -> Optional[AIPrompt]:
        """
        Create a new AI prompt

        Args:
            prompt_data: The prompt creation data

        Returns:
            Created AIPrompt object or None if creation failed
        """
        try:
            async with get_async_session() as session:
                prompt = AIPrompt(**prompt_data.model_dump())
                session.add(prompt)
                await session.commit()
                await session.refresh(prompt)

                await self._refresh_cache()
                return prompt
        except Exception as e:
            print(f"Failed to create prompt: {e}")
            return None

    async def update_prompt(
        self, prompt_id: str, updates: AIPromptUpdate
    ) -> Optional[AIPrompt]:
        """
        Update an existing AI prompt

        Args:
            prompt_id: The prompt ID to update
            updates: The update data

        Returns:
            Updated AIPrompt object or None if update failed
        """
        try:
            async with get_async_session() as session:
                result = await session.execute(
                    select(AIPrompt).where(AIPrompt.id == prompt_id)
                )
                prompt = result.scalar_one_or_none()

                if not prompt:
                    return None

                # Apply updates
                update_data = updates.model_dump(exclude_unset=True)
                for field, value in update_data.items():
                    setattr(prompt, field, value)

                await session.commit()
                await session.refresh(prompt)

                await self._refresh_cache()
                return prompt
        except Exception as e:
            print(f"Failed to update prompt: {e}")
            return None

    async def delete_prompt(self, prompt_id: str) -> bool:
        """
        Delete an AI prompt

        Args:
            prompt_id: The prompt ID to delete

        Returns:
            True if deleted successfully, False otherwise
        """
        try:
            async with get_async_session() as session:
                result = await session.execute(
                    select(AIPrompt).where(AIPrompt.id == prompt_id)
                )
                prompt = result.scalar_one_or_none()

                if not prompt:
                    return False

                await session.delete(prompt)
                await session.commit()

                await self._refresh_cache()
                return True
        except Exception as e:
            print(f"Failed to delete prompt: {e}")
            return False

    async def get_prompts_by_category(self, category: str) -> List[AIPrompt]:
        """
        Get all prompts for a specific category

        Args:
            category: The prompt category

        Returns:
            List of AIPrompt objects
        """
        await self.initialize()

        try:
            async with get_async_session() as session:
                result = await session.execute(
                    select(AIPrompt).where(AIPrompt.category == category)
                )
                return result.scalars().all()
        except Exception as e:
            print(f"Failed to get prompts by category: {e}")
            return []

    async def get_prompts_by_provider(self, provider: str) -> List[AIPrompt]:
        """
        Get all prompts for a specific provider

        Args:
            provider: The AI provider

        Returns:
            List of AIPrompt objects
        """
        await self.initialize()

        try:
            async with get_async_session() as session:
                result = await session.execute(
                    select(AIPrompt).where(AIPrompt.provider == provider)
                )
                return result.scalars().all()
        except Exception as e:
            print(f"Failed to get prompts by provider: {e}")
            return []

    async def get_all_prompts(self) -> List[AIPrompt]:
        """
        Get all AI prompts

        Returns:
            List of all AIPrompt objects
        """
        await self.initialize()

        try:
            async with get_async_session() as session:
                result = await session.execute(select(AIPrompt))
                return result.scalars().all()
        except Exception as e:
            print(f"Failed to get all prompts: {e}")
            return []

    async def get_active_prompts(self) -> List[AIPrompt]:
        """
        Get all active AI prompts

        Returns:
            List of active AIPrompt objects
        """
        await self.initialize()

        try:
            async with get_async_session() as session:
                result = await session.execute(
                    select(AIPrompt).where(AIPrompt.is_active == True)
                )
                return result.scalars().all()
        except Exception as e:
            print(f"Failed to get active prompts: {e}")
            return []

    async def reset_to_defaults(self) -> bool:
        """
        Reset all prompts to default configuration

        Returns:
            True if reset successfully, False otherwise
        """
        try:
            async with get_async_session() as session:
                # Delete all existing prompts
                await session.execute("DELETE FROM ai_prompts")

                # Insert default prompts
                for prompt_data in DEFAULT_PROMPTS:
                    prompt = AIPrompt(**prompt_data)
                    session.add(prompt)

                await session.commit()
                await self._refresh_cache()
                return True
        except Exception as e:
            print(f"Failed to reset prompts to defaults: {e}")
            return False

    async def generate_family_description(
        self, people_context: List[Dict[str, Any]]
    ) -> str:
        """
        Generate a family-friendly description based on people context

        Args:
            people_context: List of people with their details and relationships

        Returns:
            Generated family description
        """
        if not people_context:
            return "A beautiful family moment captured in time."

        names = [person.get("name", "Unknown") for person in people_context]
        ages = [
            f"{person['name']} ({person['ageInPhoto']})"
            for person in people_context
            if person.get("ageInPhoto")
        ]

        # Create a natural description
        description = f"A wonderful moment with {', '.join(names)}"

        if ages:
            description += f" - ages: {', '.join(ages)}"

        # Add relationship context
        relationships = []
        for person in people_context:
            relationships.extend(
                [rel.get("type", "") for rel in person.get("relationships", [])]
            )

        if "parent" in relationships or "child" in relationships:
            description += ". A precious family gathering"
        elif "spouse" in relationships or "partner" in relationships:
            description += ". A special time together"

        return description + "."

    def get_default_prompts(self) -> List[Dict[str, Any]]:
        """Get the default prompts configuration"""
        return DEFAULT_PROMPTS.copy()

    def get_prompt_categories(self) -> List[Dict[str, str]]:
        """Get available prompt categories"""
        return PROMPT_CATEGORIES.copy()


# Global service instance
prompt_management_service = PromptManagementService.get_instance()


# Convenience functions for backward compatibility
async def get_prompt(category: str, provider: str) -> Optional[AIPrompt]:
    """Get a prompt by category and provider"""
    return await prompt_management_service.get_prompt(category, provider)


async def get_prompt_by_id(prompt_id: str) -> Optional[AIPrompt]:
    """Get a prompt by its ID"""
    return await prompt_management_service.get_prompt_by_id(prompt_id)


async def create_prompt(prompt_data: AIPromptCreate) -> Optional[AIPrompt]:
    """Create a new AI prompt"""
    return await prompt_management_service.create_prompt(prompt_data)


async def update_prompt(prompt_id: str, updates: AIPromptUpdate) -> Optional[AIPrompt]:
    """Update an existing AI prompt"""
    return await prompt_management_service.update_prompt(prompt_id, updates)


async def delete_prompt(prompt_id: str) -> bool:
    """Delete an AI prompt"""
    return await prompt_management_service.delete_prompt(prompt_id)


async def get_prompts_by_category(category: str) -> List[AIPrompt]:
    """Get all prompts for a specific category"""
    return await prompt_management_service.get_prompts_by_category(category)


async def reset_prompts_to_defaults() -> bool:
    """Reset all prompts to default configuration"""
    return await prompt_management_service.reset_to_defaults()


async def generate_family_description(people_context: List[Dict[str, Any]]) -> str:
    """Generate a family-friendly description"""
    return await prompt_management_service.generate_family_description(people_context)
