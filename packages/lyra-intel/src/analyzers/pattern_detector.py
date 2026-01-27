"""
Pattern Detector - Identifies code patterns and anti-patterns.

Detects:
- Design patterns (singleton, factory, observer, etc.)
- Anti-patterns (god class, spaghetti code, etc.)
- Code smells
- Best practices violations
"""

import asyncio
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class PatternCategory(Enum):
    """Categories of detected patterns."""
    DESIGN_PATTERN = "design_pattern"
    ANTI_PATTERN = "anti_pattern"
    CODE_SMELL = "code_smell"
    BEST_PRACTICE = "best_practice"
    SECURITY = "security"
    PERFORMANCE = "performance"


class Severity(Enum):
    """Severity levels for detected issues."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class PatternMatch:
    """A detected pattern or anti-pattern."""
    pattern_name: str
    category: PatternCategory
    severity: Severity
    file_path: str
    line_start: int
    line_end: int
    description: str
    suggestion: Optional[str]
    confidence: float  # 0.0 to 1.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "pattern_name": self.pattern_name,
            "category": self.category.value,
            "severity": self.severity.value,
            "file_path": self.file_path,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "description": self.description,
            "suggestion": self.suggestion,
            "confidence": self.confidence,
        }


@dataclass
class PatternRule:
    """Definition of a pattern to detect."""
    name: str
    category: PatternCategory
    severity: Severity
    description: str
    suggestion: str
    detector: str  # Name of detection method
    languages: List[str]
    enabled: bool = True


@dataclass
class PatternDetectorConfig:
    """Configuration for pattern detector."""
    max_workers: int = 8
    min_confidence: float = 0.5
    categories: List[PatternCategory] = field(default_factory=lambda: list(PatternCategory))
    max_file_size: int = 1_000_000  # 1MB


class PatternDetector:
    """
    Detects patterns and anti-patterns in code.
    
    Built-in detections:
    - Design patterns (singleton, factory, etc.)
    - Anti-patterns (god class, long method, etc.)
    - Security issues (hardcoded secrets, SQL injection risks)
    - Performance issues (N+1 queries, inefficient loops)
    """
    
    DEFAULT_RULES = [
        # Anti-patterns
        PatternRule(
            name="god_class",
            category=PatternCategory.ANTI_PATTERN,
            severity=Severity.WARNING,
            description="Class has too many methods/attributes (>20)",
            suggestion="Consider splitting into smaller, focused classes",
            detector="detect_god_class",
            languages=["python", "javascript", "typescript"],
        ),
        PatternRule(
            name="long_method",
            category=PatternCategory.CODE_SMELL,
            severity=Severity.WARNING,
            description="Method is too long (>50 lines)",
            suggestion="Extract smaller helper methods",
            detector="detect_long_method",
            languages=["python", "javascript", "typescript"],
        ),
        PatternRule(
            name="deep_nesting",
            category=PatternCategory.CODE_SMELL,
            severity=Severity.WARNING,
            description="Code has deep nesting (>4 levels)",
            suggestion="Reduce nesting with early returns or extraction",
            detector="detect_deep_nesting",
            languages=["python", "javascript", "typescript"],
        ),
        PatternRule(
            name="hardcoded_secret",
            category=PatternCategory.SECURITY,
            severity=Severity.CRITICAL,
            description="Potential hardcoded secret or API key",
            suggestion="Use environment variables or secret management",
            detector="detect_hardcoded_secret",
            languages=["python", "javascript", "typescript"],
        ),
        PatternRule(
            name="todo_fixme",
            category=PatternCategory.CODE_SMELL,
            severity=Severity.INFO,
            description="TODO or FIXME comment found",
            suggestion="Address or remove the TODO/FIXME",
            detector="detect_todo_fixme",
            languages=["python", "javascript", "typescript"],
        ),
        PatternRule(
            name="unused_import",
            category=PatternCategory.CODE_SMELL,
            severity=Severity.INFO,
            description="Import appears unused",
            suggestion="Remove unused imports",
            detector="detect_unused_import",
            languages=["python", "javascript", "typescript"],
        ),
        # Design patterns
        PatternRule(
            name="singleton",
            category=PatternCategory.DESIGN_PATTERN,
            severity=Severity.INFO,
            description="Singleton pattern detected",
            suggestion="Consider if singleton is necessary",
            detector="detect_singleton",
            languages=["python", "javascript", "typescript"],
        ),
    ]
    
    def __init__(self, config: Optional[PatternDetectorConfig] = None):
        self.config = config or PatternDetectorConfig()
        self.rules = [r for r in self.DEFAULT_RULES if r.enabled]
        self._semaphore = asyncio.Semaphore(self.config.max_workers)
        
    async def detect_patterns(
        self,
        file_path: str,
        content: Optional[str] = None,
        ast_result: Optional[Dict[str, Any]] = None
    ) -> List[PatternMatch]:
        """
        Detect patterns in a file.
        
        Args:
            file_path: Path to file
            content: File content (if already loaded)
            ast_result: AST analysis result (if available)
            
        Returns:
            List of detected patterns
        """
        async with self._semaphore:
            if content is None:
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                except Exception as e:
                    logger.error(f"Error reading {file_path}: {e}")
                    return []
            
            if len(content) > self.config.max_file_size:
                logger.debug(f"Skipping large file: {file_path}")
                return []
            
            matches = []
            
            # Run all applicable detectors
            for rule in self.rules:
                if rule.category not in self.config.categories:
                    continue
                    
                detector = getattr(self, rule.detector, None)
                if detector:
                    try:
                        rule_matches = await detector(file_path, content, ast_result)
                        for match in rule_matches:
                            if match.confidence >= self.config.min_confidence:
                                matches.append(match)
                    except Exception as e:
                        logger.error(f"Error in {rule.detector}: {e}")
            
            return matches
    
    async def detect_god_class(
        self,
        file_path: str,
        content: str,
        ast_result: Optional[Dict[str, Any]]
    ) -> List[PatternMatch]:
        """Detect god classes with too many methods."""
        matches = []
        
        if ast_result:
            code_units = ast_result.get("code_units", [])
            
            # Group units by parent (class)
            class_methods: Dict[str, List[Dict]] = {}
            for unit in code_units:
                parent = unit.get("parent")
                if parent:
                    class_methods.setdefault(parent, []).append(unit)
            
            for class_name, methods in class_methods.items():
                if len(methods) > 20:
                    # Find class definition
                    class_unit = next((u for u in code_units if u.get("name") == class_name and u.get("type") == "class"), None)
                    
                    matches.append(PatternMatch(
                        pattern_name="god_class",
                        category=PatternCategory.ANTI_PATTERN,
                        severity=Severity.WARNING,
                        file_path=file_path,
                        line_start=class_unit.get("line_start", 0) if class_unit else 0,
                        line_end=class_unit.get("line_end", 0) if class_unit else 0,
                        description=f"Class '{class_name}' has {len(methods)} methods",
                        suggestion="Consider splitting into smaller, focused classes",
                        confidence=min(len(methods) / 30, 1.0),
                    ))
        
        return matches
    
    async def detect_long_method(
        self,
        file_path: str,
        content: str,
        ast_result: Optional[Dict[str, Any]]
    ) -> List[PatternMatch]:
        """Detect methods that are too long."""
        matches = []
        
        if ast_result:
            for unit in ast_result.get("code_units", []):
                if unit.get("type") in ("function", "async_function", "method"):
                    line_start = unit.get("line_start", 0)
                    line_end = unit.get("line_end", 0)
                    length = line_end - line_start
                    
                    if length > 50:
                        matches.append(PatternMatch(
                            pattern_name="long_method",
                            category=PatternCategory.CODE_SMELL,
                            severity=Severity.WARNING,
                            file_path=file_path,
                            line_start=line_start,
                            line_end=line_end,
                            description=f"Method '{unit.get('name')}' is {length} lines",
                            suggestion="Extract smaller helper methods",
                            confidence=min(length / 100, 1.0),
                        ))
        
        return matches
    
    async def detect_deep_nesting(
        self,
        file_path: str,
        content: str,
        ast_result: Optional[Dict[str, Any]]
    ) -> List[PatternMatch]:
        """Detect deeply nested code."""
        matches = []
        lines = content.split("\n")
        
        max_nesting = 0
        nesting_line = 0
        
        for i, line in enumerate(lines, 1):
            # Count leading spaces/tabs
            stripped = line.lstrip()
            if not stripped:
                continue
            
            indent = len(line) - len(stripped)
            # Assume 4-space or 1-tab indentation
            nesting = indent // 4
            
            if nesting > max_nesting:
                max_nesting = nesting
                nesting_line = i
        
        if max_nesting > 4:
            matches.append(PatternMatch(
                pattern_name="deep_nesting",
                category=PatternCategory.CODE_SMELL,
                severity=Severity.WARNING,
                file_path=file_path,
                line_start=nesting_line,
                line_end=nesting_line,
                description=f"Code nested {max_nesting} levels deep",
                suggestion="Reduce nesting with early returns or extraction",
                confidence=min(max_nesting / 8, 1.0),
            ))
        
        return matches
    
    async def detect_hardcoded_secret(
        self,
        file_path: str,
        content: str,
        ast_result: Optional[Dict[str, Any]]
    ) -> List[PatternMatch]:
        """Detect potential hardcoded secrets."""
        matches = []
        
        # Patterns for potential secrets
        secret_patterns = [
            (r'(?i)(api[_-]?key|apikey)\s*[=:]\s*["\']([^"\']{20,})["\']', "API key"),
            (r'(?i)(secret|password|passwd|pwd)\s*[=:]\s*["\']([^"\']{8,})["\']', "Secret/Password"),
            (r'(?i)(token)\s*[=:]\s*["\']([^"\']{20,})["\']', "Token"),
            (r'(?i)(aws[_-]?access[_-]?key)\s*[=:]\s*["\']([A-Z0-9]{20})["\']', "AWS Access Key"),
            (r'(?i)(private[_-]?key)\s*[=:]\s*["\']([^"\']{30,})["\']', "Private key"),
        ]
        
        lines = content.split("\n")
        
        for i, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.strip()
            if stripped.startswith(("#", "//", "/*", "*")):
                continue
            
            for pattern, secret_type in secret_patterns:
                if re.search(pattern, line):
                    matches.append(PatternMatch(
                        pattern_name="hardcoded_secret",
                        category=PatternCategory.SECURITY,
                        severity=Severity.CRITICAL,
                        file_path=file_path,
                        line_start=i,
                        line_end=i,
                        description=f"Potential hardcoded {secret_type}",
                        suggestion="Use environment variables or secret management",
                        confidence=0.8,
                    ))
                    break  # One match per line
        
        return matches
    
    async def detect_todo_fixme(
        self,
        file_path: str,
        content: str,
        ast_result: Optional[Dict[str, Any]]
    ) -> List[PatternMatch]:
        """Detect TODO and FIXME comments."""
        matches = []
        lines = content.split("\n")
        
        pattern = r'(?i)\b(TODO|FIXME|HACK|XXX|BUG)\b[:\s]*(.*)$'
        
        for i, line in enumerate(lines, 1):
            match = re.search(pattern, line)
            if match:
                tag, message = match.groups()
                matches.append(PatternMatch(
                    pattern_name="todo_fixme",
                    category=PatternCategory.CODE_SMELL,
                    severity=Severity.INFO,
                    file_path=file_path,
                    line_start=i,
                    line_end=i,
                    description=f"{tag}: {message.strip()[:100]}",
                    suggestion=f"Address or remove the {tag}",
                    confidence=1.0,
                ))
        
        return matches
    
    async def detect_unused_import(
        self,
        file_path: str,
        content: str,
        ast_result: Optional[Dict[str, Any]]
    ) -> List[PatternMatch]:
        """Detect potentially unused imports."""
        matches = []
        
        if ast_result:
            imports = ast_result.get("imports", [])
            
            for imp in imports:
                for name in imp.get("names", []):
                    if name == "*":
                        continue
                    
                    # Check if name is used in file (simple check)
                    # Use re.search for efficiency instead of findall
                    pattern = r'\b' + re.escape(name) + r'\b'
                    
                    # Count by searching, stopping early if found more than once
                    first_match = re.search(pattern, content)
                    if first_match:
                        # Search for second occurrence after the first
                        second_match = re.search(pattern, content[first_match.end():])
                        occurrences = 2 if second_match else 1
                    else:
                        occurrences = 0
                    
                    if occurrences <= 1:  # Only the import itself
                        matches.append(PatternMatch(
                            pattern_name="unused_import",
                            category=PatternCategory.CODE_SMELL,
                            severity=Severity.INFO,
                            file_path=file_path,
                            line_start=imp.get("line", 0),
                            line_end=imp.get("line", 0),
                            description=f"Import '{name}' appears unused",
                            suggestion="Remove unused imports",
                            confidence=0.7,
                        ))
        
        return matches
    
    async def detect_singleton(
        self,
        file_path: str,
        content: str,
        ast_result: Optional[Dict[str, Any]]
    ) -> List[PatternMatch]:
        """Detect singleton pattern."""
        matches = []
        
        # Check for common singleton patterns
        singleton_patterns = [
            r'_instance\s*=\s*None',
            r'__new__.*cls\._instance',
            r'getInstance\s*\(',
            r'@singleton',
        ]
        
        lines = content.split("\n")
        
        for pattern in singleton_patterns:
            for i, line in enumerate(lines, 1):
                if re.search(pattern, line):
                    matches.append(PatternMatch(
                        pattern_name="singleton",
                        category=PatternCategory.DESIGN_PATTERN,
                        severity=Severity.INFO,
                        file_path=file_path,
                        line_start=i,
                        line_end=i,
                        description="Singleton pattern detected",
                        suggestion="Consider if singleton is necessary",
                        confidence=0.7,
                    ))
                    return matches  # One match per file
        
        return matches
    
    async def detect_in_files(
        self,
        file_paths: List[str],
        ast_results: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> Dict[str, List[PatternMatch]]:
        """Detect patterns in multiple files."""
        results = {}
        
        tasks = []
        for fp in file_paths:
            ast_result = ast_results.get(fp) if ast_results else None
            tasks.append(self.detect_patterns(fp, ast_result=ast_result))
        
        matches_list = await asyncio.gather(*tasks)
        
        for fp, matches in zip(file_paths, matches_list):
            if matches:
                results[fp] = matches
        
        return results
    
    def get_summary(self, all_matches: Dict[str, List[PatternMatch]]) -> Dict[str, Any]:
        """Generate summary of all detected patterns."""
        total = 0
        by_category = {}
        by_severity = {}
        by_pattern = {}
        
        for matches in all_matches.values():
            for match in matches:
                total += 1
                
                cat = match.category.value
                by_category[cat] = by_category.get(cat, 0) + 1
                
                sev = match.severity.value
                by_severity[sev] = by_severity.get(sev, 0) + 1
                
                name = match.pattern_name
                by_pattern[name] = by_pattern.get(name, 0) + 1
        
        return {
            "total_matches": total,
            "files_with_matches": len(all_matches),
            "by_category": by_category,
            "by_severity": by_severity,
            "by_pattern": by_pattern,
        }
