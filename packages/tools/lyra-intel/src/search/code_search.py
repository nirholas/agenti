"""
Code Search - Fast text-based code search.

Provides:
- Regex search
- Literal search
- File pattern search
- Incremental search
"""

import re
from typing import Dict, List, Any, Optional, Iterator
from dataclasses import dataclass, field
from pathlib import Path
import logging
import fnmatch

logger = logging.getLogger(__name__)


@dataclass
class CodeMatch:
    """A code search match."""
    file_path: str
    line_number: int
    line_content: str
    match_start: int
    match_end: int
    context_before: List[str] = field(default_factory=list)
    context_after: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "line_number": self.line_number,
            "line_content": self.line_content,
            "match_start": self.match_start,
            "match_end": self.match_end,
            "context_before": self.context_before,
            "context_after": self.context_after,
        }


@dataclass
class SearchOptions:
    """Options for code search."""
    case_sensitive: bool = False
    whole_word: bool = False
    regex: bool = False
    include_patterns: List[str] = field(default_factory=lambda: ["*"])
    exclude_patterns: List[str] = field(default_factory=lambda: [
        "*.pyc", "*.min.js", "*.map", "node_modules/*", ".git/*",
        "__pycache__/*", "*.lock", "dist/*", "build/*"
    ])
    max_results: int = 1000
    context_lines: int = 2
    max_file_size: int = 10 * 1024 * 1024  # 10MB


class CodeSearch:
    """
    Fast text-based code search.
    
    Features:
    - Regex and literal search
    - File pattern filtering
    - Context lines
    - Incremental results
    """
    
    def __init__(self, options: Optional[SearchOptions] = None):
        self.options = options or SearchOptions()
        self._file_cache: Dict[str, List[str]] = {}
    
    def search(
        self,
        pattern: str,
        root_path: str,
        options: Optional[SearchOptions] = None
    ) -> List[CodeMatch]:
        """
        Search for pattern in codebase.
        
        Args:
            pattern: Search pattern (regex or literal)
            root_path: Root directory to search
            options: Search options override
            
        Returns:
            List of matches
        """
        opts = options or self.options
        matches = []
        
        # Compile pattern
        if opts.regex:
            try:
                flags = 0 if opts.case_sensitive else re.IGNORECASE
                regex = re.compile(pattern, flags)
            except re.error as e:
                logger.error(f"Invalid regex: {e}")
                return []
        else:
            # Escape for literal search
            escaped = re.escape(pattern)
            if opts.whole_word:
                escaped = r'\b' + escaped + r'\b'
            flags = 0 if opts.case_sensitive else re.IGNORECASE
            regex = re.compile(escaped, flags)
        
        # Walk directory
        root = Path(root_path)
        
        for file_path in self._iter_files(root, opts):
            if len(matches) >= opts.max_results:
                break
            
            file_matches = self._search_file(file_path, regex, opts)
            matches.extend(file_matches)
        
        return matches[:opts.max_results]
    
    def search_streaming(
        self,
        pattern: str,
        root_path: str,
        options: Optional[SearchOptions] = None
    ) -> Iterator[CodeMatch]:
        """
        Search with streaming results.
        
        Yields matches as they're found for better responsiveness.
        """
        opts = options or self.options
        
        # Compile pattern
        if opts.regex:
            try:
                flags = 0 if opts.case_sensitive else re.IGNORECASE
                regex = re.compile(pattern, flags)
            except re.error:
                return
        else:
            escaped = re.escape(pattern)
            if opts.whole_word:
                escaped = r'\b' + escaped + r'\b'
            flags = 0 if opts.case_sensitive else re.IGNORECASE
            regex = re.compile(escaped, flags)
        
        root = Path(root_path)
        count = 0
        
        for file_path in self._iter_files(root, opts):
            for match in self._search_file(file_path, regex, opts):
                yield match
                count += 1
                if count >= opts.max_results:
                    return
    
    def _iter_files(self, root: Path, opts: SearchOptions) -> Iterator[Path]:
        """Iterate over files matching patterns."""
        for file_path in root.rglob("*"):
            if not file_path.is_file():
                continue
            
            relative_path = str(file_path.relative_to(root))
            
            # Check exclude patterns
            excluded = False
            for pattern in opts.exclude_patterns:
                if fnmatch.fnmatch(relative_path, pattern):
                    excluded = True
                    break
            
            if excluded:
                continue
            
            # Check include patterns
            included = False
            for pattern in opts.include_patterns:
                if fnmatch.fnmatch(relative_path, pattern):
                    included = True
                    break
            
            if not included:
                continue
            
            # Check file size
            try:
                if file_path.stat().st_size > opts.max_file_size:
                    continue
            except OSError:
                continue
            
            yield file_path
    
    def _search_file(
        self,
        file_path: Path,
        regex: re.Pattern,
        opts: SearchOptions
    ) -> List[CodeMatch]:
        """Search a single file."""
        matches = []
        
        try:
            # Read file
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split('\n')
            
            # Search each line
            for i, line in enumerate(lines):
                for match in regex.finditer(line):
                    # Get context
                    context_before = []
                    context_after = []
                    
                    if opts.context_lines > 0:
                        start = max(0, i - opts.context_lines)
                        context_before = lines[start:i]
                        
                        end = min(len(lines), i + opts.context_lines + 1)
                        context_after = lines[i+1:end]
                    
                    matches.append(CodeMatch(
                        file_path=str(file_path),
                        line_number=i + 1,
                        line_content=line,
                        match_start=match.start(),
                        match_end=match.end(),
                        context_before=context_before,
                        context_after=context_after,
                    ))
                    
        except Exception as e:
            logger.debug(f"Error reading {file_path}: {e}")
        
        return matches
    
    def replace(
        self,
        pattern: str,
        replacement: str,
        root_path: str,
        options: Optional[SearchOptions] = None,
        dry_run: bool = True
    ) -> Dict[str, Any]:
        """
        Search and replace in codebase.
        
        Args:
            pattern: Search pattern
            replacement: Replacement string
            root_path: Root directory
            options: Search options
            dry_run: If True, don't actually modify files
            
        Returns:
            Summary of replacements
        """
        opts = options or self.options
        
        # Compile pattern
        if opts.regex:
            flags = 0 if opts.case_sensitive else re.IGNORECASE
            regex = re.compile(pattern, flags)
        else:
            escaped = re.escape(pattern)
            if opts.whole_word:
                escaped = r'\b' + escaped + r'\b'
            flags = 0 if opts.case_sensitive else re.IGNORECASE
            regex = re.compile(escaped, flags)
        
        results = {
            "files_modified": 0,
            "total_replacements": 0,
            "changes": [],
            "dry_run": dry_run,
        }
        
        root = Path(root_path)
        
        for file_path in self._iter_files(root, opts):
            try:
                content = file_path.read_text(encoding='utf-8')
                new_content, count = regex.subn(replacement, content)
                
                if count > 0:
                    results["files_modified"] += 1
                    results["total_replacements"] += count
                    results["changes"].append({
                        "file": str(file_path),
                        "replacements": count,
                    })
                    
                    if not dry_run:
                        file_path.write_text(new_content, encoding='utf-8')
                        
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
        
        return results
    
    def find_duplicates(
        self,
        root_path: str,
        min_lines: int = 10,
        options: Optional[SearchOptions] = None
    ) -> List[Dict[str, Any]]:
        """
        Find duplicate code blocks.
        
        Args:
            root_path: Root directory
            min_lines: Minimum lines to consider duplicate
            options: Search options
            
        Returns:
            List of duplicate code locations
        """
        opts = options or self.options
        
        # Build hash map of code blocks
        block_hashes: Dict[str, List[Dict]] = {}
        
        root = Path(root_path)
        
        for file_path in self._iter_files(root, opts):
            try:
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                lines = content.split('\n')
                
                # Sliding window of min_lines
                for i in range(len(lines) - min_lines + 1):
                    block = '\n'.join(lines[i:i + min_lines])
                    
                    # Skip mostly whitespace blocks
                    if len(block.strip()) < 50:
                        continue
                    
                    # Normalize whitespace for comparison
                    normalized = ' '.join(block.split())
                    block_hash = hash(normalized)
                    
                    if block_hash not in block_hashes:
                        block_hashes[block_hash] = []
                    
                    block_hashes[block_hash].append({
                        "file_path": str(file_path),
                        "line_start": i + 1,
                        "line_end": i + min_lines,
                        "content": block[:200] + "..." if len(block) > 200 else block,
                    })
                    
            except Exception as e:
                logger.debug(f"Error processing {file_path}: {e}")
        
        # Find duplicates
        duplicates = []
        for block_hash, locations in block_hashes.items():
            if len(locations) > 1:
                duplicates.append({
                    "count": len(locations),
                    "locations": locations,
                })
        
        # Sort by count
        duplicates.sort(key=lambda x: -x["count"])
        
        return duplicates[:100]  # Limit results
