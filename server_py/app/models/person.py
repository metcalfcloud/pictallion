from typing import Optional

class Person:
    def __init__(self, id: int, name: Optional[str] = None):
        self.id = id
        self.name = name