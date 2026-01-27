"""
File Crawler - Traverses repositories and collects file metadata.

Designed for massive scale:
- Parallel directory traversal
- Streaming for memory efficiency
- Cloud storage integration
"""

import os
import asyncio
import hashlib
import mimetypes
from pathlib import Path
from typing import Dict, List, Any, Optional, AsyncIterator
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class FileInfo:
    """Information about a collected file."""
    path: str
    relative_path: str
    name: str
    extension: str
    size_bytes: int
    hash_sha256: str
    mime_type: Optional[str]
    is_binary: bool
    encoding: Optional[str]
    line_count: Optional[int]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "path": self.path,
            "relative_path": self.relative_path,
            "name": self.name,
            "extension": self.extension,
            "size_bytes": self.size_bytes,
            "hash_sha256": self.hash_sha256,
            "mime_type": self.mime_type,
            "is_binary": self.is_binary,
            "encoding": self.encoding,
            "line_count": self.line_count,
        }


@dataclass
class CrawlerConfig:
    """Configuration for file crawler."""
    # Directories to skip
    skip_dirs: List[str] = field(default_factory=lambda: [
        ".git", "node_modules", "__pycache__", ".next", 
        "dist", "build", ".cache", "venv", ".venv",
        "target", "vendor", ".idea", ".vscode"
    ])
    
    # File patterns to skip
    skip_patterns: List[str] = field(default_factory=lambda: [
        "*.pyc", "*.pyo", "*.so", "*.dylib", "*.dll",
        "*.exe", "*.bin", "*.lock", "package-lock.json",
        "yarn.lock", "*.min.js", "*.min.css"
    ])
    
    # Maximum file size to process (100MB default)
    max_file_size: int = 100 * 1024 * 1024
    
    # Parallel workers
    max_workers: int = 16
    
    # Batch size for streaming
    batch_size: int = 100
    
    # Calculate hashes (can be slow for large files)
    compute_hashes: bool = True
    
    # Count lines (for text files)
    count_lines: bool = True


class FileCrawler:
    """
    Asynchronous file crawler for repository analysis.
    
    Features:
    - Parallel directory traversal
    - Configurable filtering
    - Streaming results for memory efficiency
    - Hash computation for deduplication
    - Binary file detection
    """
    
    def __init__(self, config: Optional[CrawlerConfig] = None):
        self.config = config or CrawlerConfig()
        self._semaphore = asyncio.Semaphore(self.config.max_workers)
        
    def should_skip_dir(self, dir_name: str) -> bool:
        """Check if directory should be skipped."""
        return dir_name in self.config.skip_dirs
    
    def should_skip_file(self, file_name: str) -> bool:
        """Check if file should be skipped based on patterns."""
        from fnmatch import fnmatch
        return any(fnmatch(file_name, pattern) for pattern in self.config.skip_patterns)
    
    async def crawl(self, root_path: str) -> AsyncIterator[List[FileInfo]]:
        """
        Crawl repository and yield batches of file information.
        
        Args:
            root_path: Root directory to crawl
            
        Yields:
            Batches of FileInfo objects
        """
        root = Path(root_path).resolve()
        logger.info(f"Starting crawl of: {root}")
        
        batch = []
        
        for dirpath, dirnames, filenames in os.walk(root):
            # Filter directories in place
            dirnames[:] = [d for d in dirnames if not self.should_skip_dir(d)]
            
            # Process files in parallel
            tasks = []
            for filename in filenames:
                if not self.should_skip_file(filename):
                    file_path = Path(dirpath) / filename
                    tasks.append(self._process_file(file_path, root))
            
            # Gather results
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for result in results:
                    if isinstance(result, FileInfo):
                        batch.append(result)
                        if len(batch) >= self.config.batch_size:
                            yield batch
                            batch = []
                    elif isinstance(result, Exception):
                        logger.warning(f"Error processing file: {result}")
        
        # Yield remaining files
        if batch:
            yield batch
            
    async def _process_file(self, file_path: Path, root: Path) -> Optional[FileInfo]:
        """Process a single file and extract metadata."""
        async with self._semaphore:
            try:
                stat = file_path.stat()
                
                # Skip files that are too large
                if stat.st_size > self.config.max_file_size:
                    logger.debug(f"Skipping large file: {file_path}")
                    return None
                
                # Detect if binary
                is_binary = self._is_binary(file_path)
                
                # Compute hash if enabled
                file_hash = ""
                if self.config.compute_hashes:
                    file_hash = await self._compute_hash(file_path)
                
                # Count lines for text files
                line_count = None
                encoding = None
                if not is_binary and self.config.count_lines:
                    line_count, encoding = await self._count_lines(file_path)
                
                return FileInfo(
                    path=str(file_path),
                    relative_path=str(file_path.relative_to(root)),
                    name=file_path.name,
                    extension=file_path.suffix.lower(),
                    size_bytes=stat.st_size,
                    hash_sha256=file_hash,
                    mime_type=mimetypes.guess_type(str(file_path))[0],
                    is_binary=is_binary,
                    encoding=encoding,
                    line_count=line_count,
                )
                
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
                return None
    
    def _is_binary(self, file_path: Path) -> bool:
        """Check if file is binary."""
        try:
            with open(file_path, "rb") as f:
                chunk = f.read(8192)
                return b"\x00" in chunk
        except Exception:
            return True
    
    async def _compute_hash(self, file_path: Path) -> str:
        """Compute SHA-256 hash of file."""
        def _hash():
            hasher = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    hasher.update(chunk)
            return hasher.hexdigest()
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _hash)
    
    async def _count_lines(self, file_path: Path) -> tuple[Optional[int], Optional[str]]:
        """Count lines in text file."""
        encodings = ["utf-8", "latin-1", "cp1252"]
        
        for encoding in encodings:
            try:
                with open(file_path, "r", encoding=encoding) as f:
                    lines = sum(1 for _ in f)
                return lines, encoding
            except (UnicodeDecodeError, Exception):
                continue
        
        return None, None
    
    async def collect_all(self, root_path: str) -> List[FileInfo]:
        """
        Collect all files (non-streaming).
        
        Use crawl() for large repositories to avoid memory issues.
        """
        all_files = []
        async for batch in self.crawl(root_path):
            all_files.extend(batch)
        return all_files
    
    async def get_stats(self, files: List[FileInfo]) -> Dict[str, Any]:
        """Generate statistics from collected files."""
        stats = {
            "total_files": len(files),
            "total_size_bytes": sum(f.size_bytes for f in files),
            "total_lines": sum(f.line_count or 0 for f in files),
            "binary_files": sum(1 for f in files if f.is_binary),
            "text_files": sum(1 for f in files if not f.is_binary),
            "by_extension": {},
            "by_mime_type": {},
        }
        
        for f in files:
            ext = f.extension or "(none)"
            stats["by_extension"][ext] = stats["by_extension"].get(ext, 0) + 1
            
            mime = f.mime_type or "unknown"
            stats["by_mime_type"][mime] = stats["by_mime_type"].get(mime, 0) + 1
        
        return stats
