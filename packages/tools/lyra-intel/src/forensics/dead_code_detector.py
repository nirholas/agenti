"""
Dead Code Detector - Identifies unused code in the codebase.
"""

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


@dataclass
class DeadCodeResult:
    """Result of dead code detection."""
    file_path: str
    entity_name: str
    entity_type: str  # function, class, variable, import
    line_number: int
    confidence: float
    reason: str
    potential_usages: List[str] = field(default_factory=list)


@dataclass
class DeadCodeConfig:
    """Configuration for dead code detection."""
    check_functions: bool = True
    check_classes: bool = True
    check_variables: bool = True
    check_imports: bool = True
    ignore_patterns: List[str] = field(default_factory=lambda: [
        r"^_",  # Private by convention
        r"^test_",  # Test functions
        r"^Test",  # Test classes
        r"__\w+__",  # Dunder methods
    ])
    min_confidence: float = 0.7


class DeadCodeDetector:
    """
    Detects potentially dead/unused code in a codebase.
    
    Analyzes:
    - Unused functions
    - Unused classes
    - Unused variables
    - Unused imports
    - Unreachable code
    """
    
    def __init__(self, config: Optional[DeadCodeConfig] = None):
        self.config = config or DeadCodeConfig()
        self._definitions: Dict[str, Dict] = {}  # entity -> definition info
        self._usages: Dict[str, Set[str]] = {}   # entity -> set of usage locations
        self._ignore_patterns = [re.compile(p) for p in self.config.ignore_patterns]
    
    def analyze(self, repo_path: str) -> List[DeadCodeResult]:
        """Analyze repository for dead code."""
        repo = Path(repo_path)
        results = []
        
        logger.info(f"Analyzing {repo} for dead code...")
        
        # Phase 1: Collect all definitions
        self._collect_definitions(repo)
        
        # Phase 2: Collect all usages
        self._collect_usages(repo)
        
        # Phase 3: Compare and identify dead code
        results = self._identify_dead_code()
        
        logger.info(f"Found {len(results)} potential dead code items")
        
        return results
    
    def _collect_definitions(self, repo: Path):
        """Collect all entity definitions."""
        for filepath in repo.rglob("*"):
            if not filepath.is_file():
                continue
            
            suffix = filepath.suffix
            if suffix not in [".py", ".js", ".ts", ".tsx", ".jsx", ".go"]:
                continue
            
            if self._should_skip_path(str(filepath)):
                continue
            
            try:
                content = filepath.read_text(encoding="utf-8", errors="ignore")
                self._extract_definitions(str(filepath), content, suffix)
            except Exception:
                continue
    
    def _should_skip_path(self, path: str) -> bool:
        """Check if path should be skipped."""
        skip_patterns = [
            "node_modules",
            "__pycache__",
            ".git",
            "dist",
            "build",
            ".next",
            "venv",
            "test",
            "tests",
            "spec",
        ]
        return any(p in path.lower() for p in skip_patterns)
    
    def _extract_definitions(self, filepath: str, content: str, suffix: str):
        """Extract definitions from a file."""
        lines = content.split("\n")
        
        patterns = self._get_definition_patterns(suffix)
        
        for i, line in enumerate(lines, 1):
            for entity_type, pattern in patterns.items():
                for match in re.finditer(pattern, line):
                    name = match.group(1)
                    
                    # Skip ignored patterns
                    if any(p.search(name) for p in self._ignore_patterns):
                        continue
                    
                    key = f"{filepath}:{name}"
                    self._definitions[key] = {
                        "file_path": filepath,
                        "name": name,
                        "type": entity_type,
                        "line": i,
                        "full_name": f"{Path(filepath).stem}.{name}",
                    }
    
    def _get_definition_patterns(self, suffix: str) -> Dict[str, re.Pattern]:
        """Get definition patterns for a file type."""
        patterns = {}
        
        if suffix == ".py":
            if self.config.check_functions:
                patterns["function"] = re.compile(r"^\s*(?:async\s+)?def\s+(\w+)")
            if self.config.check_classes:
                patterns["class"] = re.compile(r"^\s*class\s+(\w+)")
            if self.config.check_variables:
                patterns["variable"] = re.compile(r"^(\w+)\s*=\s*(?!.*def\s|.*class\s)")
        
        elif suffix in [".js", ".ts", ".tsx", ".jsx"]:
            if self.config.check_functions:
                patterns["function"] = re.compile(r"(?:function|const|let|var)\s+(\w+)\s*[=(]")
            if self.config.check_classes:
                patterns["class"] = re.compile(r"class\s+(\w+)")
        
        elif suffix == ".go":
            if self.config.check_functions:
                patterns["function"] = re.compile(r"func\s+(?:\([^)]+\)\s+)?(\w+)")
            if self.config.check_classes:
                patterns["struct"] = re.compile(r"type\s+(\w+)\s+struct")
        
        return patterns
    
    def _collect_usages(self, repo: Path):
        """Collect all entity usages."""
        for filepath in repo.rglob("*"):
            if not filepath.is_file():
                continue
            
            suffix = filepath.suffix
            if suffix not in [".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".md"]:
                continue
            
            if self._should_skip_path(str(filepath)):
                continue
            
            try:
                content = filepath.read_text(encoding="utf-8", errors="ignore")
                self._extract_usages(str(filepath), content)
            except Exception:
                continue
    
    def _extract_usages(self, filepath: str, content: str):
        """Extract usages from content."""
        # For each defined entity, check if it appears in this file
        for key, definition in self._definitions.items():
            name = definition["name"]
            def_file = definition["file_path"]
            
            # Skip self-references
            if filepath == def_file:
                # Check for internal usage (not just definition)
                usage_pattern = re.compile(rf"\b{re.escape(name)}\b")
                matches = list(usage_pattern.finditer(content))
                
                # If more than 1 match (definition + usage), it's used internally
                if len(matches) > 1:
                    if key not in self._usages:
                        self._usages[key] = set()
                    self._usages[key].add(f"{filepath}:internal")
            else:
                # Check for external usage
                if re.search(rf"\b{re.escape(name)}\b", content):
                    if key not in self._usages:
                        self._usages[key] = set()
                    self._usages[key].add(filepath)
    
    def _identify_dead_code(self) -> List[DeadCodeResult]:
        """Identify dead code from definitions and usages."""
        results = []
        
        for key, definition in self._definitions.items():
            usages = self._usages.get(key, set())
            
            if not usages:
                # No usages found
                confidence = self._calculate_confidence(definition)
                
                if confidence >= self.config.min_confidence:
                    results.append(DeadCodeResult(
                        file_path=definition["file_path"],
                        entity_name=definition["name"],
                        entity_type=definition["type"],
                        line_number=definition["line"],
                        confidence=confidence,
                        reason="No usages found in codebase",
                    ))
            elif len(usages) == 1 and f"{definition['file_path']}:internal" in usages:
                # Only internal usage
                results.append(DeadCodeResult(
                    file_path=definition["file_path"],
                    entity_name=definition["name"],
                    entity_type=definition["type"],
                    line_number=definition["line"],
                    confidence=0.5,  # Lower confidence for internal-only
                    reason="Only used internally within same file",
                    potential_usages=list(usages),
                ))
        
        # Sort by confidence
        results.sort(key=lambda x: x.confidence, reverse=True)
        
        return results
    
    def _calculate_confidence(self, definition: Dict) -> float:
        """Calculate confidence that code is dead."""
        confidence = 0.8  # Base confidence
        
        entity_type = definition.get("type", "")
        name = definition.get("name", "")
        
        # Lower confidence for certain patterns
        if name.startswith("_"):
            confidence -= 0.2  # Private/internal
        
        if entity_type == "class":
            confidence -= 0.1  # Classes might be instantiated dynamically
        
        if "handler" in name.lower() or "callback" in name.lower():
            confidence -= 0.2  # Might be called dynamically
        
        if "api" in definition.get("file_path", "").lower():
            confidence -= 0.2  # API endpoints might be called externally
        
        return max(0.0, min(1.0, confidence))
    
    def get_summary(self, results: List[DeadCodeResult]) -> Dict[str, Any]:
        """Get summary of dead code analysis."""
        by_type = {}
        by_file = {}
        
        for result in results:
            # By type
            t = result.entity_type
            if t not in by_type:
                by_type[t] = {"count": 0, "high_confidence": 0}
            by_type[t]["count"] += 1
            if result.confidence >= 0.8:
                by_type[t]["high_confidence"] += 1
            
            # By file
            f = result.file_path
            if f not in by_file:
                by_file[f] = 0
            by_file[f] += 1
        
        return {
            "total_dead_code": len(results),
            "by_type": by_type,
            "files_affected": len(by_file),
            "top_files": sorted(by_file.items(), key=lambda x: x[1], reverse=True)[:10],
            "high_confidence_count": sum(1 for r in results if r.confidence >= 0.8),
        }
