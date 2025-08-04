from typing import Optional

from pydantic import BaseModel


class FileVersion(BaseModel):
    id: str
    file_path: str
    mime_type: Optional[str]
    metadata: Optional[dict]
