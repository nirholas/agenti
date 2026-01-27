"""
Commit-by-Commit Analyzer

Analyzes each commit in a repository's history to track:
- When complexity was introduced
- When security issues appeared
- Code quality evolution over time
- Specific commits that introduced bugs

Perfect for debugging situations like "which of these 40 commits broke everything?"
"""

import subprocess
import json
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
import tempfile
import shutil
import logging

logger = logging.getLogger(__name__)


@dataclass
class CommitMetrics:
    """Metrics for a single commit."""
    commit_hash: str
    short_hash: str
    author: str
    date: str
    message: str
    files_changed: int
    insertions: int
    deletions: int
    
    # Code metrics
    total_lines: int = 0
    total_functions: int = 0
    total_classes: int = 0
    avg_complexity: float = 0.0
    max_complexity: int = 0
    
    # Security
    security_issues: int = 0
    critical_issues: int = 0
    high_issues: int = 0
    
    # Quality
    duplicate_code: int = 0
    code_smells: int = 0
    
    # Changes from previous commit
    lines_delta: int = 0
    complexity_delta: float = 0.0
    issues_delta: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CommitAnalysisConfig:
    """Configuration for commit analysis."""
    max_commits: Optional[int] = None  # Limit number of commits to analyze
    branch: str = "main"
    start_commit: Optional[str] = None
    end_commit: Optional[str] = None
    analyze_security: bool = True
    analyze_complexity: bool = True
    analyze_patterns: bool = True
    skip_merge_commits: bool = True
    parallel_workers: int = 4


class CommitAnalyzer:
    """
    Analyzes git commit history to track code quality evolution.
    
    Use cases:
    - Find which commit introduced a bug
    - Track complexity growth over time
    - Identify when security issues appeared
    - Compare branches commit-by-commit
    """
    
    def __init__(self, repo_path: str, config: Optional[CommitAnalysisConfig] = None):
        self.repo_path = Path(repo_path)
        self.config = config or CommitAnalysisConfig()
        
        if not (self.repo_path / ".git").exists():
            raise ValueError(f"{repo_path} is not a git repository")
    
    def get_commit_list(self) -> List[Dict[str, str]]:
        """Get list of commits to analyze."""
        cmd = ["git", "log", "--pretty=format:%H|%h|%an|%ad|%s", "--date=iso"]
        
        if self.config.skip_merge_commits:
            cmd.append("--no-merges")
        
        if self.config.start_commit and self.config.end_commit:
            cmd.append(f"{self.config.start_commit}..{self.config.end_commit}")
        elif self.config.end_commit:
            cmd.append(self.config.end_commit)
        
        if self.config.max_commits:
            cmd.extend(["-n", str(self.config.max_commits)])
        
        cmd.append(self.config.branch)
        
        result = subprocess.run(
            cmd,
            cwd=self.repo_path,
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode != 0:
            logger.error(f"Git log failed: {result.stderr}")
            return []
        
        commits = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|", 4)
            if len(parts) == 5:
                commits.append({
                    "hash": parts[0],
                    "short_hash": parts[1],
                    "author": parts[2],
                    "date": parts[3],
                    "message": parts[4],
                })
        
        return commits
    
    def get_commit_stats(self, commit_hash: str) -> Dict[str, int]:
        """Get basic stats for a commit (files changed, insertions, deletions)."""
        result = subprocess.run(
            ["git", "show", "--stat", "--format=", commit_hash],
            cwd=self.repo_path,
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode != 0:
            return {"files_changed": 0, "insertions": 0, "deletions": 0}
        
        # Parse output like: " 3 files changed, 45 insertions(+), 12 deletions(-)"
        stats = {"files_changed": 0, "insertions": 0, "deletions": 0}
        
        for line in result.stdout.strip().split("\n"):
            if "file" in line and "changed" in line:
                parts = line.split(",")
                for part in parts:
                    if "file" in part and "changed" in part:
                        num = ''.join(filter(str.isdigit, part.split("file")[0]))
                        stats["files_changed"] = int(num) if num else 0
                    elif "insertion" in part:
                        num = ''.join(filter(str.isdigit, part))
                        stats["insertions"] = int(num) if num else 0
                    elif "deletion" in part:
                        num = ''.join(filter(str.isdigit, part))
                        stats["deletions"] = int(num) if num else 0
        
        return stats
    
    def checkout_commit(self, commit_hash: str, temp_dir: Path) -> bool:
        """Checkout a commit to a temporary directory."""
        try:
            # Clone to temp directory
            subprocess.run(
                ["git", "clone", str(self.repo_path), str(temp_dir)],
                capture_output=True,
                check=True
            )
            
            # Checkout specific commit
            subprocess.run(
                ["git", "checkout", commit_hash],
                cwd=temp_dir,
                capture_output=True,
                check=True
            )
            
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to checkout {commit_hash}: {e}")
            return False
    
    async def analyze_commit_code(self, temp_dir: Path) -> Dict[str, Any]:
        """Analyze code at a specific commit."""
        from ..analyzers.ast_analyzer import ASTAnalyzer
        from ..security.vulnerability_scanner import VulnerabilityScanner
        
        # Find all source files
        source_files = []
        for ext in [".py", ".js", ".jsx", ".ts", ".tsx"]:
            source_files.extend(temp_dir.glob(f"**/*{ext}"))
        
        # Filter out node_modules, venv, etc.
        source_files = [
            f for f in source_files 
            if not any(part.startswith(".") or part in ["node_modules", "venv", "dist", "build", "__pycache__"]
                      for part in f.parts)
        ]
        
        metrics = {
            "total_lines": 0,
            "total_functions": 0,
            "total_classes": 0,
            "avg_complexity": 0.0,
            "max_complexity": 0,
            "security_issues": 0,
            "critical_issues": 0,
            "high_issues": 0,
        }
        
        if not source_files:
            return metrics
        
        # Analyze with AST
        if self.config.analyze_complexity:
            analyzer = ASTAnalyzer()
            results = await analyzer.analyze_files([str(f) for f in source_files])
            
            total_complexity = 0
            complexity_count = 0
            
            for result in results:
                if "error" in result:
                    continue
                
                metrics["total_lines"] += result.get("metrics", {}).get("total_lines", 0)
                metrics["total_functions"] += result.get("metrics", {}).get("functions", 0)
                metrics["total_classes"] += result.get("metrics", {}).get("classes", 0)
                
                for unit in result.get("code_units", []):
                    complexity = unit.get("complexity", 0)
                    total_complexity += complexity
                    complexity_count += 1
                    metrics["max_complexity"] = max(metrics["max_complexity"], complexity)
            
            if complexity_count > 0:
                metrics["avg_complexity"] = total_complexity / complexity_count
        
        # Security scan
        if self.config.analyze_security:
            try:
                scanner = VulnerabilityScanner()
                findings = scanner.scan_directory(str(temp_dir))
                
                metrics["security_issues"] = len(findings)
                metrics["critical_issues"] = sum(1 for f in findings if f.get("severity") == "critical")
                metrics["high_issues"] = sum(1 for f in findings if f.get("severity") == "high")
            except Exception as e:
                logger.warning(f"Security scan failed: {e}")
        
        return metrics
    
    async def analyze_commit(
        self, 
        commit_info: Dict[str, str],
        previous_metrics: Optional[CommitMetrics] = None
    ) -> CommitMetrics:
        """Analyze a single commit."""
        logger.info(f"Analyzing commit {commit_info['short_hash']}: {commit_info['message'][:50]}")
        
        # Get basic stats
        stats = self.get_commit_stats(commit_info["hash"])
        
        # Create temporary directory for checkout
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Checkout commit
            if not self.checkout_commit(commit_info["hash"], temp_path):
                logger.warning(f"Skipping {commit_info['short_hash']} - checkout failed")
                return self._create_basic_metrics(commit_info, stats)
            
            # Analyze code
            code_metrics = await self.analyze_commit_code(temp_path)
        
        # Create metrics object
        metrics = CommitMetrics(
            commit_hash=commit_info["hash"],
            short_hash=commit_info["short_hash"],
            author=commit_info["author"],
            date=commit_info["date"],
            message=commit_info["message"],
            files_changed=stats["files_changed"],
            insertions=stats["insertions"],
            deletions=stats["deletions"],
            **code_metrics
        )
        
        # Calculate deltas
        if previous_metrics:
            metrics.lines_delta = metrics.total_lines - previous_metrics.total_lines
            metrics.complexity_delta = metrics.avg_complexity - previous_metrics.avg_complexity
            metrics.issues_delta = metrics.security_issues - previous_metrics.security_issues
        
        return metrics
    
    def _create_basic_metrics(
        self, 
        commit_info: Dict[str, str], 
        stats: Dict[str, int]
    ) -> CommitMetrics:
        """Create basic metrics when full analysis fails."""
        return CommitMetrics(
            commit_hash=commit_info["hash"],
            short_hash=commit_info["short_hash"],
            author=commit_info["author"],
            date=commit_info["date"],
            message=commit_info["message"],
            files_changed=stats["files_changed"],
            insertions=stats["insertions"],
            deletions=stats["deletions"],
        )
    
    async def analyze_all_commits(self) -> List[CommitMetrics]:
        """Analyze all commits in the configured range."""
        commits = self.get_commit_list()
        
        if not commits:
            logger.warning("No commits found to analyze")
            return []
        
        logger.info(f"Found {len(commits)} commits to analyze")
        
        # Analyze commits sequentially (can't parallelize due to git checkout)
        # But we reverse so we go oldest to newest
        commits.reverse()
        
        results = []
        previous = None
        
        for i, commit_info in enumerate(commits, 1):
            logger.info(f"Progress: {i}/{len(commits)}")
            
            try:
                metrics = await self.analyze_commit(commit_info, previous)
                results.append(metrics)
                previous = metrics
            except Exception as e:
                logger.error(f"Error analyzing {commit_info['short_hash']}: {e}")
                continue
        
        return results
    
    def find_complexity_spikes(
        self, 
        results: List[CommitMetrics], 
        threshold: float = 5.0
    ) -> List[CommitMetrics]:
        """Find commits where complexity increased significantly."""
        spikes = []
        
        for metrics in results:
            if metrics.complexity_delta > threshold:
                spikes.append(metrics)
        
        return sorted(spikes, key=lambda m: m.complexity_delta, reverse=True)
    
    def find_security_regressions(
        self, 
        results: List[CommitMetrics]
    ) -> List[CommitMetrics]:
        """Find commits that introduced security issues."""
        regressions = []
        
        for metrics in results:
            if metrics.issues_delta > 0:
                regressions.append(metrics)
        
        return sorted(regressions, key=lambda m: m.critical_issues, reverse=True)
    
    def find_large_commits(
        self, 
        results: List[CommitMetrics],
        threshold: int = 500
    ) -> List[CommitMetrics]:
        """Find commits with large changes."""
        return [
            m for m in results 
            if (m.insertions + m.deletions) > threshold
        ]
    
    def generate_report(self, results: List[CommitMetrics]) -> Dict[str, Any]:
        """Generate analysis report."""
        if not results:
            return {"error": "No results to analyze"}
        
        return {
            "summary": {
                "total_commits": len(results),
                "date_range": {
                    "first": results[0].date,
                    "last": results[-1].date,
                },
                "total_changes": {
                    "insertions": sum(m.insertions for m in results),
                    "deletions": sum(m.deletions for m in results),
                },
            },
            "current_state": {
                "total_lines": results[-1].total_lines,
                "total_functions": results[-1].total_functions,
                "total_classes": results[-1].total_classes,
                "avg_complexity": results[-1].avg_complexity,
                "security_issues": results[-1].security_issues,
            },
            "problematic_commits": {
                "complexity_spikes": [
                    m.to_dict() for m in self.find_complexity_spikes(results)[:10]
                ],
                "security_regressions": [
                    m.to_dict() for m in self.find_security_regressions(results)[:10]
                ],
                "large_commits": [
                    m.to_dict() for m in self.find_large_commits(results)[:10]
                ],
            },
            "trends": {
                "complexity_over_time": [
                    {"commit": m.short_hash, "complexity": m.avg_complexity}
                    for m in results
                ],
                "lines_over_time": [
                    {"commit": m.short_hash, "lines": m.total_lines}
                    for m in results
                ],
                "security_over_time": [
                    {"commit": m.short_hash, "issues": m.security_issues}
                    for m in results
                ],
            },
            "all_commits": [m.to_dict() for m in results],
        }
    
    def save_report(self, results: List[CommitMetrics], output_path: str):
        """Save report to JSON file."""
        report = self.generate_report(results)
        
        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Report saved to {output_path}")
