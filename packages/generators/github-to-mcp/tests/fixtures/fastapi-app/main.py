"""
Sample FastAPI application for testing
"""
from fastapi import FastAPI, Query, Path, Body, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(
    title="Test API",
    description="A sample API for testing",
    version="1.0.0"
)


# Pydantic models
class UserCreate(BaseModel):
    name: str
    email: str
    age: Optional[int] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    age: Optional[int] = None


class PostCreate(BaseModel):
    title: str
    content: str
    author_id: str


class PostResponse(BaseModel):
    id: str
    title: str
    content: str
    author_id: str


# User endpoints
@app.get("/users", tags=["Users"], summary="List all users")
async def list_users(
    skip: int = Query(0, description="Number of records to skip"),
    limit: int = Query(10, description="Maximum number of records to return"),
) -> List[UserResponse]:
    """
    Retrieve a paginated list of users.
    
    Returns all users with optional pagination parameters.
    """
    return []


@app.get("/users/{user_id}", tags=["Users"], summary="Get user by ID")
async def get_user(
    user_id: str = Path(..., description="The unique user identifier"),
) -> UserResponse:
    """
    Retrieve a specific user by their ID.
    """
    return UserResponse(id=user_id, name="Test", email="test@example.com")


@app.post("/users", tags=["Users"], summary="Create new user", status_code=201)
async def create_user(user: UserCreate) -> UserResponse:
    """
    Create a new user account.
    """
    return UserResponse(id="123", **user.model_dump())


@app.put("/users/{user_id}", tags=["Users"], summary="Update user")
async def update_user(
    user_id: str,
    user: UserCreate,
) -> UserResponse:
    """
    Update an existing user's information.
    """
    return UserResponse(id=user_id, **user.model_dump())


@app.delete("/users/{user_id}", tags=["Users"], summary="Delete user", status_code=204)
async def delete_user(user_id: str):
    """
    Delete a user by ID.
    """
    pass


# Post endpoints
@app.get("/posts", tags=["Posts"], summary="List all posts")
async def list_posts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    author_id: Optional[str] = Query(None),
) -> List[PostResponse]:
    """
    Get all posts with optional filtering.
    """
    return []


@app.get("/posts/{post_id}", tags=["Posts"])
async def get_post(post_id: str) -> PostResponse:
    """Get a single post."""
    return PostResponse(id=post_id, title="Test", content="Content", author_id="123")


@app.post("/posts", tags=["Posts"], status_code=201)
async def create_post(
    post: PostCreate,
    x_request_id: Optional[str] = Header(None),
) -> PostResponse:
    """Create a new post."""
    return PostResponse(id="456", **post.model_dump())


# Health check
@app.get("/health", tags=["System"])
async def health_check():
    """Check API health status."""
    return {"status": "healthy"}
