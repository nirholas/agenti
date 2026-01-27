"""
Code Profiler - Performance analysis of code.

This module analyzes code for potential performance issues
and provides optimization recommendations.
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class PerformanceIssue(Enum):
    """Types of performance issues."""
    N_PLUS_ONE = "n_plus_one"
    INEFFICIENT_LOOP = "inefficient_loop"
    LARGE_MEMORY = "large_memory"
    BLOCKING_IO = "blocking_io"
    UNNECESSARY_COMPUTATION = "unnecessary_computation"
    MISSING_CACHE = "missing_cache"
    INEFFICIENT_ALGORITHM = "inefficient_algorithm"
    DATABASE_QUERY = "database_query"
    SYNCHRONOUS_WAIT = "synchronous_wait"


@dataclass
class PerformanceFinding:
    """A performance-related finding."""
    issue_type: PerformanceIssue
    severity: str  # low, medium, high
    file_path: str
    line_number: int
    code_snippet: str
    description: str
    suggestion: str
    estimated_impact: str = ""


@dataclass
class ProfileResult:
    """Result of performance profiling."""
    total_findings: int
    findings: List[PerformanceFinding]
    summary: Dict[str, int]
    recommendations: List[str]
    complexity_score: float


class CodeProfiler:
    """
    Analyzes code for performance issues.
    
    Features:
    - Detect common anti-patterns
    - Identify inefficient algorithms
    - Find blocking operations
    - Suggest optimizations
    """
    
    def __init__(self):
        """Initialize code profiler."""
        self._patterns = self._load_patterns()
    
    def _load_patterns(self) -> List[Dict[str, Any]]:
        """Load performance detection patterns."""
        return [
            {
                "type": PerformanceIssue.N_PLUS_ONE,
                "pattern": r"for\s+\w+\s+in\s+.*:\s*\n\s*.*\.query\(",
                "severity": "high",
                "description": "Potential N+1 query pattern detected",
                "suggestion": "Consider using eager loading or batch queries",
            },
            {
                "type": PerformanceIssue.INEFFICIENT_LOOP,
                "pattern": r"for\s+\w+\s+in\s+range\(len\(",
                "severity": "low",
                "description": "Using range(len()) instead of enumerate",
                "suggestion": "Use enumerate() for cleaner and more Pythonic iteration",
            },
            {
                "type": PerformanceIssue.LARGE_MEMORY,
                "pattern": r"\.readlines\(\)|list\(.*\.read",
                "severity": "medium",
                "description": "Reading entire file into memory",
                "suggestion": "Consider streaming the file line by line",
            },
            {
                "type": PerformanceIssue.BLOCKING_IO,
                "pattern": r"(?<!async\s)def\s+\w+.*:\s*\n\s*.*(?:requests\.|urllib\.)",
                "severity": "medium",
                "description": "Synchronous I/O in potentially async context",
                "suggestion": "Consider using async HTTP client (aiohttp, httpx)",
            },
            {
                "type": PerformanceIssue.MISSING_CACHE,
                "pattern": r"def\s+get_\w+\(.*\):\s*\n\s*.*(?:\.query|fetch|request)",
                "severity": "low",
                "description": "Data fetching without apparent caching",
                "suggestion": "Consider adding caching for frequently accessed data",
            },
            {
                "type": PerformanceIssue.INEFFICIENT_ALGORITHM,
                "pattern": r"for\s+.*\s+in\s+.*:\s*\n\s*for\s+.*\s+in\s+.*:\s*\n\s*for",
                "severity": "high",
                "description": "Triple nested loop detected (O(n³) complexity)",
                "suggestion": "Review algorithm for possible optimization",
            },
            {
                "type": PerformanceIssue.DATABASE_QUERY,
                "pattern": r"SELECT\s+\*\s+FROM",
                "severity": "medium",
                "description": "SELECT * may return unnecessary columns",
                "suggestion": "Select only needed columns to reduce data transfer",
            },
            {
                "type": PerformanceIssue.SYNCHRONOUS_WAIT,
                "pattern": r"time\.sleep\(|Thread\.sleep\(",
                "severity": "low",
                "description": "Synchronous sleep blocking thread",
                "suggestion": "Consider async sleep or event-based waiting",
            },
            {
                "type": PerformanceIssue.UNNECESSARY_COMPUTATION,
                "pattern": r"for\s+\w+\s+in\s+.*:\s*\n\s*.*=\s*.*\.lower\(\)|\.upper\(\)",
                "severity": "low",
                "description": "String conversion inside loop",
                "suggestion": "Compute string transformations before the loop",
            },
        ]
    
    def profile_file(self, file_path: str, content: str) -> List[PerformanceFinding]:
        """
        Profile a single file for performance issues.
        
        Args:
            file_path: Path to the file
            content: File content
            
        Returns:
            List of performance findings
        """
        findings = []
        lines = content.split("\n")
        
        for pattern_def in self._patterns:
            try:
                pattern = re.compile(pattern_def["pattern"], re.MULTILINE | re.IGNORECASE)
                for match in pattern.finditer(content):
                    line_num = content[:match.start()].count("\n") + 1
                    
                    snippet_start = max(0, line_num - 2)
                    snippet_end = min(len(lines), line_num + 3)
                    snippet = "\n".join(lines[snippet_start:snippet_end])
                    
                    findings.append(PerformanceFinding(
                        issue_type=pattern_def["type"],
                        severity=pattern_def["severity"],
                        file_path=file_path,
                        line_number=line_num,
                        code_snippet=snippet,
                        description=pattern_def["description"],
                        suggestion=pattern_def["suggestion"],
                    ))
            except re.error:
                continue
        
        return findings
    
    def profile_codebase(
        self,
        files: List[Dict[str, str]],
    ) -> ProfileResult:
        """
        Profile an entire codebase.
        
        Args:
            files: List of {path, content} dicts
            
        Returns:
            Profile result
        """
        all_findings = []
        
        for file_info in files:
            path = file_info.get("path", "")
            content = file_info.get("content", "")
            findings = self.profile_file(path, content)
            all_findings.extend(findings)
        
        # Generate summary
        summary = {}
        for finding in all_findings:
            issue = finding.issue_type.value
            summary[issue] = summary.get(issue, 0) + 1
        
        # Calculate complexity score
        complexity_score = self._calculate_complexity(all_findings)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(all_findings)
        
        return ProfileResult(
            total_findings=len(all_findings),
            findings=all_findings,
            summary=summary,
            recommendations=recommendations,
            complexity_score=complexity_score,
        )
    
    def _calculate_complexity(self, findings: List[PerformanceFinding]) -> float:
        """Calculate overall complexity score (0-100, lower is better)."""
        score = 0.0
        
        for finding in findings:
            if finding.severity == "high":
                score += 10
            elif finding.severity == "medium":
                score += 5
            else:
                score += 2
        
        return min(100.0, score)
    
    def _generate_recommendations(self, findings: List[PerformanceFinding]) -> List[str]:
        """Generate overall recommendations."""
        recs = []
        
        issue_types = set(f.issue_type for f in findings)
        
        if PerformanceIssue.N_PLUS_ONE in issue_types:
            recs.append("🔍 Review database queries for N+1 patterns. Use eager loading.")
        
        if PerformanceIssue.BLOCKING_IO in issue_types:
            recs.append("⚡ Consider migrating to async I/O for better concurrency.")
        
        if PerformanceIssue.INEFFICIENT_ALGORITHM in issue_types:
            recs.append("📊 Review algorithms with high complexity. Consider optimization.")
        
        if PerformanceIssue.MISSING_CACHE in issue_types:
            recs.append("💾 Implement caching for frequently accessed data.")
        
        high_count = sum(1 for f in findings if f.severity == "high")
        if high_count > 5:
            recs.insert(0, f"⚠️ {high_count} high-severity performance issues found!")
        
        return recs
