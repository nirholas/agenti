"""
Database Models - Type definitions for database entities.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from datetime import datetime


@dataclass
class Repository:
    """Repository entity."""
    id: int
    path: str
    name: str
    url: Optional[str] = None
    branch: Optional[str] = None
    last_analyzed: Optional[datetime] = None
    created_at: Optional[datetime] = None


@dataclass
class File:
    """File entity."""
    id: int
    repo_id: int
    path: str
    relative_path: str
    name: str
    extension: Optional[str] = None
    size_bytes: int = 0
    hash_sha256: Optional[str] = None
    mime_type: Optional[str] = None
    is_binary: bool = False
    line_count: Optional[int] = None
    last_modified: Optional[datetime] = None
    created_at: Optional[datetime] = None


@dataclass
class CodeUnit:
    """Code unit entity (function, class, etc.)."""
    id: int
    file_id: int
    type: str
    name: str
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    column_start: Optional[int] = None
    column_end: Optional[int] = None
    docstring: Optional[str] = None
    decorators: List[str] = field(default_factory=list)
    parameters: List[Dict[str, Any]] = field(default_factory=list)
    return_type: Optional[str] = None
    parent_id: Optional[int] = None
    complexity: int = 1
    created_at: Optional[datetime] = None


@dataclass
class Import:
    """Import entity."""
    id: int
    file_id: int
    line: int
    module: str
    names: List[str] = field(default_factory=list)
    alias: Optional[str] = None
    is_relative: bool = False
    level: int = 0
    created_at: Optional[datetime] = None


@dataclass
class Dependency:
    """Dependency relationship entity."""
    id: int
    source_file_id: int
    source_unit_id: Optional[int]
    target_file_id: Optional[int]
    target_module: Optional[str]
    target_unit: Optional[str]
    dependency_type: str
    line: int
    is_external: bool
    created_at: Optional[datetime] = None


@dataclass
class Commit:
    """Git commit entity."""
    id: int
    repo_id: int
    hash: str
    short_hash: str
    author_name: str
    author_email: str
    author_date: datetime
    committer_name: str
    committer_email: str
    commit_date: datetime
    subject: str
    body: Optional[str] = None
    files_changed: int = 0
    insertions: int = 0
    deletions: int = 0
    parent_hashes: List[str] = field(default_factory=list)
    created_at: Optional[datetime] = None


@dataclass
class Pattern:
    """Detected pattern entity."""
    id: int
    file_id: int
    pattern_name: str
    category: str
    severity: str
    line_start: int
    line_end: int
    description: str
    suggestion: Optional[str] = None
    confidence: float = 1.0
    created_at: Optional[datetime] = None


@dataclass
class AnalysisRun:
    """Analysis run entity."""
    id: int
    repo_id: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "pending"
    config: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
