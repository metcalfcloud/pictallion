from pydantic import BaseModel
from typing import Optional

class CollectionPhoto(BaseModel):
    id: str
    collection_id: str
    photo_id: str
    description: Optional[str]