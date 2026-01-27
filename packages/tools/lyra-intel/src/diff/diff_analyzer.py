"""
Diff Analyzer - Analyze code changes between versions.

This module provides comprehensive diff analysis including:
- Line-by-line changes
- Semantic diffs (function/class changes)
- Impact analysis
- Change categorization
"""

import difflib
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class ChangeType(Enum):
    """Types of changes."""
    ADDED = "added"
    DELETED = "deleted"
    MODIFIED = "modified"
    RENAMED = "renamed"
    MOVED = "moved"
    UNCHANGED = "unchanged"


class ChangeCategory(Enum):
    """Categories of changes."""
    FEATURE = "feature"
    BUGFIX = "bugfix"
    REFACTOR = "refactor"
    DOCUMENTATION = "documentation"
    STYLE = "style"
    TEST = "test"
    CONFIG = "config"
    DEPENDENCY = "dependency"
    SECURITY = "security"
    PERFORMANCE = "performance"
    OTHER = "other"


@dataclass
class LineDiff:
    """Represents a line-level change."""
    line_number_old: Optional[int]
    line_number_new: Optional[int]
    change_type: ChangeType
    content_old: Optional[str] = None
    content_new: Optional[str] = None


@dataclass
class SemanticChange:
    """Represents a semantic-level change (function, class, etc.)."""
    name: str
    change_type: ChangeType
    element_type: str  # function, class, method, etc.
    file_path: str
    line_number_old: Optional[int] = None
    line_number_new: Optional[int] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FileDiff:
    """Represents changes to a single file."""
    file_path: str
    change_type: ChangeType
    old_path: Optional[str] = None
    lines_added: int = 0
    lines_deleted: int = 0
    line_diffs: List[LineDiff] = field(default_factory=list)
    semantic_changes: List[SemanticChange] = field(default_factory=list)
    category: ChangeCategory = ChangeCategory.OTHER


@dataclass
class DiffResult:
    """Result of a diff analysis."""
    source_ref: str
    target_ref: str
    total_files_changed: int
    total_lines_added: int
    total_lines_deleted: int
    file_diffs: List[FileDiff] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


class DiffAnalyzer:
    """
    Analyzes differences between code versions.
    
    Features:
    - Line-by-line diff
    - Semantic diff (function/class level)
    - Change categorization
    - Impact analysis
    """
    
    def __init__(self):
        """Initialize diff analyzer."""
        self._category_patterns = {
            ChangeCategory.FEATURE: [r"feat", r"add", r"implement", r"new"],
            ChangeCategory.BUGFIX: [r"fix", r"bug", r"patch", r"resolve"],
            ChangeCategory.REFACTOR: [r"refactor", r"restructure", r"reorg"],
            ChangeCategory.DOCUMENTATION: [r"doc", r"readme", r"comment"],
            ChangeCategory.STYLE: [r"style", r"format", r"lint"],
            ChangeCategory.TEST: [r"test", r"spec", r"coverage"],
            ChangeCategory.CONFIG: [r"config", r"setting", r"env"],
            ChangeCategory.DEPENDENCY: [r"dep", r"package", r"module"],
            ChangeCategory.SECURITY: [r"security", r"auth", r"cve", r"vuln"],
            ChangeCategory.PERFORMANCE: [r"perf", r"optim", r"speed", r"cache"],
        }
    
    def analyze_files(
        self,
        old_content: str,
        new_content: str,
        file_path: str,
    ) -> FileDiff:
        """
        Analyze differences between two versions of a file.
        
        Args:
            old_content: Content of old version
            new_content: Content of new version
            file_path: Path to the file
            
        Returns:
            FileDiff with detailed changes
        """
        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)
        
        # Determine change type
        if not old_content and new_content:
            change_type = ChangeType.ADDED
        elif old_content and not new_content:
            change_type = ChangeType.DELETED
        elif old_content != new_content:
            change_type = ChangeType.MODIFIED
        else:
            change_type = ChangeType.UNCHANGED
        
        # Get line diffs
        line_diffs = self._compute_line_diffs(old_lines, new_lines)
        
        # Count additions and deletions
        lines_added = sum(1 for d in line_diffs if d.change_type == ChangeType.ADDED)
        lines_deleted = sum(1 for d in line_diffs if d.change_type == ChangeType.DELETED)
        
        # Extract semantic changes
        semantic_changes = self._extract_semantic_changes(
            old_content, new_content, file_path
        )
        
        # Determine category
        category = self._categorize_changes(file_path, semantic_changes)
        
        return FileDiff(
            file_path=file_path,
            change_type=change_type,
            lines_added=lines_added,
            lines_deleted=lines_deleted,
            line_diffs=line_diffs,
            semantic_changes=semantic_changes,
            category=category,
        )
    
    def analyze_commit(
        self,
        files: Dict[str, Tuple[str, str]],
        source_ref: str,
        target_ref: str,
    ) -> DiffResult:
        """
        Analyze all file changes in a commit.
        
        Args:
            files: Dict of file_path -> (old_content, new_content)
            source_ref: Source reference (commit hash, branch)
            target_ref: Target reference
            
        Returns:
            DiffResult with all changes
        """
        file_diffs = []
        total_added = 0
        total_deleted = 0
        
        for file_path, (old_content, new_content) in files.items():
            diff = self.analyze_files(old_content, new_content, file_path)
            file_diffs.append(diff)
            total_added += diff.lines_added
            total_deleted += diff.lines_deleted
        
        # Generate summary
        summary = self._generate_summary(file_diffs)
        
        return DiffResult(
            source_ref=source_ref,
            target_ref=target_ref,
            total_files_changed=len(file_diffs),
            total_lines_added=total_added,
            total_lines_deleted=total_deleted,
            file_diffs=file_diffs,
            summary=summary,
        )
    
    def _compute_line_diffs(
        self,
        old_lines: List[str],
        new_lines: List[str],
    ) -> List[LineDiff]:
        """Compute line-by-line differences."""
        diffs = []
        
        matcher = difflib.SequenceMatcher(None, old_lines, new_lines)
        
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                continue
            elif tag == "replace":
                for i, j in zip(range(i1, i2), range(j1, j2)):
                    diffs.append(LineDiff(
                        line_number_old=i + 1,
                        line_number_new=j + 1,
                        change_type=ChangeType.MODIFIED,
                        content_old=old_lines[i] if i < len(old_lines) else None,
                        content_new=new_lines[j] if j < len(new_lines) else None,
                    ))
            elif tag == "delete":
                for i in range(i1, i2):
                    diffs.append(LineDiff(
                        line_number_old=i + 1,
                        line_number_new=None,
                        change_type=ChangeType.DELETED,
                        content_old=old_lines[i],
                    ))
            elif tag == "insert":
                for j in range(j1, j2):
                    diffs.append(LineDiff(
                        line_number_old=None,
                        line_number_new=j + 1,
                        change_type=ChangeType.ADDED,
                        content_new=new_lines[j],
                    ))
        
        return diffs
    
    def _extract_semantic_changes(
        self,
        old_content: str,
        new_content: str,
        file_path: str,
    ) -> List[SemanticChange]:
        """Extract semantic-level changes (functions, classes, etc.)."""
        changes = []
        
        # Extract elements from both versions
        old_elements = self._extract_code_elements(old_content)
        new_elements = self._extract_code_elements(new_content)
        
        old_names = {e["name"]: e for e in old_elements}
        new_names = {e["name"]: e for e in new_elements}
        
        # Find added elements
        for name, elem in new_names.items():
            if name not in old_names:
                changes.append(SemanticChange(
                    name=name,
                    change_type=ChangeType.ADDED,
                    element_type=elem["type"],
                    file_path=file_path,
                    line_number_new=elem.get("line"),
                ))
        
        # Find deleted elements
        for name, elem in old_names.items():
            if name not in new_names:
                changes.append(SemanticChange(
                    name=name,
                    change_type=ChangeType.DELETED,
                    element_type=elem["type"],
                    file_path=file_path,
                    line_number_old=elem.get("line"),
                ))
        
        # Find modified elements
        for name in set(old_names.keys()) & set(new_names.keys()):
            old_elem = old_names[name]
            new_elem = new_names[name]
            
            if old_elem.get("signature") != new_elem.get("signature"):
                changes.append(SemanticChange(
                    name=name,
                    change_type=ChangeType.MODIFIED,
                    element_type=new_elem["type"],
                    file_path=file_path,
                    line_number_old=old_elem.get("line"),
                    line_number_new=new_elem.get("line"),
                    details={
                        "old_signature": old_elem.get("signature"),
                        "new_signature": new_elem.get("signature"),
                    },
                ))
        
        return changes
    
    def _extract_code_elements(self, content: str) -> List[Dict[str, Any]]:
        """Extract code elements (functions, classes) from content."""
        elements = []
        
        # Python patterns
        func_pattern = r"^\s*(async\s+)?def\s+(\w+)\s*\((.*?)\)"
        class_pattern = r"^\s*class\s+(\w+)\s*(?:\((.*?)\))?\s*:"
        
        # JavaScript/TypeScript patterns
        js_func_pattern = r"(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)"
        js_class_pattern = r"class\s+(\w+)(?:\s+extends\s+(\w+))?"
        
        lines = content.split("\n")
        
        for i, line in enumerate(lines):
            # Python functions
            match = re.search(func_pattern, line)
            if match:
                elements.append({
                    "name": match.group(2),
                    "type": "function",
                    "line": i + 1,
                    "signature": line.strip(),
                })
                continue
            
            # Python classes
            match = re.search(class_pattern, line)
            if match:
                elements.append({
                    "name": match.group(1),
                    "type": "class",
                    "line": i + 1,
                    "signature": line.strip(),
                })
                continue
            
            # JS/TS functions
            match = re.search(js_func_pattern, line)
            if match:
                name = match.group(1) or match.group(2)
                if name:
                    elements.append({
                        "name": name,
                        "type": "function",
                        "line": i + 1,
                        "signature": line.strip(),
                    })
                continue
            
            # JS/TS classes
            match = re.search(js_class_pattern, line)
            if match:
                elements.append({
                    "name": match.group(1),
                    "type": "class",
                    "line": i + 1,
                    "signature": line.strip(),
                })
        
        return elements
    
    def _categorize_changes(
        self,
        file_path: str,
        semantic_changes: List[SemanticChange],
    ) -> ChangeCategory:
        """Categorize the type of changes."""
        path_lower = file_path.lower()
        
        # Check file path patterns
        if "test" in path_lower or "spec" in path_lower:
            return ChangeCategory.TEST
        if "doc" in path_lower or path_lower.endswith(".md"):
            return ChangeCategory.DOCUMENTATION
        if "config" in path_lower or path_lower.endswith((".json", ".yaml", ".yml", ".toml")):
            return ChangeCategory.CONFIG
        
        # Check semantic changes
        change_names = " ".join(c.name.lower() for c in semantic_changes)
        
        for category, patterns in self._category_patterns.items():
            for pattern in patterns:
                if re.search(pattern, change_names):
                    return category
        
        return ChangeCategory.OTHER
    
    def _generate_summary(self, file_diffs: List[FileDiff]) -> Dict[str, Any]:
        """Generate a summary of all changes."""
        by_category = {}
        by_change_type = {}
        semantic_summary = {
            "functions_added": 0,
            "functions_deleted": 0,
            "functions_modified": 0,
            "classes_added": 0,
            "classes_deleted": 0,
            "classes_modified": 0,
        }
        
        for diff in file_diffs:
            # By category
            cat = diff.category.value
            by_category[cat] = by_category.get(cat, 0) + 1
            
            # By change type
            ct = diff.change_type.value
            by_change_type[ct] = by_change_type.get(ct, 0) + 1
            
            # Semantic summary
            for sc in diff.semantic_changes:
                key = f"{sc.element_type}s_{sc.change_type.value}"
                if key in semantic_summary:
                    semantic_summary[key] += 1
        
        return {
            "by_category": by_category,
            "by_change_type": by_change_type,
            "semantic": semantic_summary,
            "most_changed_files": sorted(
                [{"path": d.file_path, "changes": d.lines_added + d.lines_deleted} for d in file_diffs],
                key=lambda x: x["changes"],
                reverse=True,
            )[:10],
        }
    
    def generate_patch(self, file_diff: FileDiff) -> str:
        """Generate a unified diff patch."""
        lines = []
        lines.append(f"--- a/{file_diff.file_path}")
        lines.append(f"+++ b/{file_diff.file_path}")
        
        # Group consecutive changes into hunks
        hunks = []
        current_hunk = []
        
        for ld in file_diff.line_diffs:
            if not current_hunk:
                current_hunk.append(ld)
            elif self._should_merge_diffs(current_hunk[-1], ld):
                current_hunk.append(ld)
            else:
                if current_hunk:
                    hunks.append(current_hunk)
                current_hunk = [ld]
        
        if current_hunk:
            hunks.append(current_hunk)
        
        # Format hunks
        for hunk in hunks:
            old_start = min(
                (d.line_number_old for d in hunk if d.line_number_old is not None),
                default=1
            )
            new_start = min(
                (d.line_number_new for d in hunk if d.line_number_new is not None),
                default=1
            )
            
            old_count = sum(1 for d in hunk if d.change_type in [ChangeType.DELETED, ChangeType.MODIFIED])
            new_count = sum(1 for d in hunk if d.change_type in [ChangeType.ADDED, ChangeType.MODIFIED])
            
            lines.append(f"@@ -{old_start},{old_count} +{new_start},{new_count} @@")
            
            for ld in hunk:
                if ld.change_type == ChangeType.DELETED:
                    lines.append(f"-{ld.content_old.rstrip()}" if ld.content_old else "-")
                elif ld.change_type == ChangeType.ADDED:
                    lines.append(f"+{ld.content_new.rstrip()}" if ld.content_new else "+")
                elif ld.change_type == ChangeType.MODIFIED:
                    if ld.content_old:
                        lines.append(f"-{ld.content_old.rstrip()}")
                    if ld.content_new:
                        lines.append(f"+{ld.content_new.rstrip()}")
        
        return "\n".join(lines)
    
    def _should_merge_diffs(self, a: LineDiff, b: LineDiff) -> bool:
        """Check if two diffs should be in the same hunk."""
        if a.line_number_old is not None and b.line_number_old is not None:
            if b.line_number_old - a.line_number_old <= 3:
                return True
        if a.line_number_new is not None and b.line_number_new is not None:
            if b.line_number_new - a.line_number_new <= 3:
                return True
        return False
