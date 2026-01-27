"""
GitHub Scanner - Scan GitHub for new MCP crypto tools.

This module searches GitHub for repositories containing MCP server
implementations related to crypto and DeFi.
"""

import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from enum import Enum

import aiohttp

logger = logging.getLogger(__name__)


class RepoQuality(Enum):
    """Quality tier of a discovered repository."""
    HIGH = "high"        # Well-documented, active, many stars
    MEDIUM = "medium"    # Some docs, moderate activity
    LOW = "low"          # Minimal docs, low activity
    UNKNOWN = "unknown"  # Not yet analyzed


@dataclass
class DiscoveredRepo:
    """Represents a discovered GitHub repository."""
    
    # Basic info
    full_name: str  # owner/repo
    url: str
    description: Optional[str]
    
    # GitHub metadata
    stars: int
    forks: int
    watchers: int
    open_issues: int
    default_branch: str
    
    # Topics/tags
    topics: List[str]
    language: Optional[str]
    languages: Dict[str, int] = field(default_factory=dict)
    
    # Timestamps
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    pushed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    discovered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Analysis fields (populated later)
    has_readme: bool = False
    has_license: bool = False
    has_package_json: bool = False
    has_pyproject: bool = False
    mcp_file_paths: List[str] = field(default_factory=list)
    quality: RepoQuality = RepoQuality.UNKNOWN
    
    # Owner info
    owner_type: str = "User"  # User or Organization
    owner_avatar_url: Optional[str] = None
    
    @property
    def owner(self) -> str:
        return self.full_name.split("/")[0]
    
    @property
    def name(self) -> str:
        return self.full_name.split("/")[1]
    
    @property
    def clone_url(self) -> str:
        return f"https://github.com/{self.full_name}.git"
    
    @property
    def api_url(self) -> str:
        return f"https://api.github.com/repos/{self.full_name}"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "full_name": self.full_name,
            "url": self.url,
            "description": self.description,
            "stars": self.stars,
            "forks": self.forks,
            "watchers": self.watchers,
            "open_issues": self.open_issues,
            "default_branch": self.default_branch,
            "topics": self.topics,
            "language": self.language,
            "languages": self.languages,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "pushed_at": self.pushed_at.isoformat(),
            "discovered_at": self.discovered_at.isoformat(),
            "has_readme": self.has_readme,
            "has_license": self.has_license,
            "has_package_json": self.has_package_json,
            "has_pyproject": self.has_pyproject,
            "mcp_file_paths": self.mcp_file_paths,
            "quality": self.quality.value,
            "owner_type": self.owner_type,
            "owner_avatar_url": self.owner_avatar_url,
        }
    
    @classmethod
    def from_github_api(cls, data: Dict[str, Any]) -> "DiscoveredRepo":
        """Create from GitHub API response."""
        return cls(
            full_name=data["full_name"],
            url=data["html_url"],
            description=data.get("description"),
            stars=data.get("stargazers_count", 0),
            forks=data.get("forks_count", 0),
            watchers=data.get("watchers_count", 0),
            open_issues=data.get("open_issues_count", 0),
            default_branch=data.get("default_branch", "main"),
            topics=data.get("topics", []),
            language=data.get("language"),
            created_at=datetime.fromisoformat(data["created_at"].replace("Z", "+00:00")),
            updated_at=datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00")),
            pushed_at=datetime.fromisoformat(data["pushed_at"].replace("Z", "+00:00")) if data.get("pushed_at") else datetime.now(timezone.utc),
            owner_type=data.get("owner", {}).get("type", "User"),
            owner_avatar_url=data.get("owner", {}).get("avatar_url"),
        )


@dataclass
class GitHubScanConfig:
    """Configuration for GitHub scanning."""
    
    # Authentication
    github_token: Optional[str] = None
    
    # Search parameters
    days_back: int = 7  # How far back to search
    min_stars: int = 0  # Minimum stars required
    languages: List[str] = field(default_factory=lambda: ["TypeScript", "JavaScript", "Python"])
    
    # Rate limiting
    requests_per_minute: int = 30
    delay_between_requests: float = 2.0  # seconds
    
    # Filtering
    exclude_repos: List[str] = field(default_factory=list)  # Repos to skip
    exclude_owners: List[str] = field(default_factory=list)  # Owners to skip
    min_quality: RepoQuality = RepoQuality.LOW
    
    # Search queries
    custom_queries: List[str] = field(default_factory=list)
    
    # Limits
    max_results_per_query: int = 100
    max_total_results: int = 500
    
    def __post_init__(self):
        # Try to get token from environment if not provided
        if not self.github_token:
            self.github_token = os.environ.get("GITHUB_TOKEN")


# Default search queries for crypto MCP tools
DEFAULT_SEARCH_QUERIES = [
    # MCP + Crypto combinations
    "mcp server crypto",
    "mcp server defi",
    "mcp server blockchain",
    "mcp tools crypto",
    "modelcontextprotocol crypto",
    "modelcontextprotocol defi",
    "modelcontextprotocol blockchain",
    
    # Chain-specific
    "mcp server ethereum",
    "mcp server solana",
    "mcp server bitcoin",
    "mcp tools solana",
    "mcp tools ethereum",
    
    # DeFi specific
    "mcp uniswap",
    "mcp dex aggregator",
    "mcp defi protocol",
    "mcp lending protocol",
    "mcp yield farming",
    
    # Wallet/Portfolio
    "mcp wallet",
    "mcp portfolio",
    "mcp token analysis",
    
    # Trading
    "mcp trading",
    "mcp swap",
    "mcp exchange",
]


class GitHubScanner:
    """
    Scanner for finding MCP crypto tools on GitHub.
    
    Features:
    - Rate-limited API access
    - Multiple search strategies
    - Quality scoring
    - Deduplication
    - Metadata enrichment
    """
    
    def __init__(self, config: Optional[GitHubScanConfig] = None):
        self.config = config or GitHubScanConfig()
        self._session: Optional[aiohttp.ClientSession] = None
        self._last_request_time = 0.0
        self._request_count = 0
        
        # Stats
        self._stats = {
            "queries_run": 0,
            "repos_found": 0,
            "repos_filtered": 0,
            "api_calls": 0,
        }
    
    async def __aenter__(self) -> "GitHubScanner":
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def _ensure_session(self) -> None:
        """Ensure aiohttp session is created."""
        if self._session is None or self._session.closed:
            headers = {
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "Lyra-Intel-Discovery/1.0",
            }
            if self.config.github_token:
                headers["Authorization"] = f"token {self.config.github_token}"
            
            self._session = aiohttp.ClientSession(headers=headers)
    
    async def close(self) -> None:
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def _rate_limit(self) -> None:
        """Enforce rate limiting."""
        import time
        current_time = time.time()
        elapsed = current_time - self._last_request_time
        
        if elapsed < self.config.delay_between_requests:
            await asyncio.sleep(self.config.delay_between_requests - elapsed)
        
        self._last_request_time = time.time()
    
    async def _api_request(self, url: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make a rate-limited API request."""
        await self._ensure_session()
        await self._rate_limit()
        
        self._stats["api_calls"] += 1
        
        try:
            async with self._session.get(url, params=params) as response:
                # Check rate limit headers
                remaining = response.headers.get("X-RateLimit-Remaining", "unknown")
                logger.debug(f"GitHub API rate limit remaining: {remaining}")
                
                if response.status == 403:
                    reset_time = response.headers.get("X-RateLimit-Reset")
                    raise Exception(f"GitHub API rate limited. Reset at: {reset_time}")
                
                if response.status == 422:
                    # Validation failed - likely bad query
                    error_data = await response.json()
                    logger.warning(f"GitHub API validation error: {error_data}")
                    return {"items": [], "total_count": 0}
                
                response.raise_for_status()
                return await response.json()
                
        except aiohttp.ClientError as e:
            logger.error(f"GitHub API request failed: {e}")
            raise
    
    async def search_repositories(
        self,
        query: str,
        days_back: Optional[int] = None,
        max_results: Optional[int] = None
    ) -> List[DiscoveredRepo]:
        """
        Search GitHub for repositories matching a query.
        
        Args:
            query: Search query string
            days_back: Override config days_back
            max_results: Override config max_results
            
        Returns:
            List of discovered repositories
        """
        days = days_back or self.config.days_back
        max_res = max_results or self.config.max_results_per_query
        
        # Build date filter
        since_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
        
        # Add date filter and stars filter to query
        full_query = f"{query} pushed:>={since_date}"
        if self.config.min_stars > 0:
            full_query += f" stars:>={self.config.min_stars}"
        
        logger.info(f"Searching GitHub: {full_query}")
        
        repos: List[DiscoveredRepo] = []
        page = 1
        per_page = min(100, max_res)  # GitHub max is 100 per page
        
        while len(repos) < max_res:
            params = {
                "q": full_query,
                "sort": "updated",
                "order": "desc",
                "per_page": per_page,
                "page": page,
            }
            
            try:
                data = await self._api_request(
                    "https://api.github.com/search/repositories",
                    params
                )
            except Exception as e:
                logger.error(f"Search failed for query '{query}': {e}")
                break
            
            items = data.get("items", [])
            if not items:
                break
            
            for item in items:
                if len(repos) >= max_res:
                    break
                
                # Skip excluded repos
                full_name = item["full_name"]
                if full_name in self.config.exclude_repos:
                    self._stats["repos_filtered"] += 1
                    continue
                
                owner = full_name.split("/")[0]
                if owner in self.config.exclude_owners:
                    self._stats["repos_filtered"] += 1
                    continue
                
                repo = DiscoveredRepo.from_github_api(item)
                repos.append(repo)
                self._stats["repos_found"] += 1
            
            page += 1
            
            # GitHub only returns first 1000 results
            if page > 10:
                break
        
        self._stats["queries_run"] += 1
        return repos
    
    async def scan_mcp_repos(
        self,
        queries: Optional[List[str]] = None,
        days_back: Optional[int] = None
    ) -> List[DiscoveredRepo]:
        """
        Scan GitHub for MCP crypto repositories.
        
        Args:
            queries: Custom search queries (defaults to DEFAULT_SEARCH_QUERIES)
            days_back: How many days back to search
            
        Returns:
            Deduplicated list of discovered repositories
        """
        search_queries = queries or self.config.custom_queries or DEFAULT_SEARCH_QUERIES
        all_repos: Dict[str, DiscoveredRepo] = {}  # Deduplicate by full_name
        
        for query in search_queries:
            try:
                repos = await self.search_repositories(query, days_back)
                
                for repo in repos:
                    if repo.full_name not in all_repos:
                        all_repos[repo.full_name] = repo
                        
                # Respect total limit
                if len(all_repos) >= self.config.max_total_results:
                    logger.info(f"Reached max total results: {self.config.max_total_results}")
                    break
                    
            except Exception as e:
                logger.error(f"Query '{query}' failed: {e}")
                continue
        
        logger.info(f"Discovered {len(all_repos)} unique repositories")
        return list(all_repos.values())
    
    async def enrich_repo(self, repo: DiscoveredRepo) -> DiscoveredRepo:
        """
        Enrich a repository with additional metadata.
        
        Fetches:
        - README presence
        - License info
        - package.json / pyproject.toml presence
        - MCP-related file paths
        """
        try:
            # Get repository contents
            contents_url = f"https://api.github.com/repos/{repo.full_name}/contents"
            contents = await self._api_request(contents_url)
            
            if isinstance(contents, list):
                for item in contents:
                    name = item.get("name", "").lower()
                    
                    if name in ("readme.md", "readme.rst", "readme.txt", "readme"):
                        repo.has_readme = True
                    elif name in ("license", "license.md", "license.txt"):
                        repo.has_license = True
                    elif name == "package.json":
                        repo.has_package_json = True
                    elif name in ("pyproject.toml", "setup.py"):
                        repo.has_pyproject = True
            
            # Search for MCP-related files
            await self._find_mcp_files(repo)
            
            # Get languages
            languages_url = f"https://api.github.com/repos/{repo.full_name}/languages"
            repo.languages = await self._api_request(languages_url)
            
            # Calculate quality
            repo.quality = self._calculate_quality(repo)
            
        except Exception as e:
            logger.warning(f"Failed to enrich repo {repo.full_name}: {e}")
        
        return repo
    
    async def _find_mcp_files(self, repo: DiscoveredRepo) -> None:
        """Search for MCP-related files in the repository."""
        # Search for files mentioning MCP
        search_queries = [
            f"repo:{repo.full_name} filename:mcp",
            f"repo:{repo.full_name} modelcontextprotocol in:file",
            f"repo:{repo.full_name} @modelcontextprotocol/sdk in:file",
        ]
        
        mcp_files: set = set()
        
        for query in search_queries:
            try:
                params = {"q": query, "per_page": 20}
                result = await self._api_request(
                    "https://api.github.com/search/code",
                    params
                )
                
                for item in result.get("items", []):
                    mcp_files.add(item.get("path", ""))
                    
            except Exception:
                # Code search might be rate-limited more strictly
                continue
        
        repo.mcp_file_paths = list(mcp_files)
    
    def _calculate_quality(self, repo: DiscoveredRepo) -> RepoQuality:
        """Calculate quality tier based on repository metadata."""
        score = 0
        
        # Stars
        if repo.stars >= 100:
            score += 3
        elif repo.stars >= 20:
            score += 2
        elif repo.stars >= 5:
            score += 1
        
        # Documentation
        if repo.has_readme:
            score += 2
        if repo.has_license:
            score += 1
        
        # Activity (pushed in last 30 days)
        days_since_push = (datetime.now(timezone.utc) - repo.pushed_at).days
        if days_since_push < 30:
            score += 2
        elif days_since_push < 90:
            score += 1
        
        # Has package manager config
        if repo.has_package_json or repo.has_pyproject:
            score += 1
        
        # Has MCP files
        if len(repo.mcp_file_paths) > 0:
            score += 2
        
        # Determine tier
        if score >= 8:
            return RepoQuality.HIGH
        elif score >= 4:
            return RepoQuality.MEDIUM
        elif score >= 1:
            return RepoQuality.LOW
        return RepoQuality.UNKNOWN
    
    def get_stats(self) -> Dict[str, Any]:
        """Get scanning statistics."""
        return {
            **self._stats,
            "config": {
                "days_back": self.config.days_back,
                "min_stars": self.config.min_stars,
                "languages": self.config.languages,
            }
        }
    
    async def scan_and_enrich(
        self,
        queries: Optional[List[str]] = None,
        days_back: Optional[int] = None,
        enrich: bool = True
    ) -> List[DiscoveredRepo]:
        """
        Convenience method: scan for repos and optionally enrich them.
        
        Args:
            queries: Search queries
            days_back: Days to look back
            enrich: Whether to enrich with additional metadata
            
        Returns:
            List of discovered (and optionally enriched) repositories
        """
        repos = await self.scan_mcp_repos(queries, days_back)
        
        if enrich:
            enriched = []
            for repo in repos:
                try:
                    enriched_repo = await self.enrich_repo(repo)
                    enriched.append(enriched_repo)
                except Exception as e:
                    logger.warning(f"Failed to enrich {repo.full_name}: {e}")
                    enriched.append(repo)
            return enriched
        
        return repos
