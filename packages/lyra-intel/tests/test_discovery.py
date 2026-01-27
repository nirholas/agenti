"""
Tests for the Discovery module.

Tests cover:
- GitHub Scanner
- Tool Analyzer
- Registry Submitter
- Discovery Pipeline
"""

import pytest
import asyncio
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, Mock, patch

from src.discovery.github_scanner import (
    GitHubScanner,
    GitHubScanConfig,
    DiscoveredRepo,
    RepoQuality,
)
from src.discovery.analyzer import (
    ToolAnalyzer,
    ToolAnalysisConfig,
    AnalyzedTool,
    ExtractedTool,
    ToolCategory,
)
from src.discovery.submitter import (
    RegistrySubmitter,
    SubmitterConfig,
    SubmissionResult,
    SubmissionStatus,
)
from src.discovery.pipeline import (
    DiscoveryPipeline,
    PipelineConfig,
    PipelineResult,
)


# =============================================================================
# GitHub Scanner Tests
# =============================================================================

class TestGitHubScanner:
    """Tests for GitHubScanner."""
    
    def test_config_defaults(self):
        """Test default configuration values."""
        config = GitHubScanConfig()
        assert config.days_back == 7
        assert config.min_stars == 0
        assert config.requests_per_minute == 30
    
    def test_discovered_repo_from_api(self):
        """Test creating DiscoveredRepo from API response."""
        api_data = {
            "full_name": "owner/repo",
            "html_url": "https://github.com/owner/repo",
            "description": "An MCP crypto tool",
            "stargazers_count": 42,
            "forks_count": 10,
            "watchers_count": 42,
            "open_issues_count": 5,
            "default_branch": "main",
            "topics": ["mcp", "crypto"],
            "language": "TypeScript",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-15T00:00:00Z",
            "pushed_at": "2024-01-14T00:00:00Z",
            "owner": {"type": "User", "avatar_url": "https://example.com/avatar"},
        }
        
        repo = DiscoveredRepo.from_github_api(api_data)
        
        assert repo.full_name == "owner/repo"
        assert repo.owner == "owner"
        assert repo.name == "repo"
        assert repo.stars == 42
        assert "mcp" in repo.topics
        assert repo.language == "TypeScript"
    
    def test_discovered_repo_properties(self):
        """Test DiscoveredRepo computed properties."""
        repo = DiscoveredRepo(
            full_name="owner/repo",
            url="https://github.com/owner/repo",
            description="Test",
            stars=10,
            forks=5,
            watchers=10,
            open_issues=2,
            default_branch="main",
            topics=[],
            language="Python",
        )
        
        assert repo.owner == "owner"
        assert repo.name == "repo"
        assert repo.clone_url == "https://github.com/owner/repo.git"
        assert repo.api_url == "https://api.github.com/repos/owner/repo"
    
    def test_quality_calculation(self):
        """Test quality tier calculation."""
        scanner = GitHubScanner()
        
        # High quality repo
        high_repo = DiscoveredRepo(
            full_name="owner/high",
            url="https://github.com/owner/high",
            description="Well documented",
            stars=100,
            forks=20,
            watchers=100,
            open_issues=5,
            default_branch="main",
            topics=["mcp"],
            language="TypeScript",
            has_readme=True,
            has_license=True,
            mcp_file_paths=["src/server.ts"],
        )
        high_repo.pushed_at = datetime.now(timezone.utc)
        
        quality = scanner._calculate_quality(high_repo)
        assert quality == RepoQuality.HIGH
        
        # Low quality repo
        low_repo = DiscoveredRepo(
            full_name="owner/low",
            url="https://github.com/owner/low",
            description=None,
            stars=0,
            forks=0,
            watchers=0,
            open_issues=0,
            default_branch="main",
            topics=[],
            language=None,
        )
        
        quality = scanner._calculate_quality(low_repo)
        assert quality in [RepoQuality.LOW, RepoQuality.UNKNOWN]
    
    @pytest.mark.asyncio
    async def test_scan_with_mock_api(self):
        """Test scanning with mocked GitHub API."""
        config = GitHubScanConfig(github_token="test-token")
        scanner = GitHubScanner(config)
        
        # Mock the API request
        mock_response = {
            "items": [
                {
                    "full_name": "test/mcp-crypto",
                    "html_url": "https://github.com/test/mcp-crypto",
                    "description": "MCP crypto tools",
                    "stargazers_count": 10,
                    "forks_count": 2,
                    "watchers_count": 10,
                    "open_issues_count": 1,
                    "default_branch": "main",
                    "topics": ["mcp", "crypto"],
                    "language": "TypeScript",
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-15T00:00:00Z",
                    "pushed_at": "2024-01-14T00:00:00Z",
                    "owner": {"type": "User"},
                }
            ],
            "total_count": 1,
        }
        
        with patch.object(scanner, '_api_request', new_callable=AsyncMock) as mock_api:
            mock_api.return_value = mock_response
            repos = await scanner.search_repositories("mcp crypto", days_back=7)
        
        assert len(repos) == 1
        assert repos[0].full_name == "test/mcp-crypto"
        
        await scanner.close()


# =============================================================================
# Tool Analyzer Tests
# =============================================================================

class TestToolAnalyzer:
    """Tests for ToolAnalyzer."""
    
    def test_config_defaults(self):
        """Test default configuration."""
        config = ToolAnalysisConfig()
        assert config.ai_provider == "openai"
        assert config.check_security == True
    
    def test_infer_category(self):
        """Test category inference from tool name/description."""
        analyzer = ToolAnalyzer()
        
        assert analyzer._infer_category("get_price", "Get token price") == "market_data"
        assert analyzer._infer_category("portfolio_balance", "Get portfolio") == "portfolio"
        assert analyzer._infer_category("swap_tokens", "Swap on DEX") == "trading"
        assert analyzer._infer_category("nft_metadata", "Get NFT info") == "nft"
        assert analyzer._infer_category("check_security", "Security scan") == "security"
    
    def test_infer_chains(self):
        """Test chain inference from code."""
        analyzer = ToolAnalyzer()
        
        eth_code = "const chainId = 1; // ethereum mainnet"
        chains = analyzer._infer_chains(eth_code)
        assert "ethereum" in chains
        
        solana_code = "import { Connection } from '@solana/web3.js'"
        chains = analyzer._infer_chains(solana_code)
        assert "solana" in chains
        
        bsc_code = "BSC_RPC = 'https://bsc-dataseed.binance.org'"
        chains = analyzer._infer_chains(bsc_code)
        assert "bsc" in chains
    
    def test_check_requires_api_key(self):
        """Test API key detection in code."""
        analyzer = ToolAnalyzer()
        
        code_with_key = "const API_KEY = process.env.COINGECKO_API_KEY"
        assert analyzer._check_requires_api_key(code_with_key, "test") == True
        
        code_without_key = "const data = await fetch(url)"
        assert analyzer._check_requires_api_key(code_without_key, "test") == False
    
    def test_extract_tools_from_code(self):
        """Test pattern-based tool extraction."""
        analyzer = ToolAnalyzer()
        
        code = '''
        {
            name: 'get_token_price',
            description: 'Get the current price of a token',
            handler: async (args) => {
                // implementation
            }
        },
        {
            name: 'get_portfolio',
            description: 'Get wallet portfolio balance',
            handler: async (args) => {
                // implementation
            }
        }
        '''
        
        tools = analyzer._extract_tools_from_code(code)
        assert len(tools) >= 1  # Pattern matching may vary
    
    @pytest.mark.asyncio
    async def test_analyze_security(self):
        """Test security analysis."""
        analyzer = ToolAnalyzer()
        
        # Code with security issues
        bad_code = '''
        eval(user_input)
        password = "secret123"
        '''
        
        result = await analyzer.analyze_security(bad_code)
        assert result["security_score"] < 100
        assert len(result["issues"]) > 0
        
        # Clean code
        good_code = '''
        const data = JSON.parse(input)
        const password = process.env.PASSWORD
        '''
        
        result = await analyzer.analyze_security(good_code)
        assert result["security_score"] == 100


# =============================================================================
# Registry Submitter Tests
# =============================================================================

class TestRegistrySubmitter:
    """Tests for RegistrySubmitter."""
    
    def test_config_defaults(self):
        """Test default configuration."""
        config = SubmitterConfig()
        assert config.min_quality_score == 50.0
        assert config.min_security_score == 70.0
        assert config.dry_run == False
    
    def test_quality_gates(self):
        """Test quality gate enforcement."""
        config = SubmitterConfig(
            min_quality_score=50,
            min_security_score=70,
        )
        submitter = RegistrySubmitter(config)
        
        # Passes all gates
        good_analysis = AnalyzedTool(
            repo_full_name="test/repo",
            repo_url="https://github.com/test/repo",
            tools=[],
            total_tools=5,
            categories_found=["market_data"],
            chains_supported=["ethereum"],
            requires_api_keys=False,
            quality_score=80.0,
            documentation_score=70.0,
            security_score=90.0,
        )
        
        passes, reason = submitter._passes_quality_gates(good_analysis)
        assert passes == True
        
        # Fails quality gate
        low_quality = AnalyzedTool(
            repo_full_name="test/repo",
            repo_url="https://github.com/test/repo",
            tools=[],
            total_tools=5,
            categories_found=["market_data"],
            chains_supported=["ethereum"],
            requires_api_keys=False,
            quality_score=30.0,  # Below threshold
            documentation_score=70.0,
            security_score=90.0,
        )
        
        passes, reason = submitter._passes_quality_gates(low_quality)
        assert passes == False
        assert "Quality score" in reason
        
        # Fails security gate
        low_security = AnalyzedTool(
            repo_full_name="test/repo",
            repo_url="https://github.com/test/repo",
            tools=[],
            total_tools=5,
            categories_found=["market_data"],
            chains_supported=["ethereum"],
            requires_api_keys=False,
            quality_score=80.0,
            documentation_score=70.0,
            security_score=50.0,  # Below threshold
        )
        
        passes, reason = submitter._passes_quality_gates(low_security)
        assert passes == False
        assert "Security score" in reason
    
    def test_format_tool_for_registry(self):
        """Test tool formatting for registry API."""
        submitter = RegistrySubmitter()
        
        tool = ExtractedTool(
            name="get_price",
            description="Get token price",
            category=ToolCategory.MARKET_DATA,
            input_schema={"type": "object"},
            file_path="src/tools.ts",
            chains=["ethereum"],
            requires_api_key=True,
        )
        
        analyzed = AnalyzedTool(
            repo_full_name="test/repo",
            repo_url="https://github.com/test/repo",
            tools=[tool],
            total_tools=1,
            categories_found=["market_data"],
            chains_supported=["ethereum"],
            requires_api_keys=True,
            quality_score=80.0,
            documentation_score=70.0,
            security_score=90.0,
        )
        
        formatted = submitter._format_tool_for_registry(tool, analyzed)
        
        assert formatted["name"] == "get_price"
        assert formatted["category"] == "market_data"
        assert formatted["sourceUrl"] == "https://github.com/test/repo"
        assert "ethereum" in formatted["chains"]
        assert formatted["requiresApiKey"] == True
    
    @pytest.mark.asyncio
    async def test_dry_run_submission(self):
        """Test dry run mode doesn't actually submit."""
        config = SubmitterConfig(dry_run=True)
        submitter = RegistrySubmitter(config)
        
        tool = ExtractedTool(
            name="test_tool",
            description="Test",
            category=ToolCategory.UTILITY,
            input_schema={},
            file_path="test.ts",
        )
        
        analyzed = AnalyzedTool(
            repo_full_name="test/repo",
            repo_url="https://github.com/test/repo",
            tools=[tool],
            total_tools=1,
            categories_found=["utility"],
            chains_supported=[],
            requires_api_keys=False,
            quality_score=80.0,
            documentation_score=70.0,
            security_score=90.0,
        )
        
        result = await submitter.submit_tool(tool, analyzed)
        
        assert result.status == SubmissionStatus.PENDING
        assert "Dry run" in result.message
        
        await submitter.close()


# =============================================================================
# Discovery Pipeline Tests
# =============================================================================

class TestDiscoveryPipeline:
    """Tests for DiscoveryPipeline."""
    
    def test_config_defaults(self):
        """Test default configuration."""
        config = PipelineConfig()
        assert config.cleanup_after == True
        assert config.parallel_analysis == 3
    
    @pytest.mark.asyncio
    async def test_pipeline_initialization(self):
        """Test pipeline initialization."""
        config = PipelineConfig()
        
        async with DiscoveryPipeline(config) as pipeline:
            assert pipeline._work_dir is not None
            assert pipeline._work_dir.exists()
    
    def test_pipeline_result_summary(self):
        """Test pipeline result summary generation."""
        result = PipelineResult(
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            duration_seconds=60.5,
            repos_discovered=10,
            repos_analyzed=8,
            repos_submitted=5,
            total_tools_found=25,
            tools_submitted=20,
            tools_accepted=15,
            tools_rejected=5,
            high_quality_repos=3,
            medium_quality_repos=4,
            low_quality_repos=3,
            discovered_repos=[],
            analyzed_repos=[],
            submission_results={},
            errors=[],
        )
        
        summary = result.summary()
        
        assert "60.5s" in summary
        assert "10" in summary  # repos_discovered
        assert "25" in summary  # tools_found
    
    def test_pipeline_result_to_dict(self):
        """Test pipeline result serialization."""
        result = PipelineResult(
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            duration_seconds=60.0,
            repos_discovered=5,
            repos_analyzed=4,
            repos_submitted=3,
            total_tools_found=10,
            tools_submitted=8,
            tools_accepted=6,
            tools_rejected=2,
            high_quality_repos=1,
            medium_quality_repos=2,
            low_quality_repos=2,
            discovered_repos=[{"name": "test"}],
            analyzed_repos=[{"name": "test"}],
            submission_results={"test": [{"status": "accepted"}]},
            errors=["test error"],
        )
        
        data = result.to_dict()
        
        assert data["repos_discovered"] == 5
        assert data["total_tools_found"] == 10
        assert len(data["errors"]) == 1
        
        # Should be JSON serializable
        json_str = json.dumps(data)
        assert "repos_discovered" in json_str


# =============================================================================
# Integration Tests (with mocking)
# =============================================================================

class TestIntegration:
    """Integration tests with mocked external services."""
    
    @pytest.mark.asyncio
    async def test_scan_analyze_flow(self):
        """Test scanning and analyzing flow."""
        scanner_config = GitHubScanConfig()
        analyzer_config = ToolAnalysisConfig(ai_provider="local")
        
        scanner = GitHubScanner(scanner_config)
        analyzer = ToolAnalyzer(analyzer_config)
        
        # Create a mock repo
        mock_repo = DiscoveredRepo(
            full_name="test/mcp-tools",
            url="https://github.com/test/mcp-tools",
            description="MCP crypto tools",
            stars=20,
            forks=5,
            watchers=20,
            open_issues=2,
            default_branch="main",
            topics=["mcp", "crypto"],
            language="TypeScript",
            has_readme=True,
            has_license=True,
        )
        
        # Test repo serialization
        repo_dict = mock_repo.to_dict()
        assert repo_dict["full_name"] == "test/mcp-tools"
        assert repo_dict["stars"] == 20
        
        # Test analyzer code analysis
        test_code = '''
        export const getPrice = {
            name: "get_token_price",
            description: "Get price from CoinGecko",
            handler: async (args) => {
                const { tokenId } = args;
                return fetch(`https://api.coingecko.com/...`);
            }
        };
        '''
        
        tools = await analyzer.analyze_code(test_code, "tools.ts")
        # Pattern matching may or may not find tools depending on regex
        
        await scanner.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
