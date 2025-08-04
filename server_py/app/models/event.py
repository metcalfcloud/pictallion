from typing import Optional

class Event:
    def __init__(self, id: int, description: Optional[str] = None):
        self.id = id
        self.description = description