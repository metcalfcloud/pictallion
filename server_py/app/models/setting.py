from typing import Optional

class Setting:
    def __init__(self, key: str, value: Optional[str] = None):
        self.key = key
        self.value = value