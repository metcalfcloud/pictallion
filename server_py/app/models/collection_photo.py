from typing import Optional

from pydantic import BaseModel


class CollectionPhoto(BaseModel):
    id: str
    collection_id: str
    photo_id: str
    description: Optional[str]
