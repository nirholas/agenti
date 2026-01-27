"""
Registry Submitter - Submit validated tools to the Lyra Registry.

Handles:
- Formatting tools for registry API
- Authentication with registry
- Submission and retry logic
- Tracking submission status
"""

import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from enum import Enum

import aiohttp

from .analyzer import AnalyzedTool, ExtractedTool

logger = logging.getLogger(__name__)


class SubmissionStatus(Enum):
    """Status of a registry submission."""
    PENDING = "pending"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    ERROR = "error"


@dataclass
class SubmissionResult:
    """Result of submitting a tool to the registry."""
    
    tool_name: str
    repo_full_name: str
    status: SubmissionStatus
    registry_id: Optional[str] = None
    message: Optional[str] = None
    submitted_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    response_data: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool_name": self.tool_name,
            "repo_full_name": self.repo_full_name,
            "status": self.status.value,
            "registry_id": self.registry_id,
            "message": self.message,
            "submitted_at": self.submitted_at.isoformat(),
            "response_data": self.response_data,
        }


@dataclass
class SubmitterConfig:
    """Configuration for the registry submitter."""
    
    # Registry API settings
    registry_url: str = "http://localhost:3002/api"  # Default local dev
    registry_api_key: Optional[str] = None
    
    # Submission settings
    min_quality_score: float = 50.0  # Minimum quality score to submit
    min_security_score: float = 70.0  # Minimum security score to submit
    dry_run: bool = False  # If true, don't actually submit
    
    # Rate limiting
    requests_per_minute: int = 30
    delay_between_requests: float = 1.0
    
    # Retry settings
    max_retries: int = 3
    retry_delay: float = 5.0
    
    # Batch settings
    batch_size: int = 10
    
    def __post_init__(self):
        if not self.registry_api_key:
            self.registry_api_key = os.environ.get("LYRA_REGISTRY_API_KEY")
        if not self.registry_url:
            self.registry_url = os.environ.get(
                "LYRA_REGISTRY_URL",
                "http://localhost:3002/api"
            )


class RegistrySubmitter:
    """
    Submits analyzed tools to the Lyra Registry.
    
    Features:
    - Quality gate enforcement
    - Rate-limited submissions
    - Retry logic
    - Batch submissions
    - Dry-run mode for testing
    """
    
    def __init__(self, config: Optional[SubmitterConfig] = None):
        self.config = config or SubmitterConfig()
        self._session: Optional[aiohttp.ClientSession] = None
        self._last_request_time = 0.0
        
        self._stats = {
            "submitted": 0,
            "accepted": 0,
            "rejected": 0,
            "errors": 0,
            "skipped_quality": 0,
            "skipped_security": 0,
        }
    
    async def __aenter__(self) -> "RegistrySubmitter":
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def _ensure_session(self) -> None:
        """Ensure aiohttp session is created."""
        if self._session is None or self._session.closed:
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "Lyra-Intel-Discovery/1.0",
            }
            if self.config.registry_api_key:
                headers["Authorization"] = f"Bearer {self.config.registry_api_key}"
            
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
    
    def _format_tool_for_registry(
        self,
        tool: ExtractedTool,
        analyzed: AnalyzedTool
    ) -> Dict[str, Any]:
        """Format a tool for the registry API."""
        return {
            "name": tool.name,
            "description": tool.description,
            "category": tool.category.value,
            "version": "1.0.0",
            
            # Source info
            "sourceType": "github",
            "sourceUrl": analyzed.repo_url,
            "mcpServerUrl": None,  # Will be set when deployed
            
            # Schema
            "inputSchema": tool.input_schema,
            
            # Metadata
            "tags": [tool.category.value] + tool.chains,
            "chains": tool.chains,
            "requiresApiKey": tool.requires_api_key,
            
            # Scores (to be recalculated by registry)
            "scoreData": {
                "hasTools": True,
                "hasReadme": analyzed.documentation_score > 50,
                "hasLicense": True,  # Assumed if we got this far
                "qualityScore": analyzed.quality_score,
                "securityScore": analyzed.security_score,
            },
            
            # Discovery metadata
            "discoveredAt": datetime.now(timezone.utc).isoformat(),
            "discoveredBy": "lyra-intel",
        }
    
    def _passes_quality_gates(self, analyzed: AnalyzedTool) -> tuple[bool, str]:
        """Check if analysis passes quality gates for submission."""
        
        if analyzed.quality_score < self.config.min_quality_score:
            return False, f"Quality score {analyzed.quality_score:.1f} below threshold {self.config.min_quality_score}"
        
        if analyzed.security_score < self.config.min_security_score:
            return False, f"Security score {analyzed.security_score:.1f} below threshold {self.config.min_security_score}"
        
        if analyzed.total_tools == 0:
            return False, "No tools found in repository"
        
        return True, "Passes all quality gates"
    
    async def submit_tool(
        self,
        tool: ExtractedTool,
        analyzed: AnalyzedTool
    ) -> SubmissionResult:
        """
        Submit a single tool to the registry.
        
        Args:
            tool: The extracted tool to submit
            analyzed: The analyzed repository context
            
        Returns:
            Submission result
        """
        await self._ensure_session()
        
        # Check quality gates
        passes, reason = self._passes_quality_gates(analyzed)
        if not passes:
            if analyzed.security_score < self.config.min_security_score:
                self._stats["skipped_security"] += 1
            else:
                self._stats["skipped_quality"] += 1
            
            return SubmissionResult(
                tool_name=tool.name,
                repo_full_name=analyzed.repo_full_name,
                status=SubmissionStatus.REJECTED,
                message=reason,
            )
        
        # Format for registry
        tool_data = self._format_tool_for_registry(tool, analyzed)
        
        # Dry run mode
        if self.config.dry_run:
            logger.info(f"[DRY RUN] Would submit tool: {tool.name}")
            return SubmissionResult(
                tool_name=tool.name,
                repo_full_name=analyzed.repo_full_name,
                status=SubmissionStatus.PENDING,
                message="Dry run - not actually submitted",
                response_data=tool_data,
            )
        
        # Submit with retries
        for attempt in range(self.config.max_retries):
            try:
                await self._rate_limit()
                
                url = f"{self.config.registry_url}/tools"
                
                async with self._session.post(url, json=tool_data) as response:
                    response_data = await response.json()
                    
                    if response.status in (200, 201):
                        self._stats["submitted"] += 1
                        self._stats["accepted"] += 1
                        
                        return SubmissionResult(
                            tool_name=tool.name,
                            repo_full_name=analyzed.repo_full_name,
                            status=SubmissionStatus.ACCEPTED,
                            registry_id=response_data.get("id"),
                            message="Successfully submitted",
                            response_data=response_data,
                        )
                    
                    elif response.status == 409:
                        # Already exists
                        self._stats["submitted"] += 1
                        return SubmissionResult(
                            tool_name=tool.name,
                            repo_full_name=analyzed.repo_full_name,
                            status=SubmissionStatus.REJECTED,
                            message="Tool already exists in registry",
                            response_data=response_data,
                        )
                    
                    elif response.status >= 500:
                        # Server error - retry
                        logger.warning(f"Server error, retrying: {response.status}")
                        await asyncio.sleep(self.config.retry_delay)
                        continue
                    
                    else:
                        # Client error - don't retry
                        self._stats["rejected"] += 1
                        return SubmissionResult(
                            tool_name=tool.name,
                            repo_full_name=analyzed.repo_full_name,
                            status=SubmissionStatus.REJECTED,
                            message=f"Registry rejected: {response.status}",
                            response_data=response_data,
                        )
                        
            except aiohttp.ClientError as e:
                logger.error(f"Network error on attempt {attempt + 1}: {e}")
                if attempt < self.config.max_retries - 1:
                    await asyncio.sleep(self.config.retry_delay)
                continue
            
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                self._stats["errors"] += 1
                return SubmissionResult(
                    tool_name=tool.name,
                    repo_full_name=analyzed.repo_full_name,
                    status=SubmissionStatus.ERROR,
                    message=str(e),
                )
        
        # All retries exhausted
        self._stats["errors"] += 1
        return SubmissionResult(
            tool_name=tool.name,
            repo_full_name=analyzed.repo_full_name,
            status=SubmissionStatus.ERROR,
            message="Max retries exceeded",
        )
    
    async def submit_analyzed_repo(
        self,
        analyzed: AnalyzedTool
    ) -> List[SubmissionResult]:
        """
        Submit all tools from an analyzed repository.
        
        Args:
            analyzed: The analyzed repository
            
        Returns:
            List of submission results for each tool
        """
        results = []
        
        # Check quality gates once for the whole repo
        passes, reason = self._passes_quality_gates(analyzed)
        if not passes:
            logger.info(f"Skipping {analyzed.repo_full_name}: {reason}")
            for tool in analyzed.tools:
                results.append(SubmissionResult(
                    tool_name=tool.name,
                    repo_full_name=analyzed.repo_full_name,
                    status=SubmissionStatus.REJECTED,
                    message=reason,
                ))
            return results
        
        # Submit each tool
        for tool in analyzed.tools:
            result = await self.submit_tool(tool, analyzed)
            results.append(result)
            
            # Small delay between tools in same repo
            await asyncio.sleep(0.5)
        
        return results
    
    async def submit_batch(
        self,
        analyzed_repos: List[AnalyzedTool]
    ) -> Dict[str, List[SubmissionResult]]:
        """
        Submit multiple analyzed repositories in batch.
        
        Args:
            analyzed_repos: List of analyzed repositories
            
        Returns:
            Dictionary mapping repo names to submission results
        """
        all_results: Dict[str, List[SubmissionResult]] = {}
        
        for analyzed in analyzed_repos:
            logger.info(f"Submitting {analyzed.total_tools} tools from {analyzed.repo_full_name}")
            results = await self.submit_analyzed_repo(analyzed)
            all_results[analyzed.repo_full_name] = results
        
        return all_results
    
    async def check_registry_health(self) -> Dict[str, Any]:
        """Check if the registry API is healthy."""
        await self._ensure_session()
        
        try:
            url = f"{self.config.registry_url}/health"
            async with self._session.get(url) as response:
                if response.status == 200:
                    return {"healthy": True, "data": await response.json()}
                else:
                    return {"healthy": False, "status": response.status}
        except Exception as e:
            return {"healthy": False, "error": str(e)}
    
    def get_stats(self) -> Dict[str, Any]:
        """Get submission statistics."""
        total = self._stats["submitted"] + self._stats["skipped_quality"] + self._stats["skipped_security"]
        
        return {
            **self._stats,
            "total_processed": total,
            "acceptance_rate": (
                self._stats["accepted"] / max(self._stats["submitted"], 1) * 100
            ),
            "config": {
                "registry_url": self.config.registry_url,
                "min_quality_score": self.config.min_quality_score,
                "min_security_score": self.config.min_security_score,
                "dry_run": self.config.dry_run,
            }
        }
