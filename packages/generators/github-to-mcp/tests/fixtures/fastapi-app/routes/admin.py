"""
Additional routes module for FastAPI testing
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/admin", tags=["Admin"])


class AdminSettings(BaseModel):
    maintenance_mode: bool = False
    max_users: int = 1000
    features: dict = {}


@router.get("/settings", summary="Get admin settings")
async def get_settings() -> AdminSettings:
    """
    Retrieve current admin settings.
    
    Requires admin privileges.
    """
    return AdminSettings()


@router.put("/settings", summary="Update admin settings")
async def update_settings(settings: AdminSettings) -> AdminSettings:
    """
    Update admin settings.
    """
    return settings


@router.post("/maintenance", summary="Toggle maintenance mode", deprecated=True)
async def toggle_maintenance(enabled: bool):
    """
    Toggle maintenance mode on/off.
    
    This endpoint is deprecated, use PUT /admin/settings instead.
    """
    return {"maintenance_mode": enabled}
