"""
Configuration Management

Handles environment variables and application settings using Pydantic Settings.
Maps environment variables from .env.example to Python backend configuration.
"""

from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings with environment variable mapping.
    
    Maps TypeScript backend environment variables to Python equivalents
    while maintaining compatibility with existing .env configuration.
    """
    
    # Application Info
    app_name: str = "Pictallion Python Backend"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Server Configuration
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    
    # Database Configuration
    # Maps from NODE_ENV and DB_TYPE to determine database setup
    environment: str = Field(default="development", alias="NODE_ENV")
    db_type: str = Field(default="sqlite", alias="DB_TYPE")
    database_url: str = Field(
        default="sqlite:///./data/pictallion.db", 
        alias="DATABASE_URL"
    )
    
    # AI Provider Configuration
    # Maps AI_PROVIDER from TypeScript backend
    ai_provider: str = Field(default="ollama", alias="AI_PROVIDER")
    
    # Ollama Configuration
    ollama_base_url: str = Field(
        default="http://localhost:11434", 
        alias="OLLAMA_BASE_URL"
    )
    ollama_model: str = Field(default="llava:latest", alias="OLLAMA_MODEL")
    ollama_text_model: str = Field(
        default="llama3.2:latest", 
        alias="OLLAMA_TEXT_MODEL"
    )
    
    # OpenAI Configuration
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o", alias="OPENAI_MODEL")
    
    # File Storage Configuration
    # Default paths matching the existing structure
    media_base_path: str = "./data/media"
    uploads_path: str = "./uploads/temp"
    thumbnails_path: str = "./uploads/thumbnails"
    
    # File Upload Configuration
    max_file_size: str = Field(default="50MB", alias="MAX_FILE_SIZE")
    allowed_file_types: str = Field(
        default="jpg,jpeg,png,gif,webp", 
        alias="ALLOWED_FILE_TYPES"
    )
    
    # Security Configuration
    secret_key: str = Field(
        default="your-secret-key-change-in-production", 
        alias="SESSION_SECRET"
    )
    
    # CORS Configuration
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ]
    cors_credentials: bool = True
    cors_methods: List[str] = ["*"]
    cors_headers: List[str] = ["*"]
    
    # Logging Configuration
    log_level: str = Field(default="info", alias="LOG_LEVEL")
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # AI Processing Configuration
    face_recognition_tolerance: float = 0.6
    face_recognition_model: str = "hog"  # or "cnn" for GPU
    thumbnail_sizes: List[int] = [150, 300, 600, 1200]
    
    # Performance Configuration
    max_workers: int = 4
    chunk_size: int = 8192
    max_concurrent_uploads: int = 5
    
    # Feature Flags
    enable_ai_processing: bool = True
    enable_face_detection: bool = True
    enable_duplicate_detection: bool = True
    enable_burst_detection: bool = True
    
    # Development Configuration
    reload: bool = False
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"
    
    @property
    def is_sqlite(self) -> bool:
        """Check if using SQLite database."""
        return self.db_type.lower() == "sqlite"
    
    @property
    def is_postgres(self) -> bool:
        """Check if using PostgreSQL database."""
        return self.db_type.lower() == "postgres"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.environment.lower() == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment.lower() == "production"
    
    @property
    def allowed_file_extensions(self) -> List[str]:
        """Get list of allowed file extensions."""
        return [ext.strip().lower() for ext in self.allowed_file_types.split(",")]
    
    @property
    def max_file_size_bytes(self) -> int:
        """Convert max file size string to bytes."""
        size_str = self.max_file_size.upper()
        if size_str.endswith("MB"):
            return int(size_str[:-2]) * 1024 * 1024
        elif size_str.endswith("GB"):
            return int(size_str[:-2]) * 1024 * 1024 * 1024
        elif size_str.endswith("KB"):
            return int(size_str[:-2]) * 1024
        else:
            return int(size_str)
    
    def get_database_url(self) -> str:
        """Get the appropriate database URL based on configuration."""
        if self.is_sqlite:
            return f"sqlite+aiosqlite:///{self.database_url.replace('sqlite:///', '')}"
        elif self.is_postgres:
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://")
        else:
            return self.database_url


# Global settings instance
settings = Settings()
def get_settings():
    # Stub for settings getter
    return {}
def get_settings():
    return Settings()