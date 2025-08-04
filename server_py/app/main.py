"""
FastAPI Application Entry Point

Main application setup with middleware, CORS, error handling, and route registration.
"""

import logging
import sys
import time
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Dict, Any

import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import db_manager

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format=settings.log_format,
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("app.log") if settings.is_production else logging.NullHandler()
    ]
)

logger = logging.getLogger(__name__)

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:
    """
    Application lifespan manager for startup and shutdown events.
    """
    # Startup
    logger.info("Starting Pictallion Python Backend...")
    
    try:
        # Initialize database
        await db_manager.initialize()
        logger.info("Database initialized successfully")
        
        # Perform health checks
        db_health = await db_manager.health_check()
        logger.info(f"Database health: {db_health}")
        
        logger.info("Application startup completed")
        
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Pictallion Python Backend...")
    # Add any cleanup operations here
    logger.info("Application shutdown completed")


# Create FastAPI application
app = FastAPI(
    title="Pictallion Python Backend",
    description="Advanced photo management backend with AI processing capabilities",
    version=settings.app_version,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    openapi_url="/openapi.json" if settings.is_development else None,
    lifespan=lifespan
)

# Add rate limiting
app.state.limiter = limiter
def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> Any:
    return _rate_limit_exceeded_handler(request, exc)

app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_credentials,
    allow_methods=settings.cors_methods,
    allow_headers=settings.cors_headers,
)

# Add trusted host middleware for production
if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]  # Configure with actual allowed hosts in production
    )


# Custom exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors."""
    logger.warning(f"Validation error on {request.url}: {exc}")
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation Error",
            "detail": exc.errors(),
            "path": str(request.url)
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions."""
    logger.warning(f"HTTP error {exc.status_code} on {request.url}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url)
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle general exceptions."""
    logger.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred",
            "path": str(request.url)
        }
    )


# Middleware for request logging
@app.middleware("http")
async def log_requests(request: Request, call_next) -> Any:
    """Log all requests for debugging."""
    start_time = time.time()
    
    # Log request
    logger.info(f"Request: {request.method} {request.url}")
    
    # Process request
    response = await call_next(request)
    
    # Log response
    process_time = time.time() - start_time
    logger.info(
        f"Response: {response.status_code} - {process_time:.3f}s"
    )
    
    # Add process time header
    response.headers["X-Process-Time"] = str(process_time)
    
    return response


# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint for monitoring application status.
    
    Returns:
        dict: Application health status
    """
    try:
        # Check database health
        db_health = await db_manager.health_check()
        
        # Overall health status
        is_healthy = db_health.get("database") == "healthy"
        
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "version": settings.app_version,
            "environment": settings.environment,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {
                "database": db_health,
                "ai_services": {
                    "ollama_configured": bool(settings.ollama_base_url),
                    "openai_configured": bool(settings.openai_api_key),
                    "preferred_provider": settings.ai_provider
                }
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# System info endpoint
@app.get("/api/system/info", tags=["System"])
@limiter.limit("10/minute")
async def system_info(request: Request) -> Dict[str, Any]:
    """
    Get system information and statistics.
    
    Returns:
        dict: System information
    """
    try:
        db_stats = await db_manager.get_stats()
        
        return {
            "application": {
                "name": settings.app_name,
                "version": settings.app_version,
                "environment": settings.environment,
                "debug": settings.debug
            },
            "database": db_stats,
            "configuration": {
                "ai_provider": settings.ai_provider,
                "max_file_size": settings.max_file_size,
                "allowed_file_types": settings.allowed_file_extensions,
                "features": {
                    "ai_processing": settings.enable_ai_processing,
                    "face_detection": settings.enable_face_detection,
                    "duplicate_detection": settings.enable_duplicate_detection,
                    "burst_detection": settings.enable_burst_detection
                }
            }
        }
    except Exception as e:
        logger.error(f"Error getting system info: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving system information")


# Root endpoint
@app.get("/", tags=["System"])
async def root() -> Dict[str, Any]:
    """Root endpoint with basic application information."""
    return {
        "message": "Pictallion Python Backend",
        "version": settings.app_version,
        "docs": "/docs" if settings.is_development else "Documentation disabled in production",
        "health": "/health"
    }


# Import and register API routes
from app.api.photo_routes import router as photo_router
from app.api.collection_routes import router as collection_router
from app.api.file_routes import router as file_router
from app.api.people_routes import router as people_router
from app.api.ai_routes import router as ai_router
from app.api.face_routes import router as face_router
from app.api.search_routes import router as search_router
from app.api.event_routes import router as event_router

# Register routers
app.include_router(photo_router)
app.include_router(collection_router)
app.include_router(file_router)
app.include_router(people_router)
app.include_router(ai_router)
app.include_router(face_router)
app.include_router(search_router)
app.include_router(event_router)


def create_app() -> FastAPI:
    """
    Application factory function.
    
    Returns:
        FastAPI: Configured FastAPI application
    """
    return app


def run_server() -> None:
    """Run the development server."""
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_development,
        log_level=settings.log_level.lower(),
        workers=1 if settings.is_development else settings.max_workers
    )


def main() -> None:
    """Main entry point for the application."""
    if len(sys.argv) > 1 and sys.argv[1] == "server":
        run_server()
    else:
        print("Pictallion Python Backend")
        print(f"Version: {settings.app_version}")
        print("Use 'python -m app.main server' to start the development server")


if __name__ == "__main__":
    main()