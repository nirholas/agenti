"""
Comprehensive Test Suite for Lyra Intel.

Run with: python -m pytest tests/ -v
Or with: python cli.py test
"""

import asyncio
import pytest
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestCoreEngine:
    """Tests for core engine."""
    
    def test_import_engine(self):
        from src.core.engine import LyraIntelEngine, EngineConfig, ProcessingMode
        assert LyraIntelEngine is not None
        assert EngineConfig is not None
        assert ProcessingMode is not None
    
    def test_engine_config_defaults(self):
        from src.core.engine import EngineConfig, ProcessingMode
        config = EngineConfig()
        assert config.mode == ProcessingMode.LOCAL
    
    def test_engine_instantiation(self):
        from src.core.engine import LyraIntelEngine, EngineConfig
        config = EngineConfig()
        engine = LyraIntelEngine(config)
        assert engine is not None


class TestCollectors:
    """Tests for data collectors."""
    
    def test_import_file_crawler(self):
        from src.collectors.file_crawler import FileCrawler
        assert FileCrawler is not None
    
    def test_import_git_collector(self):
        from src.collectors.git_collector import GitCollector
        assert GitCollector is not None
    
    @pytest.mark.asyncio
    async def test_file_crawler_collect(self):
        from src.collectors.file_crawler import FileCrawler
        crawler = FileCrawler()
        files = await crawler.collect_all(".")
        assert len(files) > 0


class TestAnalyzers:
    """Tests for code analyzers."""
    
    def test_import_ast_analyzer(self):
        from src.analyzers.ast_analyzer import ASTAnalyzer
        assert ASTAnalyzer is not None
    
    def test_import_pattern_detector(self):
        from src.analyzers.pattern_detector import PatternDetector
        assert PatternDetector is not None
    
    def test_import_dependency_mapper(self):
        from src.analyzers.dependency_mapper import DependencyMapper
        assert DependencyMapper is not None
    
    def test_ast_analyzer_instantiation(self):
        from src.analyzers.ast_analyzer import ASTAnalyzer
        analyzer = ASTAnalyzer()
        assert analyzer is not None
    
    @pytest.mark.asyncio
    async def test_ast_analyzer_parse(self):
        from src.analyzers.ast_analyzer import ASTAnalyzer
        analyzer = ASTAnalyzer()
        # Analyze this test file
        results = await analyzer.analyze_files([__file__])
        assert len(results) > 0


class TestForensics:
    """Tests for forensic analysis."""
    
    def test_import_forensic_analyzer(self):
        from src.forensics.forensic_analyzer import ForensicAnalyzer, ForensicConfig
        assert ForensicAnalyzer is not None
        assert ForensicConfig is not None
    
    def test_import_complexity_analyzer(self):
        from src.forensics.complexity_analyzer import ComplexityAnalyzer, ComplexityRating
        assert ComplexityAnalyzer is not None
        assert ComplexityRating is not None
    
    def test_import_dead_code_detector(self):
        from src.forensics.dead_code_detector import DeadCodeDetector, DeadCodeConfig
        assert DeadCodeDetector is not None
        assert DeadCodeConfig is not None
    
    def test_import_doc_mapper(self):
        from src.forensics.doc_mapper import DocumentationMapper
        assert DocumentationMapper is not None
    
    def test_import_archive_indexer(self):
        from src.forensics.archive_indexer import ArchiveIndexer
        assert ArchiveIndexer is not None
    
    def test_complexity_analyzer_basics(self):
        from src.forensics.complexity_analyzer import ComplexityAnalyzer
        analyzer = ComplexityAnalyzer()
        # Analyze this file
        result = analyzer.analyze_file(__file__)
        assert result.total_loc > 0


class TestAuth:
    """Tests for authentication."""
    
    def test_import_api_key_auth(self):
        from src.auth.api_key_auth import APIKeyAuth, APIKey
        assert APIKeyAuth is not None
        assert APIKey is not None
    
    def test_import_jwt_auth(self):
        from src.auth.jwt_auth import JWTAuth, TokenPayload
        assert JWTAuth is not None
        assert TokenPayload is not None
    
    def test_import_rate_limiter(self):
        from src.auth.rate_limiter import RateLimiter, RateLimitConfig
        assert RateLimiter is not None
        assert RateLimitConfig is not None
    
    def test_import_rbac(self):
        from src.auth.rbac import RoleManager, Role, Permission
        assert RoleManager is not None
        assert Role is not None
        assert Permission is not None
    
    def test_api_key_generation(self):
        from src.auth.api_key_auth import APIKeyAuth
        auth = APIKeyAuth()
        key, api_key = auth.generate_key("test", "test_owner")
        assert key.startswith("lyra_")
        assert api_key.name == "test"
    
    def test_api_key_validation(self):
        from src.auth.api_key_auth import APIKeyAuth
        auth = APIKeyAuth()
        key, _ = auth.generate_key("test", "test_owner")
        result = auth.validate_key(key)
        assert result.valid is True
    
    def test_jwt_token_generation(self):
        from src.auth.jwt_auth import JWTAuth
        auth = JWTAuth("test_secret_key_12345")
        token = auth.generate_access_token("user123", ["read", "write"])
        assert token is not None
        assert len(token) > 0
    
    def test_jwt_token_validation(self):
        from src.auth.jwt_auth import JWTAuth
        auth = JWTAuth("test_secret_key_12345")
        token = auth.generate_access_token("user123", ["read"])
        result = auth.validate_token(token)
        assert result.valid is True
        assert result.payload.sub == "user123"
    
    def test_rate_limiter(self):
        from src.auth.rate_limiter import RateLimiter, RateLimitConfig
        config = RateLimitConfig(requests_per_minute=10)
        limiter = RateLimiter(config)
        
        # Should allow first request
        result = limiter.check("user1")
        assert result.allowed is True
    
    def test_rbac_permissions(self):
        from src.auth.rbac import RoleManager, Permission, User
        manager = RoleManager()
        
        # Add a user with viewer role
        user = User(user_id="u1", username="test", roles={"viewer"})
        manager.add_user(user)
        
        # Check permission
        assert manager.has_permission("u1", Permission.READ_ANALYSIS)


class TestNotifications:
    """Tests for notification system."""
    
    def test_import_webhook_manager(self):
        from src.notifications.webhook_manager import WebhookManager, WebhookConfig
        assert WebhookManager is not None
        assert WebhookConfig is not None
    
    def test_import_notification_service(self):
        from src.notifications.notification_service import NotificationService
        assert NotificationService is not None
    
    def test_import_alert_manager(self):
        from src.notifications.alert_manager import AlertManager, Alert, AlertSeverity
        assert AlertManager is not None
        assert Alert is not None
        assert AlertSeverity is not None
    
    def test_webhook_registration(self):
        from src.notifications.webhook_manager import WebhookManager, WebhookConfig, WebhookEvent
        manager = WebhookManager()
        config = WebhookConfig(
            url="https://example.com/webhook",
            events=[WebhookEvent.ANALYSIS_COMPLETED],
        )
        manager.register_webhook("test", config)
        webhooks = manager.list_webhooks()
        assert len(webhooks) == 1
    
    def test_alert_manager_rules(self):
        from src.notifications.alert_manager import AlertManager
        manager = AlertManager()
        manager.setup_default_rules()
        firing = manager.get_firing_alerts()
        assert firing == []


class TestStorage:
    """Tests for storage layer."""
    
    def test_import_database(self):
        from src.storage.database import Database, DatabaseConfig
        assert Database is not None
        assert DatabaseConfig is not None


class TestWeb:
    """Tests for web dashboard."""
    
    def test_import_dashboard(self):
        from src.web.dashboard import Dashboard, DashboardConfig
        assert Dashboard is not None
        assert DashboardConfig is not None
    
    def test_import_visualization_server(self):
        from src.web.visualization_server import VisualizationServer
        assert VisualizationServer is not None
    
    def test_dashboard_render(self):
        from src.web.dashboard import Dashboard
        dashboard = Dashboard()
        html = dashboard.render_html({})
        assert "<!DOCTYPE html>" in html
        assert "Lyra Intel" in html


class TestTesting:
    """Tests for testing framework."""
    
    def test_import_test_runner(self):
        from src.testing.test_runner import TestRunner, TestConfig
        assert TestRunner is not None
        assert TestConfig is not None
    
    def test_import_test_generator(self):
        from src.testing.test_generator import TestGenerator
        assert TestGenerator is not None
    
    def test_import_coverage_analyzer(self):
        from src.testing.coverage_analyzer import CoverageAnalyzer
        assert CoverageAnalyzer is not None
    
    def test_import_benchmark_runner(self):
        from src.testing.benchmark_runner import BenchmarkRunner, Benchmark
        assert BenchmarkRunner is not None
        assert Benchmark is not None


class TestSearch:
    """Tests for search functionality."""
    
    def test_import_code_search(self):
        from src.search.code_search import CodeSearch, SearchOptions
        assert CodeSearch is not None
        assert SearchOptions is not None
    
    def test_import_semantic_search(self):
        from src.search.semantic_search import SemanticSearch
        assert SemanticSearch is not None
    
    def test_code_search_basics(self):
        from src.search.code_search import CodeSearch, SearchOptions
        search = CodeSearch()
        results = search.search("def ", ".")
        assert isinstance(results, list)


class TestPlugins:
    """Tests for plugin system."""
    
    def test_import_plugin_manager(self):
        from src.plugins.plugin_manager import PluginManager
        assert PluginManager is not None
    
    def test_import_plugin_base(self):
        from src.plugins.plugin_base import PluginBase, PluginMeta
        assert PluginBase is not None
        assert PluginMeta is not None


class TestAI:
    """Tests for AI integration."""
    
    def test_import_ai_analyzer(self):
        from src.ai.ai_analyzer import AIAnalyzer, AIConfig
        assert AIAnalyzer is not None
        assert AIConfig is not None
    
    def test_import_providers(self):
        from src.ai.providers import OpenAIProvider, AnthropicProvider, LocalProvider
        assert OpenAIProvider is not None
        assert AnthropicProvider is not None
        assert LocalProvider is not None


class TestCache:
    """Tests for caching layer."""
    
    def test_import_cache(self):
        from src.cache.cache import CacheManager, CacheConfig
        assert CacheManager is not None
        assert CacheConfig is not None
    
    def test_import_backends(self):
        from src.cache.backends import MemoryBackend, FileBackend
        assert MemoryBackend is not None
        assert FileBackend is not None
    
    def test_memory_backend_operations(self):
        from src.cache.backends import MemoryBackend
        backend = MemoryBackend()
        backend.set("key", "value")
        assert backend.get("key") == "value"
        assert backend.get("nonexistent") is None


class TestEvents:
    """Tests for event system."""
    
    def test_import_event_bus(self):
        from src.events.event_bus import EventBus
        assert EventBus is not None
    
    def test_import_event_types(self):
        from src.events.event_types import EventType
        assert EventType is not None


class TestMetrics:
    """Tests for metrics system."""
    
    def test_import_collector(self):
        from src.metrics.collector import MetricsCollector
        assert MetricsCollector is not None
    
    def test_import_dashboard(self):
        from src.metrics.dashboard import MetricsDashboard
        assert MetricsDashboard is not None


class TestPipeline:
    """Tests for data pipeline."""
    
    def test_import_pipeline(self):
        from src.pipeline.pipeline import Pipeline, PipelineConfig
        assert Pipeline is not None
        assert PipelineConfig is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
