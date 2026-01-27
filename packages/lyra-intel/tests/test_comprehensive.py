"""
Comprehensive test suite for Lyra Intel.

Tests cover:
- Core analysis engine
- Security scanning
- AI integration
- API endpoints
- Plugins
"""

import pytest
import asyncio
from pathlib import Path
import json

# Core Engine Tests
class TestAnalysisEngine:
    """Test core analysis engine."""
    
    @pytest.mark.asyncio
    async def test_basic_analysis(self):
        """Test basic code analysis."""
        from src.core.engine import LyraIntelEngine, EngineConfig, ProcessingMode
        
        config = EngineConfig(mode=ProcessingMode.LOCAL, max_workers=2)
        engine = LyraIntelEngine(config)
        
        # Create test file
        test_code = '''
def hello_world():
    """Say hello."""
    print("Hello, World!")
    return True

hello_world()
'''
        
        test_file = Path("/tmp/test_analysis.py")
        test_file.write_text(test_code)
        
        result = await engine.analyze_file(str(test_file))
        
        assert result is not None
        assert "metrics" in result
        assert result["metrics"]["total_lines"] > 0
        
        test_file.unlink()
    
    @pytest.mark.asyncio
    async def test_multiple_files(self):
        """Test analyzing multiple files."""
        from src.core.engine import LyraIntelEngine, EngineConfig
        
        engine = LyraIntelEngine(EngineConfig())
        
        files = {
            "file1.py": "def foo(): pass",
            "file2.py": "def bar(): pass",
            "file3.py": "def baz(): pass",
        }
        
        test_dir = Path("/tmp/test_multi")
        test_dir.mkdir(exist_ok=True)
        
        for name, content in files.items():
            (test_dir / name).write_text(content)
        
        result = await engine.analyze_repository(str(test_dir))
        
        assert result["metrics"]["total_files"] == 3
        
        # Cleanup
        for name in files:
            (test_dir / name).unlink()
        test_dir.rmdir()


class TestSecurityScanner:
    """Test security scanning."""
    
    @pytest.mark.asyncio
    async def test_detect_hardcoded_secrets(self):
        """Test detection of hardcoded secrets."""
        from src.security.scanner import SecurityScanner
        
        code = '''
api_key = "sk_live_abc123def456"
password = "MyPassword123"
token = "ghp_abc123def456"
'''
        
        scanner = SecurityScanner()
        findings = await scanner.scan_code(code, "python")
        
        assert len(findings) > 0
        assert any(f.type == "hardcoded-secret" for f in findings)
    
    @pytest.mark.asyncio
    async def test_detect_sql_injection(self):
        """Test SQL injection detection."""
        from src.security.scanner import SecurityScanner
        
        code = '''
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id={user_id}"
    return db.execute(query)
'''
        
        scanner = SecurityScanner()
        findings = await scanner.scan_code(code, "python")
        
        assert any(f.type == "sql-injection" for f in findings)
    
    @pytest.mark.asyncio
    async def test_no_false_positives(self):
        """Test that safe code doesn't trigger false positives."""
        from src.security.scanner import SecurityScanner
        
        code = '''
import os

def get_config():
    api_key = os.environ.get("API_KEY")
    return {"key": api_key}
'''
        
        scanner = SecurityScanner()
        findings = await scanner.scan_code(code, "python")
        
        # Environment variables should not trigger secrets
        secret_findings = [f for f in findings if f.type == "hardcoded-secret"]
        assert len(secret_findings) == 0


class TestASTAnalyzer:
    """Test AST analyzer."""
    
    def test_parse_python(self):
        """Test Python AST parsing."""
        from src.analyzers.ast_analyzer import ASTAnalyzer
        
        code = '''
class MyClass:
    def method1(self):
        pass
    
    def method2(self, arg):
        return arg * 2
'''
        
        analyzer = ASTAnalyzer()
        result = analyzer.analyze(code, "python")
        
        assert result["classes"] == 1
        assert result["functions"] == 2
    
    def test_parse_typescript(self):
        """Test TypeScript parsing."""
        from src.analyzers.ast_analyzer import ASTAnalyzer
        
        code = '''
interface User {
    name: string;
    age: number;
}

function greet(user: User): string {
    return `Hello, ${user.name}`;
}
'''
        
        analyzer = ASTAnalyzer()
        result = analyzer.analyze(code, "typescript")
        
        assert result["functions"] >= 1


class TestDependencyMapper:
    """Test dependency mapping."""
    
    @pytest.mark.asyncio
    async def test_detect_dependencies(self):
        """Test dependency detection."""
        from src.analyzers.dependency_mapper import DependencyMapper
        
        code = '''
import os
import sys
from pathlib import Path
from typing import Dict, List
'''
        
        mapper = DependencyMapper()
        deps = await mapper.analyze_file(code, "python")
        
        assert "os" in deps["imports"]
        assert "sys" in deps["imports"]
        assert "pathlib" in deps["imports"]
    
    @pytest.mark.asyncio
    async def test_detect_circular_deps(self):
        """Test circular dependency detection."""
        from src.analyzers.dependency_mapper import DependencyMapper
        
        # Create test files with circular deps
        test_dir = Path("/tmp/test_circular")
        test_dir.mkdir(exist_ok=True)
        
        (test_dir / "a.py").write_text("import b")
        (test_dir / "b.py").write_text("import a")
        
        mapper = DependencyMapper()
        graph = await mapper.build_graph(str(test_dir))
        cycles = mapper.find_cycles(graph)
        
        assert len(cycles) > 0
        
        # Cleanup
        (test_dir / "a.py").unlink()
        (test_dir / "b.py").unlink()
        test_dir.rmdir()


class TestAIAnalyzer:
    """Test AI analyzer."""
    
    @pytest.mark.asyncio
    @pytest.mark.skipif(
        not Path.home().joinpath(".lyra-intel/ai-key").exists(),
        reason="AI API key not configured"
    )
    async def test_code_explanation(self):
        """Test AI code explanation."""
        from src.ai.ai_analyzer import AIAnalyzer
        
        code = '''
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
'''
        
        analyzer = AIAnalyzer()
        explanation = await analyzer.explain_code(code, "python")
        
        assert explanation is not None
        assert len(explanation) > 50
        assert "fibonacci" in explanation.lower()


class TestPluginSystem:
    """Test plugin system."""
    
    def test_load_plugin(self):
        """Test loading a plugin."""
        from src.plugins.plugin_manager import PluginManager
        from src.plugins.example_plugins import CodeQualityPlugin
        
        manager = PluginManager()
        plugin = CodeQualityPlugin()
        
        manager.register_plugin(plugin)
        
        assert "code-quality" in manager.list_plugins()
    
    def test_plugin_analyze(self):
        """Test plugin analysis."""
        from src.plugins.example_plugins import CodeQualityPlugin
        
        plugin = CodeQualityPlugin()
        
        code = '''
def long_function():
    line1 = 1
    line2 = 2
    # ... imagine 60 more lines
'''
        
        result = plugin.analyze(code, "python")
        
        assert "quality_score" in result
        assert "issues" in result


class TestSemanticSearch:
    """Test semantic search."""
    
    def test_simple_search(self):
        """Test basic semantic search."""
        from src.search.semantic_search import SemanticSearch
        
        search = SemanticSearch()
        
        # Index some code
        code_units = [
            {
                "file_path": "test.py",
                "name": "authenticate_user",
                "type": "function",
                "docstring": "Authenticate a user with username and password",
                "line_start": 1,
                "line_end": 10,
            }
        ]
        
        files = {"test.py": "def authenticate_user(username, password): pass"}
        
        search.index_code(code_units, files)
        
        # Search
        results = search.search("login authentication")
        
        assert len(results) > 0
        assert results[0].score > 0.3


class TestExportFormats:
    """Test export formats."""
    
    def test_json_export(self):
        """Test JSON export."""
        from src.export.exporter import Exporter
        
        data = {"test": "data", "metrics": {"total": 100}}
        
        exporter = Exporter()
        result = exporter.export(data, "json")
        
        parsed = json.loads(result)
        assert parsed["test"] == "data"
    
    def test_csv_export(self):
        """Test CSV export."""
        from src.export.exporter import Exporter
        
        data = {
            "metrics": [
                {"file": "a.py", "lines": 100},
                {"file": "b.py", "lines": 200},
            ]
        }
        
        exporter = Exporter()
        result = exporter.export(data, "csv")
        
        assert "a.py" in result
        assert "b.py" in result


class TestAPIServer:
    """Test API server."""
    
    @pytest.mark.asyncio
    async def test_health_endpoint(self):
        """Test health check endpoint."""
        from src.api.server import create_app
        
        app = create_app()
        # Would use test client here
        # client = TestClient(app)
        # response = client.get("/api/v1/health")
        # assert response.status_code == 200


# Integration Tests
class TestIntegration:
    """Integration tests."""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_full_analysis_workflow(self):
        """Test complete analysis workflow."""
        from src.core.engine import LyraIntelEngine, EngineConfig
        
        # Create test project
        test_dir = Path("/tmp/test_project")
        test_dir.mkdir(exist_ok=True)
        
        (test_dir / "main.py").write_text('''
import os

def main():
    api_key = "hardcoded_key_123"
    print(f"API Key: {api_key}")

if __name__ == "__main__":
    main()
''')
        
        (test_dir / "utils.py").write_text('''
def helper():
    return True
''')
        
        # Run analysis
        engine = LyraIntelEngine(EngineConfig())
        result = await engine.analyze_repository(str(test_dir))
        
        # Verify results
        assert result["metrics"]["total_files"] == 2
        assert len(result["security"]["findings"]) > 0
        
        # Cleanup
        (test_dir / "main.py").unlink()
        (test_dir / "utils.py").unlink()
        test_dir.rmdir()


# Performance Tests
class TestPerformance:
    """Performance tests."""
    
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_large_file_analysis(self):
        """Test analyzing large files."""
        from src.core.engine import LyraIntelEngine, EngineConfig
        
        # Generate large file
        large_code = "\\n".join([f"def func_{i}(): pass" for i in range(1000)])
        
        test_file = Path("/tmp/large_test.py")
        test_file.write_text(large_code)
        
        engine = LyraIntelEngine(EngineConfig())
        
        import time
        start = time.time()
        result = await engine.analyze_file(str(test_file))
        duration = time.time() - start
        
        assert duration < 10.0  # Should complete in under 10 seconds
        assert result["metrics"]["functions"] == 1000
        
        test_file.unlink()


# Fixtures
@pytest.fixture
def sample_python_code():
    """Sample Python code for testing."""
    return '''
class Calculator:
    def add(self, a, b):
        return a + b
    
    def subtract(self, a, b):
        return a - b
'''


@pytest.fixture
def sample_typescript_code():
    """Sample TypeScript code for testing."""
    return '''
interface User {
    id: number;
    name: string;
}

function getUser(id: number): User {
    return { id, name: "Test User" };
}
'''


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
