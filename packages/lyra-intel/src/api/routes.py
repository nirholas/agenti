"""
API Routes - Route definitions for the REST API.

Provides a FastAPI-style router for organizing endpoints.
"""

from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
import functools
import logging

logger = logging.getLogger(__name__)


@dataclass
class Route:
    """Route definition."""
    path: str
    method: str
    handler: Callable
    description: str = ""
    tags: List[str] = field(default_factory=list)
    auth_required: bool = False


class Router:
    """
    API Router for organizing endpoints.
    
    Provides decorators for defining routes similar to FastAPI/Flask.
    """
    
    def __init__(self, prefix: str = ""):
        self.prefix = prefix
        self.routes: List[Route] = []
    
    def get(self, path: str, description: str = "", tags: List[str] = None, auth_required: bool = False):
        """Decorator for GET endpoints."""
        def decorator(func: Callable):
            self.routes.append(Route(
                path=self.prefix + path,
                method="GET",
                handler=func,
                description=description,
                tags=tags or [],
                auth_required=auth_required,
            ))
            return func
        return decorator
    
    def post(self, path: str, description: str = "", tags: List[str] = None, auth_required: bool = False):
        """Decorator for POST endpoints."""
        def decorator(func: Callable):
            self.routes.append(Route(
                path=self.prefix + path,
                method="POST",
                handler=func,
                description=description,
                tags=tags or [],
                auth_required=auth_required,
            ))
            return func
        return decorator
    
    def put(self, path: str, description: str = "", tags: List[str] = None, auth_required: bool = False):
        """Decorator for PUT endpoints."""
        def decorator(func: Callable):
            self.routes.append(Route(
                path=self.prefix + path,
                method="PUT",
                handler=func,
                description=description,
                tags=tags or [],
                auth_required=auth_required,
            ))
            return func
        return decorator
    
    def delete(self, path: str, description: str = "", tags: List[str] = None, auth_required: bool = False):
        """Decorator for DELETE endpoints."""
        def decorator(func: Callable):
            self.routes.append(Route(
                path=self.prefix + path,
                method="DELETE",
                handler=func,
                description=description,
                tags=tags or [],
                auth_required=auth_required,
            ))
            return func
        return decorator
    
    def include_router(self, router: 'Router'):
        """Include routes from another router."""
        for route in router.routes:
            self.routes.append(Route(
                path=self.prefix + route.path,
                method=route.method,
                handler=route.handler,
                description=route.description,
                tags=route.tags,
                auth_required=route.auth_required,
            ))
    
    def get_openapi_spec(self) -> Dict[str, Any]:
        """Generate OpenAPI specification."""
        paths = {}
        
        for route in self.routes:
            if route.path not in paths:
                paths[route.path] = {}
            
            paths[route.path][route.method.lower()] = {
                "summary": route.description,
                "tags": route.tags,
                "responses": {
                    "200": {"description": "Successful response"},
                    "400": {"description": "Bad request"},
                    "500": {"description": "Internal server error"},
                },
            }
        
        return {
            "openapi": "3.0.0",
            "info": {
                "title": "Lyra Intel API",
                "description": "Intelligence Infrastructure Engine API",
                "version": "0.1.0",
            },
            "paths": paths,
        }


# Create main router
router = Router(prefix="/api/v1")


# Define standard routes
@router.get("/health", description="Health check", tags=["system"])
def health_check():
    return {"status": "healthy"}


@router.get("/status", description="System status", tags=["system"])
def system_status():
    return {"status": "running", "version": "0.1.0"}


# Analysis routes
analysis_router = Router(prefix="/analysis")


@analysis_router.post("", description="Start analysis", tags=["analysis"])
def start_analysis(body: Dict):
    return {"status": "started"}


@analysis_router.get("/{id}", description="Get analysis status", tags=["analysis"])
def get_analysis(analysis_id: str):
    return {"id": analysis_id, "status": "pending"}


router.include_router(analysis_router)


# Repository routes
repo_router = Router(prefix="/repositories")


@repo_router.get("", description="List repositories", tags=["repositories"])
def list_repositories():
    return {"repositories": []}


@repo_router.post("", description="Add repository", tags=["repositories"])
def add_repository(body: Dict):
    return {"status": "added"}


router.include_router(repo_router)
