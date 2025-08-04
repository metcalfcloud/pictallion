from pydantic import BaseModel
from typing import Optional

class FileVersion(BaseModel):
    id: str
    file_path: str
    mime_type: Optional[str]
    metadata: Optional[dict]