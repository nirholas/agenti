"""
Discovery Pipeline - End-to-end discovery workflow.

Orchestrates:
1. GitHub scanning for new MCP repos
2. Cloning and analyzing discovered repos
3. Security scanning
4. Registry submission
"""

import asyncio
import json
import logging
import os
import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any

from .github_scanner import GitHubScanner, GitHubScanConfig, DiscoveredRepo, RepoQuality
from .analyzer import ToolAnalyzer, ToolAnalysisConfig, AnalyzedTool
from .submitter import RegistrySubmitter, SubmitterConfig, SubmissionResult, SubmissionStatus

logger = logging.getLogger(__name__)


@dataclass
class PipelineConfig:
    """Configuration for the discovery pipeline."""
    
    # Component configs
    scanner_config: Optional[GitHubScanConfig] = None
    analyzer_config: Optional[ToolAnalysisConfig] = None
    submitter_config: Optional[SubmitterConfig] = None
    
    # Pipeline settings
    work_dir: Optional[str] = None  # Temp dir for cloning
    cleanup_after: bool = True  # Clean up cloned repos
    parallel_analysis: int = 3  # Number of repos to analyze in parallel
    
    # Filtering
    min_repo_quality: RepoQuality = RepoQuality.LOW
    skip_repos: List[str] = field(default_factory=list)
    
    # Output
    save_results: bool = True
    results_dir: str = "./discovery_results"
    
    def __post_init__(self):
        if self.scanner_config is None:
            self.scanner_config = GitHubScanConfig()
        if self.analyzer_config is None:
            self.analyzer_config = ToolAnalysisConfig()
        if self.submitter_config is None:
            self.submitter_config = SubmitterConfig()


@dataclass
class PipelineResult:
    """Result of a discovery pipeline run."""
    
    # Timing
    started_at: datetime
    completed_at: datetime
    duration_seconds: float
    
    # Discovery stats
    repos_discovered: int
    repos_analyzed: int
    repos_submitted: int
    
    # Tool stats
    total_tools_found: int
    tools_submitted: int
    tools_accepted: int
    tools_rejected: int
    
    # Quality breakdown
    high_quality_repos: int
    medium_quality_repos: int
    low_quality_repos: int
    
    # Detailed results
    discovered_repos: List[Dict[str, Any]]
    analyzed_repos: List[Dict[str, Any]]
    submission_results: Dict[str, List[Dict[str, Any]]]
    
    # Errors
    errors: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "duration_seconds": self.duration_seconds,
            "repos_discovered": self.repos_discovered,
            "repos_analyzed": self.repos_analyzed,
            "repos_submitted": self.repos_submitted,
            "total_tools_found": self.total_tools_found,
            "tools_submitted": self.tools_submitted,
            "tools_accepted": self.tools_accepted,
            "tools_rejected": self.tools_rejected,
            "high_quality_repos": self.high_quality_repos,
            "medium_quality_repos": self.medium_quality_repos,
            "low_quality_repos": self.low_quality_repos,
            "discovered_repos": self.discovered_repos,
            "analyzed_repos": self.analyzed_repos,
            "submission_results": self.submission_results,
            "errors": self.errors,
        }
    
    def summary(self) -> str:
        """Get a human-readable summary."""
        return f"""
Discovery Pipeline Results
==========================
Duration: {self.duration_seconds:.1f}s
Repos: {self.repos_discovered} discovered → {self.repos_analyzed} analyzed → {self.repos_submitted} submitted
Tools: {self.total_tools_found} found → {self.tools_submitted} submitted → {self.tools_accepted} accepted
Quality: {self.high_quality_repos} high / {self.medium_quality_repos} medium / {self.low_quality_repos} low
Errors: {len(self.errors)}
"""


class DiscoveryPipeline:
    """
    Complete discovery pipeline for MCP crypto tools.
    
    Workflow:
    1. Scan GitHub for MCP repositories
    2. Enrich repos with metadata
    3. Clone and analyze each repo
    4. Security scan
    5. Submit to registry
    """
    
    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self.scanner = GitHubScanner(self.config.scanner_config)
        self.analyzer = ToolAnalyzer(self.config.analyzer_config)
        self.submitter = RegistrySubmitter(self.config.submitter_config)
        
        self._work_dir: Optional[Path] = None
        self._errors: List[str] = []
    
    async def __aenter__(self) -> "DiscoveryPipeline":
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cleanup()
    
    async def initialize(self) -> None:
        """Initialize all components."""
        # Set up work directory
        if self.config.work_dir:
            self._work_dir = Path(self.config.work_dir)
            self._work_dir.mkdir(parents=True, exist_ok=True)
        else:
            self._work_dir = Path(tempfile.mkdtemp(prefix="lyra_discovery_"))
        
        # Initialize components
        await self.analyzer.initialize()
        
        logger.info(f"Pipeline initialized, work dir: {self._work_dir}")
    
    async def cleanup(self) -> None:
        """Clean up resources."""
        await self.scanner.close()
        await self.submitter.close()
        
        if self.config.cleanup_after and self._work_dir and self._work_dir.exists():
            try:
                shutil.rmtree(self._work_dir)
                logger.info(f"Cleaned up work dir: {self._work_dir}")
            except Exception as e:
                logger.warning(f"Failed to clean up work dir: {e}")
    
    async def _clone_repo(self, repo: DiscoveredRepo) -> Optional[Path]:
        """Clone a repository to the work directory."""
        if not self._work_dir:
            raise RuntimeError("Pipeline not initialized")
        
        repo_dir = self._work_dir / repo.name
        
        if repo_dir.exists():
            shutil.rmtree(repo_dir)
        
        try:
            # Use git clone with depth 1
            import subprocess
            
            result = subprocess.run(
                [
                    "git", "clone",
                    "--depth", str(self.config.analyzer_config.clone_depth),
                    "--single-branch",
                    repo.clone_url,
                    str(repo_dir),
                ],
                capture_output=True,
                text=True,
                timeout=self.config.analyzer_config.clone_timeout,
            )
            
            if result.returncode != 0:
                logger.error(f"Failed to clone {repo.full_name}: {result.stderr}")
                return None
            
            return repo_dir
            
        except subprocess.TimeoutExpired:
            logger.error(f"Clone timed out for {repo.full_name}")
            return None
        except Exception as e:
            logger.error(f"Clone failed for {repo.full_name}: {e}")
            return None
    
    async def _analyze_repo(self, repo: DiscoveredRepo) -> Optional[AnalyzedTool]:
        """Clone and analyze a single repository."""
        logger.info(f"Analyzing {repo.full_name}...")
        
        # Clone
        repo_dir = await self._clone_repo(repo)
        if not repo_dir:
            self._errors.append(f"Failed to clone {repo.full_name}")
            return None
        
        try:
            # Analyze
            analyzed = await self.analyzer.analyze_repository(
                repo_path=str(repo_dir),
                repo_url=repo.url,
                repo_full_name=repo.full_name,
            )
            
            logger.info(
                f"Found {analyzed.total_tools} tools in {repo.full_name} "
                f"(quality: {analyzed.quality_score:.1f}, security: {analyzed.security_score:.1f})"
            )
            
            return analyzed
            
        except Exception as e:
            logger.error(f"Analysis failed for {repo.full_name}: {e}")
            self._errors.append(f"Analysis failed for {repo.full_name}: {e}")
            return None
        
        finally:
            # Clean up clone
            if self.config.cleanup_after and repo_dir.exists():
                shutil.rmtree(repo_dir)
    
    async def run(
        self,
        queries: Optional[List[str]] = None,
        days_back: Optional[int] = None,
        submit: bool = True,
    ) -> PipelineResult:
        """
        Run the complete discovery pipeline.
        
        Args:
            queries: Custom search queries (optional)
            days_back: How many days back to search
            submit: Whether to submit to registry
            
        Returns:
            Pipeline execution results
        """
        started_at = datetime.now(timezone.utc)
        self._errors = []
        
        # Phase 1: Discover repositories
        logger.info("Phase 1: Discovering repositories...")
        discovered_repos = await self.scanner.scan_and_enrich(
            queries=queries,
            days_back=days_back,
            enrich=True,
        )
        
        # Filter by quality
        filtered_repos = [
            repo for repo in discovered_repos
            if repo.quality.value >= self.config.min_repo_quality.value
            and repo.full_name not in self.config.skip_repos
        ]
        
        logger.info(f"Discovered {len(discovered_repos)} repos, {len(filtered_repos)} passed quality filter")
        
        # Phase 2: Analyze repositories
        logger.info("Phase 2: Analyzing repositories...")
        analyzed_repos: List[AnalyzedTool] = []
        
        # Analyze in batches for parallel processing
        semaphore = asyncio.Semaphore(self.config.parallel_analysis)
        
        async def analyze_with_semaphore(repo: DiscoveredRepo) -> Optional[AnalyzedTool]:
            async with semaphore:
                return await self._analyze_repo(repo)
        
        tasks = [analyze_with_semaphore(repo) for repo in filtered_repos]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, Exception):
                self._errors.append(str(result))
            elif result is not None:
                analyzed_repos.append(result)
        
        logger.info(f"Analyzed {len(analyzed_repos)} repositories")
        
        # Phase 3: Submit to registry
        submission_results: Dict[str, List[SubmissionResult]] = {}
        
        if submit and analyzed_repos:
            logger.info("Phase 3: Submitting to registry...")
            submission_results = await self.submitter.submit_batch(analyzed_repos)
        
        # Calculate statistics
        completed_at = datetime.now(timezone.utc)
        
        total_tools = sum(a.total_tools for a in analyzed_repos)
        tools_submitted = sum(
            len([r for r in results if r.status != SubmissionStatus.REJECTED])
            for results in submission_results.values()
        )
        tools_accepted = sum(
            len([r for r in results if r.status == SubmissionStatus.ACCEPTED])
            for results in submission_results.values()
        )
        tools_rejected = sum(
            len([r for r in results if r.status == SubmissionStatus.REJECTED])
            for results in submission_results.values()
        )
        
        high_quality = len([r for r in discovered_repos if r.quality == RepoQuality.HIGH])
        medium_quality = len([r for r in discovered_repos if r.quality == RepoQuality.MEDIUM])
        low_quality = len([r for r in discovered_repos if r.quality == RepoQuality.LOW])
        
        result = PipelineResult(
            started_at=started_at,
            completed_at=completed_at,
            duration_seconds=(completed_at - started_at).total_seconds(),
            repos_discovered=len(discovered_repos),
            repos_analyzed=len(analyzed_repos),
            repos_submitted=len([r for r in submission_results.values() if r]),
            total_tools_found=total_tools,
            tools_submitted=tools_submitted,
            tools_accepted=tools_accepted,
            tools_rejected=tools_rejected,
            high_quality_repos=high_quality,
            medium_quality_repos=medium_quality,
            low_quality_repos=low_quality,
            discovered_repos=[r.to_dict() for r in discovered_repos],
            analyzed_repos=[a.to_dict() for a in analyzed_repos],
            submission_results={
                k: [r.to_dict() for r in v]
                for k, v in submission_results.items()
            },
            errors=self._errors,
        )
        
        # Save results
        if self.config.save_results:
            await self._save_results(result)
        
        logger.info(result.summary())
        return result
    
    async def _save_results(self, result: PipelineResult) -> None:
        """Save pipeline results to disk."""
        results_dir = Path(self.config.results_dir)
        results_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = result.started_at.strftime("%Y%m%d_%H%M%S")
        filename = f"discovery_{timestamp}.json"
        
        filepath = results_dir / filename
        
        try:
            with open(filepath, "w") as f:
                json.dump(result.to_dict(), f, indent=2)
            logger.info(f"Results saved to {filepath}")
        except Exception as e:
            logger.error(f"Failed to save results: {e}")
    
    async def scan_only(
        self,
        queries: Optional[List[str]] = None,
        days_back: Optional[int] = None,
    ) -> List[DiscoveredRepo]:
        """
        Run only the scanning phase (no analysis or submission).
        
        Useful for previewing what would be discovered.
        """
        return await self.scanner.scan_and_enrich(
            queries=queries,
            days_back=days_back,
            enrich=True,
        )
    
    async def analyze_single(self, repo_url: str) -> Optional[AnalyzedTool]:
        """
        Analyze a single repository by URL.
        
        Args:
            repo_url: GitHub repository URL
            
        Returns:
            Analysis results or None if failed
        """
        # Parse URL to get owner/repo
        import re
        match = re.match(r'https?://github\.com/([^/]+)/([^/]+)/?', repo_url)
        if not match:
            raise ValueError(f"Invalid GitHub URL: {repo_url}")
        
        owner, name = match.groups()
        full_name = f"{owner}/{name}"
        
        # Create a minimal DiscoveredRepo
        repo = DiscoveredRepo(
            full_name=full_name,
            url=repo_url,
            description=None,
            stars=0,
            forks=0,
            watchers=0,
            open_issues=0,
            default_branch="main",
            topics=[],
            language=None,
        )
        
        return await self._analyze_repo(repo)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get combined statistics from all components."""
        return {
            "scanner": self.scanner.get_stats(),
            "analyzer": self.analyzer.get_stats(),
            "submitter": self.submitter.get_stats(),
            "errors": self._errors,
        }


# Convenience function for CLI usage
async def run_discovery(
    days_back: int = 7,
    submit: bool = False,
    dry_run: bool = True,
    github_token: Optional[str] = None,
    registry_url: Optional[str] = None,
) -> PipelineResult:
    """
    Convenience function to run discovery pipeline.
    
    Args:
        days_back: How many days back to search
        submit: Whether to submit to registry
        dry_run: If True, don't actually submit
        github_token: GitHub API token
        registry_url: Registry API URL
        
    Returns:
        Pipeline results
    """
    config = PipelineConfig(
        scanner_config=GitHubScanConfig(github_token=github_token),
        submitter_config=SubmitterConfig(
            registry_url=registry_url or "http://localhost:3002/api",
            dry_run=dry_run,
        ),
    )
    
    async with DiscoveryPipeline(config) as pipeline:
        return await pipeline.run(days_back=days_back, submit=submit)
