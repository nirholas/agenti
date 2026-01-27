"""
Database - Storage backend abstraction.

Supports:
- SQLite (local development)
- PostgreSQL (production)
- BigQuery (massive scale analytics)
"""

import asyncio
import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime
from contextlib import asynccontextmanager
import logging

logger = logging.getLogger(__name__)


@dataclass
class DatabaseConfig:
    """Configuration for database connection."""
    backend: str = "sqlite"  # sqlite, postgres, bigquery
    connection_string: Optional[str] = None
    database_path: Path = field(default_factory=lambda: Path("./lyra_intel.db"))
    
    # Connection pool settings
    min_connections: int = 1
    max_connections: int = 10
    
    # BigQuery specific
    project_id: Optional[str] = None
    dataset_id: Optional[str] = None


class Database:
    """
    Database abstraction layer.
    
    Provides unified interface for storing and querying analysis results
    across different backend databases.
    """
    
    SCHEMA_VERSION = 1
    
    SQLITE_SCHEMA = """
    -- Core tables for codebase analysis
    
    CREATE TABLE IF NOT EXISTS repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        url TEXT,
        branch TEXT,
        last_analyzed TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        name TEXT NOT NULL,
        extension TEXT,
        size_bytes INTEGER,
        hash_sha256 TEXT,
        mime_type TEXT,
        is_binary BOOLEAN,
        line_count INTEGER,
        last_modified TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repo_id) REFERENCES repositories(id),
        UNIQUE(repo_id, relative_path)
    );
    
    CREATE TABLE IF NOT EXISTS code_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        line_start INTEGER,
        line_end INTEGER,
        column_start INTEGER,
        column_end INTEGER,
        docstring TEXT,
        decorators TEXT,  -- JSON array
        parameters TEXT,  -- JSON array
        return_type TEXT,
        parent_id INTEGER,
        complexity INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id),
        FOREIGN KEY (parent_id) REFERENCES code_units(id)
    );
    
    CREATE TABLE IF NOT EXISTS imports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        line INTEGER,
        module TEXT NOT NULL,
        names TEXT,  -- JSON array
        alias TEXT,
        is_relative BOOLEAN,
        level INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id)
    );
    
    CREATE TABLE IF NOT EXISTS dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_file_id INTEGER NOT NULL,
        source_unit_id INTEGER,
        target_file_id INTEGER,
        target_module TEXT,
        target_unit TEXT,
        dependency_type TEXT NOT NULL,
        line INTEGER,
        is_external BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_file_id) REFERENCES files(id),
        FOREIGN KEY (source_unit_id) REFERENCES code_units(id),
        FOREIGN KEY (target_file_id) REFERENCES files(id)
    );
    
    CREATE TABLE IF NOT EXISTS commits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        hash TEXT NOT NULL,
        short_hash TEXT,
        author_name TEXT,
        author_email TEXT,
        author_date TIMESTAMP,
        committer_name TEXT,
        committer_email TEXT,
        commit_date TIMESTAMP,
        subject TEXT,
        body TEXT,
        files_changed INTEGER,
        insertions INTEGER,
        deletions INTEGER,
        parent_hashes TEXT,  -- JSON array
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repo_id) REFERENCES repositories(id),
        UNIQUE(repo_id, hash)
    );
    
    CREATE TABLE IF NOT EXISTS file_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commit_id INTEGER NOT NULL,
        file_id INTEGER,
        file_path TEXT NOT NULL,
        change_type TEXT,
        old_path TEXT,
        insertions INTEGER,
        deletions INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (commit_id) REFERENCES commits(id),
        FOREIGN KEY (file_id) REFERENCES files(id)
    );
    
    CREATE TABLE IF NOT EXISTS patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        pattern_name TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        line_start INTEGER,
        line_end INTEGER,
        description TEXT,
        suggestion TEXT,
        confidence REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id)
    );
    
    CREATE TABLE IF NOT EXISTS analysis_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        status TEXT NOT NULL,
        config TEXT,  -- JSON
        metrics TEXT,  -- JSON
        errors TEXT,  -- JSON array
        FOREIGN KEY (repo_id) REFERENCES repositories(id)
    );
    
    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_files_repo ON files(repo_id);
    CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
    CREATE INDEX IF NOT EXISTS idx_code_units_file ON code_units(file_id);
    CREATE INDEX IF NOT EXISTS idx_code_units_type ON code_units(type);
    CREATE INDEX IF NOT EXISTS idx_imports_file ON imports(file_id);
    CREATE INDEX IF NOT EXISTS idx_dependencies_source ON dependencies(source_file_id);
    CREATE INDEX IF NOT EXISTS idx_dependencies_target ON dependencies(target_file_id);
    CREATE INDEX IF NOT EXISTS idx_commits_repo ON commits(repo_id);
    CREATE INDEX IF NOT EXISTS idx_commits_date ON commits(commit_date);
    CREATE INDEX IF NOT EXISTS idx_patterns_file ON patterns(file_id);
    CREATE INDEX IF NOT EXISTS idx_patterns_category ON patterns(category);
    
    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    def __init__(self, config: Optional[DatabaseConfig] = None):
        self.config = config or DatabaseConfig()
        self._connection = None
        self._initialized = False
        
    async def initialize(self) -> None:
        """Initialize database connection and schema."""
        if self._initialized:
            return
            
        logger.info(f"Initializing database: {self.config.backend}")
        
        if self.config.backend == "sqlite":
            await self._init_sqlite()
        elif self.config.backend == "postgres":
            await self._init_postgres()
        elif self.config.backend == "bigquery":
            await self._init_bigquery()
        else:
            raise ValueError(f"Unknown backend: {self.config.backend}")
            
        self._initialized = True
        
    async def _init_sqlite(self) -> None:
        """Initialize SQLite database."""
        db_path = self.config.database_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        self._connection = sqlite3.connect(str(db_path))
        self._connection.row_factory = sqlite3.Row
        
        # Execute schema
        self._connection.executescript(self.SQLITE_SCHEMA)
        
        # Record schema version
        cursor = self._connection.execute(
            "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
        )
        row = cursor.fetchone()
        
        if not row or row[0] < self.SCHEMA_VERSION:
            self._connection.execute(
                "INSERT INTO schema_version (version) VALUES (?)",
                (self.SCHEMA_VERSION,)
            )
        
        self._connection.commit()
        logger.info(f"SQLite database initialized at {db_path}")
        
    async def _init_postgres(self) -> None:
        """Initialize PostgreSQL database."""
        # Would use asyncpg in production
        raise NotImplementedError("PostgreSQL backend not yet implemented")
        
    async def _init_bigquery(self) -> None:
        """Initialize BigQuery dataset."""
        # Would use google-cloud-bigquery
        raise NotImplementedError("BigQuery backend not yet implemented")
        
    async def close(self) -> None:
        """Close database connection."""
        if self._connection:
            self._connection.close()
            self._connection = None
        self._initialized = False
        
    # Repository operations
    
    async def create_repository(self, path: str, name: str, url: Optional[str] = None, branch: Optional[str] = None) -> int:
        """Create or update a repository record."""
        cursor = self._connection.execute(
            """
            INSERT INTO repositories (path, name, url, branch)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET
                name = excluded.name,
                url = excluded.url,
                branch = excluded.branch
            RETURNING id
            """,
            (path, name, url, branch)
        )
        repo_id = cursor.fetchone()[0]
        self._connection.commit()
        return repo_id
        
    async def get_repository(self, repo_id: int) -> Optional[Dict[str, Any]]:
        """Get repository by ID."""
        cursor = self._connection.execute(
            "SELECT * FROM repositories WHERE id = ?",
            (repo_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
        
    async def update_repository_analyzed(self, repo_id: int) -> None:
        """Update last analyzed timestamp."""
        self._connection.execute(
            "UPDATE repositories SET last_analyzed = ? WHERE id = ?",
            (datetime.now().isoformat(), repo_id)
        )
        self._connection.commit()
        
    # File operations
    
    async def insert_files(self, repo_id: int, files: List[Dict[str, Any]]) -> int:
        """Bulk insert files."""
        count = 0
        for file_info in files:
            try:
                self._connection.execute(
                    """
                    INSERT INTO files (repo_id, path, relative_path, name, extension, 
                                      size_bytes, hash_sha256, mime_type, is_binary, line_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(repo_id, relative_path) DO UPDATE SET
                        size_bytes = excluded.size_bytes,
                        hash_sha256 = excluded.hash_sha256,
                        line_count = excluded.line_count
                    """,
                    (
                        repo_id,
                        file_info.get("path"),
                        file_info.get("relative_path"),
                        file_info.get("name"),
                        file_info.get("extension"),
                        file_info.get("size_bytes"),
                        file_info.get("hash_sha256"),
                        file_info.get("mime_type"),
                        file_info.get("is_binary"),
                        file_info.get("line_count"),
                    )
                )
                count += 1
            except Exception as e:
                logger.error(f"Error inserting file: {e}")
        
        self._connection.commit()
        return count
        
    async def get_file_id(self, repo_id: int, relative_path: str) -> Optional[int]:
        """Get file ID by path."""
        cursor = self._connection.execute(
            "SELECT id FROM files WHERE repo_id = ? AND relative_path = ?",
            (repo_id, relative_path)
        )
        row = cursor.fetchone()
        return row[0] if row else None
        
    async def get_files(self, repo_id: int, extension: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get files for a repository."""
        query = "SELECT * FROM files WHERE repo_id = ?"
        params = [repo_id]
        
        if extension:
            query += " AND extension = ?"
            params.append(extension)
        
        cursor = self._connection.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]
        
    # Code unit operations
    
    async def insert_code_units(self, file_id: int, units: List[Dict[str, Any]]) -> int:
        """Insert code units for a file."""
        count = 0
        for unit in units:
            try:
                self._connection.execute(
                    """
                    INSERT INTO code_units (file_id, type, name, line_start, line_end,
                                           column_start, column_end, docstring, decorators,
                                           parameters, return_type, complexity)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        file_id,
                        unit.get("type"),
                        unit.get("name"),
                        unit.get("line_start"),
                        unit.get("line_end"),
                        unit.get("column_start"),
                        unit.get("column_end"),
                        unit.get("docstring"),
                        json.dumps(unit.get("decorators", [])),
                        json.dumps(unit.get("parameters", [])),
                        unit.get("return_type"),
                        unit.get("complexity"),
                    )
                )
                count += 1
            except Exception as e:
                logger.error(f"Error inserting code unit: {e}")
        
        self._connection.commit()
        return count
        
    # Import operations
    
    async def insert_imports(self, file_id: int, imports: List[Dict[str, Any]]) -> int:
        """Insert imports for a file."""
        count = 0
        for imp in imports:
            try:
                self._connection.execute(
                    """
                    INSERT INTO imports (file_id, line, module, names, alias, is_relative, level)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        file_id,
                        imp.get("line"),
                        imp.get("module"),
                        json.dumps(imp.get("names", [])),
                        imp.get("alias"),
                        imp.get("is_relative"),
                        imp.get("level"),
                    )
                )
                count += 1
            except Exception as e:
                logger.error(f"Error inserting import: {e}")
        
        self._connection.commit()
        return count
        
    # Commit operations
    
    async def insert_commits(self, repo_id: int, commits: List[Dict[str, Any]]) -> int:
        """Bulk insert commits."""
        count = 0
        for commit in commits:
            try:
                self._connection.execute(
                    """
                    INSERT INTO commits (repo_id, hash, short_hash, author_name, author_email,
                                        author_date, committer_name, committer_email, commit_date,
                                        subject, body, files_changed, insertions, deletions, parent_hashes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(repo_id, hash) DO NOTHING
                    """,
                    (
                        repo_id,
                        commit.get("hash"),
                        commit.get("short_hash"),
                        commit.get("author_name"),
                        commit.get("author_email"),
                        commit.get("author_date"),
                        commit.get("committer_name"),
                        commit.get("committer_email"),
                        commit.get("commit_date"),
                        commit.get("subject"),
                        commit.get("body"),
                        commit.get("files_changed"),
                        commit.get("insertions"),
                        commit.get("deletions"),
                        json.dumps(commit.get("parent_hashes", [])),
                    )
                )
                count += 1
            except Exception as e:
                logger.error(f"Error inserting commit: {e}")
        
        self._connection.commit()
        return count
        
    # Pattern operations
    
    async def insert_patterns(self, file_id: int, patterns: List[Dict[str, Any]]) -> int:
        """Insert detected patterns."""
        count = 0
        for pattern in patterns:
            try:
                self._connection.execute(
                    """
                    INSERT INTO patterns (file_id, pattern_name, category, severity,
                                         line_start, line_end, description, suggestion, confidence)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        file_id,
                        pattern.get("pattern_name"),
                        pattern.get("category"),
                        pattern.get("severity"),
                        pattern.get("line_start"),
                        pattern.get("line_end"),
                        pattern.get("description"),
                        pattern.get("suggestion"),
                        pattern.get("confidence"),
                    )
                )
                count += 1
            except Exception as e:
                logger.error(f"Error inserting pattern: {e}")
        
        self._connection.commit()
        return count
        
    # Analysis run operations
    
    async def start_analysis_run(self, repo_id: int, config: Dict[str, Any]) -> int:
        """Start a new analysis run."""
        cursor = self._connection.execute(
            """
            INSERT INTO analysis_runs (repo_id, started_at, status, config)
            VALUES (?, ?, 'running', ?)
            RETURNING id
            """,
            (repo_id, datetime.now().isoformat(), json.dumps(config))
        )
        run_id = cursor.fetchone()[0]
        self._connection.commit()
        return run_id
        
    async def complete_analysis_run(
        self,
        run_id: int,
        status: str,
        metrics: Dict[str, Any],
        errors: List[str]
    ) -> None:
        """Complete an analysis run."""
        self._connection.execute(
            """
            UPDATE analysis_runs
            SET completed_at = ?, status = ?, metrics = ?, errors = ?
            WHERE id = ?
            """,
            (
                datetime.now().isoformat(),
                status,
                json.dumps(metrics),
                json.dumps(errors),
                run_id
            )
        )
        self._connection.commit()
        
    # Query operations
    
    async def query(self, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Execute a raw SQL query."""
        cursor = self._connection.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]
        
    async def get_stats(self, repo_id: int) -> Dict[str, Any]:
        """Get statistics for a repository."""
        stats = {}
        
        # File stats
        cursor = self._connection.execute(
            """
            SELECT 
                COUNT(*) as total_files,
                SUM(size_bytes) as total_size,
                SUM(line_count) as total_lines,
                COUNT(DISTINCT extension) as unique_extensions
            FROM files WHERE repo_id = ?
            """,
            (repo_id,)
        )
        row = cursor.fetchone()
        stats["files"] = dict(row)
        
        # Code unit stats
        cursor = self._connection.execute(
            """
            SELECT type, COUNT(*) as count
            FROM code_units cu
            JOIN files f ON cu.file_id = f.id
            WHERE f.repo_id = ?
            GROUP BY type
            """,
            (repo_id,)
        )
        stats["code_units"] = {row["type"]: row["count"] for row in cursor.fetchall()}
        
        # Commit stats
        cursor = self._connection.execute(
            """
            SELECT 
                COUNT(*) as total_commits,
                COUNT(DISTINCT author_email) as unique_authors,
                SUM(insertions) as total_insertions,
                SUM(deletions) as total_deletions
            FROM commits WHERE repo_id = ?
            """,
            (repo_id,)
        )
        row = cursor.fetchone()
        stats["commits"] = dict(row)
        
        # Pattern stats
        cursor = self._connection.execute(
            """
            SELECT category, severity, COUNT(*) as count
            FROM patterns p
            JOIN files f ON p.file_id = f.id
            WHERE f.repo_id = ?
            GROUP BY category, severity
            """,
            (repo_id,)
        )
        stats["patterns"] = [dict(row) for row in cursor.fetchall()]
        
        return stats
