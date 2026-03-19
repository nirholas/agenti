from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ToolExecution(BaseModel):
    name: str
    args: Optional[dict[str, str]] = None
    result: Optional[str] = None
    tx_hash: Optional[str] = None
    meta: Optional[dict[str, str]] = None
