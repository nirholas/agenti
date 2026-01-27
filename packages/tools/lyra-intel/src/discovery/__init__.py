"""
Discovery Module - Auto-discover and validate MCP crypto tools from GitHub.

This module provides:
- GitHub scanning for new MCP repositories
- AI-powered tool analysis and categorization
- Security scanning of discovered tools
- Registry submission for approved tools

Components:
- GitHubScanner: Scan GitHub for MCP crypto repositories
- ToolAnalyzer: AI-powered analysis of discovered tools
- RegistrySubmitter: Submit validated tools to Lyra Registry
- DiscoveryPipeline: Complete end-to-end discovery workflow
"""

from .github_scanner import GitHubScanner, GitHubScanConfig, DiscoveredRepo
from .analyzer import ToolAnalyzer, AnalyzedTool, ToolAnalysisConfig
from .submitter import RegistrySubmitter, SubmissionResult, SubmitterConfig
from .pipeline import DiscoveryPipeline, PipelineConfig, PipelineResult

__all__ = [
    # Scanner
    "GitHubScanner",
    "GitHubScanConfig",
    "DiscoveredRepo",
    # Analyzer
    "ToolAnalyzer",
    "AnalyzedTool",
    "ToolAnalysisConfig",
    # Submitter
    "RegistrySubmitter",
    "SubmissionResult",
    "SubmitterConfig",
    # Pipeline
    "DiscoveryPipeline",
    "PipelineConfig",
    "PipelineResult",
]
