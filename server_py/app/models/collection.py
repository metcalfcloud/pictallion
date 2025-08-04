from pydantic import BaseModel
from typing import Optional

class Collection(BaseModel):
    id: str
    name: str
    description: Optional[str]