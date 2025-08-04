from typing import Optional

from pydantic import BaseModel


class Collection(BaseModel):
    id: str
    name: str
    description: Optional[str]
