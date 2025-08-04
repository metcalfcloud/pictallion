from typing import Optional
from pydantic import BaseModel

class AIPrompt(BaseModel):
    id: str
    name: str
    description: Optional[str]
    category: str
    provider: str
    system_prompt: str
    user_prompt: str
    is_default: bool
    is_active: bool
    created_at: str
    updated_at: str

class AIPromptCreate(BaseModel):
    name: str
    description: Optional[str]
    category: str
    provider: str
    system_prompt: str
    user_prompt: str
    is_default: bool = False
    is_active: bool = True

class AIPromptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    provider: Optional[str] = None
    system_prompt: Optional[str] = None
    user_prompt: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None