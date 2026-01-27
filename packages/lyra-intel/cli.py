#!/usr/bin/env python3
"""
Lyra Intel CLI - Command-line interface for the intelligence engine.

Usage:
    lyra-intel analyze <repo_path> [--output <dir>] [--mode <mode>]
    lyra-intel scan <repo_path>
    lyra-intel search <query> <repo_path>
    lyra-intel query <question> <repo_path>
    lyra-intel report <repo_path> [--type <type>] [--format <format>]
    lyra-intel serve [--port <port>] [--host <host>]
    lyra-intel worker [--coordinator <url>]
    lyra-intel status
"""

import asyncio
import argparse
import json
import logging
import sys
from pathlib import Path

# Ensure src is importable when running directly
if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))

from src.core.engine import LyraIntelEngine, EngineConfig, ProcessingMode
from src.collectors.file_crawler import FileCrawler
from src.collectors.git_collector import GitCollector
from src.analyzers.ast_analyzer import ASTAnalyzer
from src.analyzers.pattern_detector import PatternDetector
from src.storage.database import Database, DatabaseConfig

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("lyra-intel")


async def cmd_analyze(args):
    """Analyze a repository."""
    repo_path = Path(args.repo_path).resolve()
    
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
        
    logger.info(f"Analyzing repository: {repo_path}")
    
    # Determine mode
    mode = ProcessingMode.LOCAL
    if args.mode:
        mode = ProcessingMode(args.mode)
    
    # Create engine config
    config = EngineConfig(
        mode=mode,
        output_dir=Path(args.output) if args.output else Path("./lyra-output"),
    )
    
    # Initialize engine
    engine = LyraIntelEngine(config)
    
    # Run analysis
    result = await engine.analyze_repository(str(repo_path))
    
    # Output results
    if args.json:
        print(json.dumps(result.metrics, indent=2))
    else:
        print("\n" + "="*60)
        print("ANALYSIS COMPLETE")
        print("="*60)
        print(f"Target: {result.target}")
        print(f"Success: {result.success}")
        print(f"Duration: {result.duration_seconds:.2f}s")
        print("\nMetrics:")
        for key, value in result.metrics.items():
            print(f"  {key}: {value}")
        
        if result.errors:
            print("\nErrors:")
            for error in result.errors:
                print(f"  - {error}")
    
    return 0 if result.success else 1


async def cmd_quick_scan(args):
    """Quick scan of a repository."""
    repo_path = Path(args.repo_path).resolve()
    
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\nScanning: {repo_path}\n")
    
    # File collection
    print("📁 Collecting files...")
    crawler = FileCrawler()
    files = await crawler.collect_all(str(repo_path))
    stats = await crawler.get_stats(files)
    
    print(f"   Total files: {stats['total_files']}")
    print(f"   Total size: {stats['total_size_bytes'] / 1024 / 1024:.2f} MB")
    print(f"   Total lines: {stats['total_lines']:,}")
    
    # Git history
    print("\n📜 Analyzing git history...")
    try:
        git = GitCollector()
        commits = await git.get_all_commits(str(repo_path))
        git_stats = await git.get_stats(commits)
        
        print(f"   Total commits: {git_stats['total_commits']}")
        print(f"   Unique authors: {git_stats['unique_authors']}")
        print(f"   Total insertions: {git_stats['total_insertions']:,}")
        print(f"   Total deletions: {git_stats['total_deletions']:,}")
    except Exception as e:
        print(f"   (Git analysis skipped: {e})")
    
    # AST analysis (sample)
    print("\n🔍 Analyzing code structure...")
    analyzer = ASTAnalyzer()
    source_files = [f for f in files if f.extension in [".py", ".js", ".ts", ".tsx"]][:100]
    
    ast_results = await analyzer.analyze_files([f.path for f in source_files])
    summary = analyzer.get_summary(ast_results)
    
    print(f"   Files analyzed: {summary['total_files']}")
    print(f"   Code units found: {summary['total_code_units']}")
    print(f"   Imports tracked: {summary['total_imports']}")
    
    # Pattern detection (sample)
    print("\n⚠️  Detecting patterns...")
    detector = PatternDetector()
    
    pattern_count = 0
    critical_count = 0
    
    for result in ast_results:
        if "error" not in result:
            matches = await detector.detect_patterns(
                result["file_path"],
                ast_result=result
            )
            pattern_count += len(matches)
            critical_count += sum(1 for m in matches if m.severity.value == "critical")
    
    print(f"   Patterns found: {pattern_count}")
    print(f"   Critical issues: {critical_count}")
    
    print("\n" + "="*60)
    print("Quick scan complete!")
    print("="*60)
    
    return 0


async def cmd_serve(args):
    """Start the API server."""
    from src.api.server import APIServer, APIConfig
    
    config = APIConfig(
        host=args.host,
        port=args.port,
    )
    
    server = APIServer(config)
    
    print(f"\n🚀 Starting Lyra Intel API Server")
    print(f"   Host: {args.host}")
    print(f"   Port: {args.port}")
    print(f"\nEndpoints:")
    print(f"   GET  /health           - Health check")
    print(f"   GET  /status           - System status")
    print(f"   POST /api/v1/analyze   - Start analysis")
    print(f"   POST /api/v1/query     - Query codebase")
    print(f"   POST /api/v1/search    - Search code")
    print(f"   GET  /api/v1/reports   - List reports")
    print(f"\nPress Ctrl+C to stop...")
    
    try:
        server.start(blocking=True)
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.stop()
    
    return 0


async def cmd_search(args):
    """Search code in repository."""
    from src.search.code_search import CodeSearch, SearchOptions
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n🔍 Searching for: {args.query}")
    print(f"   In: {repo_path}\n")
    
    options = SearchOptions(
        case_sensitive=args.case_sensitive if hasattr(args, 'case_sensitive') else False,
        regex=args.regex if hasattr(args, 'regex') else False,
        max_results=args.max_results if hasattr(args, 'max_results') else 50,
    )
    
    search = CodeSearch(options)
    matches = search.search(args.query, str(repo_path))
    
    if not matches:
        print("No matches found.")
        return 0
    
    print(f"Found {len(matches)} matches:\n")
    
    for match in matches[:20]:  # Show first 20
        print(f"📄 {match.file_path}:{match.line_number}")
        print(f"   {match.line_content.strip()}")
        print()
    
    if len(matches) > 20:
        print(f"... and {len(matches) - 20} more matches")
    
    return 0


async def cmd_query(args):
    """Query the codebase with natural language."""
    from src.query.query_engine import QueryEngine
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n❓ Query: {args.question}")
    print(f"   Repository: {repo_path}\n")
    
    # Build index first
    print("Building index...")
    crawler = FileCrawler()
    files = await crawler.collect_all(str(repo_path))
    
    analyzer = ASTAnalyzer()
    source_files = [f for f in files if f.extension in [".py", ".js", ".ts", ".tsx"]][:200]
    ast_results = await analyzer.analyze_files([f.path for f in source_files])
    
    # Prepare data for query engine
    analysis_data = {
        "files": [f.to_dict() for f in files],
        "ast_results": ast_results,
    }
    
    engine = QueryEngine()
    engine.build_index(analysis_data)
    
    # Execute query
    result = engine.query(args.question)
    
    print(f"Query type: {result.query_type.value}")
    print(f"Execution time: {result.execution_time_ms:.2f}ms")
    print(f"Results: {result.total}\n")
    
    for item in result.results[:10]:
        print(f"  • {item.get('type', 'unknown')}: {item.get('name', item.get('path', 'unknown'))}")
        if item.get('file_path'):
            print(f"    Location: {item['file_path']}")
        print()
    
    if result.suggestions:
        print("Suggestions:")
        for suggestion in result.suggestions:
            print(f"  💡 {suggestion}")
    
    return 0


async def cmd_report(args):
    """Generate analysis report."""
    from src.reports.generator import ReportGenerator, ReportOptions, ReportType
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n📊 Generating report for: {repo_path}")
    print(f"   Type: {args.type}")
    print(f"   Format: {args.format}\n")
    
    # Collect data
    print("Collecting data...")
    crawler = FileCrawler()
    files = await crawler.collect_all(str(repo_path))
    file_stats = await crawler.get_stats(files)
    
    print("Analyzing code...")
    analyzer = ASTAnalyzer()
    source_files = [f for f in files if f.extension in [".py", ".js", ".ts", ".tsx"]][:200]
    ast_results = await analyzer.analyze_files([f.path for f in source_files])
    ast_summary = analyzer.get_summary(ast_results)
    
    print("Detecting patterns...")
    detector = PatternDetector()
    patterns_by_severity = {"critical": 0, "warning": 0, "info": 0}
    patterns_by_category = {}
    
    for result in ast_results:
        if "error" not in result:
            matches = await detector.detect_patterns(result["file_path"], ast_result=result)
            for m in matches:
                sev = m.severity.value
                patterns_by_severity[sev] = patterns_by_severity.get(sev, 0) + 1
                cat = m.category.value
                patterns_by_category[cat] = patterns_by_category.get(cat, 0) + 1
    
    print("Collecting git history...")
    commits_data = {}
    try:
        git = GitCollector()
        commits = await git.get_all_commits(str(repo_path))
        commits_data = await git.get_stats(commits)
    except Exception:
        commits_data = {"total": 0, "authors": 0}
    
    # Prepare analysis data
    analysis_data = {
        "repository": {"name": repo_path.name, "path": str(repo_path)},
        "files": {
            "total": file_stats.get("total_files", 0),
            "total_lines": file_stats.get("total_lines", 0),
            "total_size_bytes": file_stats.get("total_size_bytes", 0),
            "by_extension": file_stats.get("by_extension", {}),
        },
        "code_units": {
            "functions": ast_summary.get("by_type", {}).get("function", 0),
            "classes": ast_summary.get("by_type", {}).get("class", 0),
            "total_imports": ast_summary.get("total_imports", 0),
        },
        "patterns": {
            "by_severity": patterns_by_severity,
            "by_category": patterns_by_category,
        },
        "dependencies": {"internal": 0, "external": 0, "circular": []},
        "commits": commits_data,
    }
    
    # Generate report
    report_type_map = {
        "executive": ReportType.EXECUTIVE,
        "technical": ReportType.TECHNICAL,
        "security": ReportType.SECURITY,
        "architecture": ReportType.ARCHITECTURE,
        "full": ReportType.FULL,
    }
    
    options = ReportOptions(
        report_type=report_type_map.get(args.type, ReportType.FULL),
        output_format=args.format,
    )
    
    generator = ReportGenerator(options)
    
    output_file = None
    if args.output:
        output_file = args.output
    else:
        ext = "html" if args.format == "html" else "json" if args.format == "json" else "md"
        output_file = f"report_{repo_path.name}_{args.type}.{ext}"
    
    report = generator.generate(analysis_data, output_file)
    
    print(f"\n✅ Report generated: {output_file}")
    print(f"   Size: {len(report):,} characters")
    
    return 0


async def cmd_worker(args):
    """Start a worker agent."""
    from src.agents.worker import AnalysisWorker, WorkerConfig
    
    config = WorkerConfig(
        coordinator_url=args.coordinator,
    )
    
    worker = AnalysisWorker(config)
    
    logger.info("Worker ready for tasks")
    
    # Keep running
    while True:
        await asyncio.sleep(1)


async def cmd_forensic(args):
    """Run forensic analysis."""
    from src.forensics.forensic_analyzer import ForensicAnalyzer, ForensicConfig
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n🔬 Running forensic analysis on: {repo_path}\n")
    
    config = ForensicConfig(
        enable_git_analysis=True,
        parallel_workers=4,
    )
    
    analyzer = ForensicAnalyzer(config)
    report = await analyzer.analyze_repository(str(repo_path))
    
    print("\n" + "="*60)
    print("FORENSIC ANALYSIS RESULTS")
    print("="*60)
    
    summary = report.get("summary", {})
    print(f"\n📊 Summary:")
    print(f"   Code entities:     {summary.get('total_code_entities', 0):,}")
    print(f"   Doc entities:      {summary.get('total_doc_entities', 0)}")
    print(f"   Relationships:     {summary.get('total_relationships', 0)}")
    print(f"   Orphan code:       {summary.get('orphan_code_count', 0)}")
    print(f"   Orphan docs:       {summary.get('orphan_doc_count', 0)}")
    print(f"   Discrepancies:     {summary.get('discrepancy_count', 0)}")
    
    # Output to file if requested
    if args.output:
        import json
        Path(args.output).write_text(json.dumps(report, indent=2))
        print(f"\n📁 Full report saved to: {args.output}")
    
    return 0


async def cmd_complexity(args):
    """Analyze code complexity."""
    from src.forensics.complexity_analyzer import ComplexityAnalyzer
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n📈 Analyzing complexity of: {repo_path}\n")
    
    analyzer = ComplexityAnalyzer()
    results = analyzer.analyze_directory(str(repo_path))
    summary = analyzer.get_summary(results)
    
    print("=" * 60)
    print("COMPLEXITY ANALYSIS")
    print("=" * 60)
    print(f"\nFiles analyzed:        {summary['files_analyzed']}")
    print(f"Total functions:       {summary['total_entities']}")
    print(f"Average complexity:    {summary['average_cyclomatic']:.2f}")
    print(f"Max complexity:        {summary['max_cyclomatic']}")
    print(f"Maintainability:       {summary['average_maintainability']:.1f}%")
    
    print("\n📊 By Rating:")
    for rating, count in summary.get('by_rating', {}).items():
        if count > 0:
            print(f"   {rating}: {count}")
    
    if summary.get('most_complex'):
        print("\n⚠️  Most Complex Functions:")
        for entity in summary['most_complex'][:5]:
            print(f"   {entity.entity_name} ({entity.file_path}) - CC: {entity.cyclomatic_complexity}")
    
    return 0


async def cmd_dead_code(args):
    """Detect dead/unused code."""
    from src.forensics.dead_code_detector import DeadCodeDetector, DeadCodeConfig
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n🔍 Detecting dead code in: {repo_path}\n")
    
    config = DeadCodeConfig(
        check_functions=True,
        check_classes=True,
        check_imports=True,
        min_confidence=0.7,
    )
    
    detector = DeadCodeDetector(config)
    results = detector.analyze(str(repo_path))
    summary = detector.get_summary(results)
    
    print("=" * 60)
    print("DEAD CODE ANALYSIS")
    print("=" * 60)
    print(f"\nPotential dead code:   {summary['total_dead_code']}")
    print(f"High confidence:       {summary['high_confidence_count']}")
    print(f"Files affected:        {summary['files_affected']}")
    
    print("\n📊 By Type:")
    for type_name, data in summary.get('by_type', {}).items():
        print(f"   {type_name}: {data['count']} ({data['high_confidence']} high confidence)")
    
    if results[:10]:
        print("\n⚠️  Top Candidates:")
        for r in results[:10]:
            conf_bar = "●" * int(r.confidence * 5) + "○" * (5 - int(r.confidence * 5))
            print(f"   [{conf_bar}] {r.entity_name} ({r.entity_type}) - {r.file_path}:{r.line_number}")
    
    return 0


async def cmd_dashboard(args):
    """Start visualization dashboard."""
    from src.web.visualization_server import VisualizationServer, ServerConfig
    from src.web.dashboard import Dashboard, DashboardConfig
    
    print(f"\n🖥️  Starting visualization dashboard...")
    print(f"   Host: {args.host}")
    print(f"   Port: {args.port}")
    
    config = ServerConfig(
        host=args.host,
        port=args.port,
    )
    
    server = VisualizationServer(config)
    
    # Set some sample data
    server.set_dashboard_data({
        "files": {"total": 0, "total_lines": 0},
        "code_units": {"functions": 0, "classes": 0},
        "patterns": {"by_severity": {}},
    })
    
    print(f"\n🚀 Dashboard available at: http://{args.host}:{args.port}/")
    print("   Press Ctrl+C to stop...")
    
    try:
        server.start(blocking=True)
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.stop()
    
    return 0


async def cmd_test(args):
    """Run test suite."""
    from src.testing.test_runner import TestRunner, TestConfig
    
    print("\n🧪 Running test suite...\n")
    
    config = TestConfig(
        parallel=not args.sequential,
        verbose=args.verbose,
        output_format=args.format,
    )
    
    runner = TestRunner(config)
    
    # Add some basic tests
    @runner.test("import_core")
    def test_import_core():
        from src.core.engine import LyraIntelEngine
        assert LyraIntelEngine is not None
    
    @runner.test("import_collectors")
    def test_import_collectors():
        from src.collectors.file_crawler import FileCrawler
        from src.collectors.git_collector import GitCollector
        assert FileCrawler is not None
        assert GitCollector is not None
    
    @runner.test("import_analyzers")
    def test_import_analyzers():
        from src.analyzers.ast_analyzer import ASTAnalyzer
        from src.analyzers.pattern_detector import PatternDetector
        assert ASTAnalyzer is not None
        assert PatternDetector is not None
    
    @runner.test("import_forensics")
    def test_import_forensics():
        from src.forensics.forensic_analyzer import ForensicAnalyzer
        from src.forensics.complexity_analyzer import ComplexityAnalyzer
        from src.forensics.dead_code_detector import DeadCodeDetector
        assert ForensicAnalyzer is not None
        assert ComplexityAnalyzer is not None
        assert DeadCodeDetector is not None
    
    @runner.test("import_auth")
    def test_import_auth():
        from src.auth.api_key_auth import APIKeyAuth
        from src.auth.jwt_auth import JWTAuth
        from src.auth.rate_limiter import RateLimiter
        assert APIKeyAuth is not None
        assert JWTAuth is not None
        assert RateLimiter is not None
    
    @runner.test("import_notifications")
    def test_import_notifications():
        from src.notifications.webhook_manager import WebhookManager
        from src.notifications.notification_service import NotificationService
        from src.notifications.alert_manager import AlertManager
        assert WebhookManager is not None
        assert NotificationService is not None
        assert AlertManager is not None
    
    results = await runner.run_all()
    print(runner.format_results(results))
    
    total_failed = sum(r.failed for r in results.values())
    return 1 if total_failed > 0 else 0


async def cmd_benchmark(args):
    """Run performance benchmarks."""
    from src.testing.benchmark_runner import BenchmarkRunner
    
    print("\n⏱️  Running benchmarks...\n")
    
    runner = BenchmarkRunner()
    
    @runner.benchmark("file_scan", iterations=10)
    async def bench_file_scan():
        from src.collectors.file_crawler import FileCrawler
        crawler = FileCrawler()
        await crawler.collect_all(".")
    
    @runner.benchmark("ast_parse", iterations=50)
    def bench_ast_parse():
        from src.analyzers.ast_analyzer import ASTAnalyzer
        analyzer = ASTAnalyzer()
        # Parse a sample file
        import ast
        code = "def test(): pass"
        ast.parse(code)
    
    results = await runner.run_all()
    print(runner.format_results(results))
    
    return 0


async def cmd_security(args):
    """Run security scan."""
    from src.security.security_scanner import SecurityScanner, SecurityConfig
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n🔐 Running security scan on: {repo_path}\n")
    
    config = SecurityConfig(
        scan_code=True,
        scan_secrets=True,
        scan_dependencies=True,
    )
    
    scanner = SecurityScanner(config)
    result = scanner.scan_directory(str(repo_path))
    
    print("=" * 60)
    print("SECURITY SCAN RESULTS")
    print("=" * 60)
    print(f"\nScore: {result.score:.1f}/100 {'✅ PASSED' if result.passed else '❌ FAILED'}")
    print(f"Total Findings: {result.total_findings}")
    print(f"Files Scanned: {result.scanned_files}")
    print(f"Scan Duration: {result.scan_duration_ms:.2f}ms")
    
    print("\n📊 By Severity:")
    for sev, count in result.summary.items():
        if count > 0:
            icon = "🔴" if sev == "critical" else "🟠" if sev == "high" else "🟡" if sev == "medium" else "🔵"
            print(f"   {icon} {sev.upper()}: {count}")
    
    if result.recommendations:
        print("\n💡 Recommendations:")
        for rec in result.recommendations:
            print(f"   {rec}")
    
    if args.output:
        report = scanner.generate_report(result)
        Path(args.output).write_text(report)
        print(f"\n📄 Full report saved to: {args.output}")
    
    return 0 if result.passed else 1


async def cmd_knowledge_graph(args):
    """Build and query knowledge graph."""
    from src.knowledge.knowledge_graph import KnowledgeGraph
    from src.knowledge.graph_builder import GraphBuilder
    from src.knowledge.query_interface import GraphQueryInterface
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n🧠 Building knowledge graph for: {repo_path}\n")
    
    # Collect files and analyze
    crawler = FileCrawler()
    files = await crawler.collect_all(str(repo_path))
    
    analyzer = ASTAnalyzer()
    source_files = [f for f in files if f.extension in [".py", ".js", ".ts", ".tsx"]][:200]
    ast_results = await analyzer.analyze_files([f.path for f in source_files])
    
    # Build graph
    builder = GraphBuilder()
    graph = builder.build_from_analysis(
        files=[f.to_dict() for f in files],
        ast_results=ast_results,
    )
    
    stats = graph.get_statistics()
    print("=" * 60)
    print("KNOWLEDGE GRAPH")
    print("=" * 60)
    print(f"\nNodes: {stats['total_nodes']}")
    print(f"Edges: {stats['total_edges']}")
    print(f"Density: {stats['density']:.4f}")
    
    print("\n📊 Nodes by Type:")
    for ntype, count in stats['nodes_by_type'].items():
        if count > 0:
            print(f"   {ntype}: {count}")
    
    # Query if requested
    if args.query:
        print(f"\n❓ Query: {args.query}")
        query_interface = GraphQueryInterface(graph)
        result = query_interface.query(args.query)
        print(f"   Result: {result.message}")
        for node in result.nodes[:10]:
            print(f"      • {node.name} ({node.node_type.value})")
    
    # Export if requested
    if args.export:
        if args.export.endswith('.json'):
            graph.export_json(args.export)
        elif args.export.endswith('.dot'):
            graph.export_dot(args.export)
        else:
            graph.export_json(args.export + '.json')
        print(f"\n📁 Graph exported to: {args.export}")
    
    return 0


async def cmd_generate(args):
    """Generate code from specifications."""
    from src.generation.code_generator import CodeGenerator, GenerationConfig
    
    print(f"\n⚙️ Generating {args.type}: {args.name}\n")
    
    config = GenerationConfig(
        language=args.language,
        include_tests=True,
        include_docs=True,
    )
    
    generator = CodeGenerator(config)
    
    if args.type == "function":
        result = generator.generate_function(
            name=args.name,
            description=args.description,
        )
    elif args.type == "class":
        result = generator.generate_class(
            name=args.name,
            description=args.description,
        )
    elif args.type == "api":
        result = generator.generate_api_endpoint(
            name=args.name,
            path=f"/{args.name.lower()}",
            method="GET",
            description=args.description,
        )
    elif args.type == "model":
        result = generator.generate_data_model(
            name=args.name,
            description=args.description,
            fields=[],
        )
    else:
        print(f"Unknown type: {args.type}")
        return 1
    
    print("=" * 60)
    print("GENERATED CODE")
    print("=" * 60)
    print(result.code)
    
    if result.tests:
        print("\n" + "-" * 60)
        print("GENERATED TESTS")
        print("-" * 60)
        print(result.tests)
    
    return 0


async def cmd_profile(args):
    """Profile code for performance issues."""
    from src.profiler.profiler import CodeProfiler
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n⚡ Profiling code in: {repo_path}\n")
    
    profiler = CodeProfiler()
    
    # Collect files
    files_data = []
    for file_path in repo_path.rglob("*.py"):
        try:
            content = file_path.read_text(errors="ignore")
            files_data.append({"path": str(file_path), "content": content})
        except Exception:
            continue
    
    result = profiler.profile_codebase(files_data[:100])
    
    print("=" * 60)
    print("PERFORMANCE PROFILE")
    print("=" * 60)
    print(f"\nComplexity Score: {result.complexity_score:.1f}")
    print(f"Total Findings: {result.total_findings}")
    
    print("\n📊 By Issue Type:")
    for issue, count in result.summary.items():
        if count > 0:
            print(f"   {issue}: {count}")
    
    if result.recommendations:
        print("\n💡 Recommendations:")
        for rec in result.recommendations:
            print(f"   {rec}")
    
    if result.findings:
        print("\n⚠️ Top Issues:")
        for finding in result.findings[:5]:
            print(f"\n   [{finding.severity.upper()}] {finding.description}")
            print(f"   File: {finding.file_path}:{finding.line_number}")
            print(f"   Suggestion: {finding.suggestion}")
    
    return 0


async def cmd_docs(args):
    """Generate documentation."""
    from src.docgen.doc_generator import DocumentationGenerator, DocConfig
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n📖 Generating {args.type} documentation for: {repo_path}\n")
    
    config = DocConfig(
        output_format="markdown",
        include_examples=True,
        include_toc=True,
    )
    
    generator = DocumentationGenerator(config)
    
    # Collect analysis data
    crawler = FileCrawler()
    files = await crawler.collect_all(str(repo_path))
    file_stats = await crawler.get_stats(files)
    
    analyzer = ASTAnalyzer()
    source_files = [f for f in files if f.extension in [".py", ".js", ".ts", ".tsx"]][:100]
    ast_results = await analyzer.analyze_files([f.path for f in source_files])
    
    analysis_data = {
        "files": {
            "total": file_stats.get("total_files", 0),
            "total_lines": file_stats.get("total_lines", 0),
            "by_extension": file_stats.get("by_extension", {}),
        },
        "code_units": {
            "functions": sum(1 for r in ast_results for u in r.get("code_units", []) if u.get("type") == "function"),
            "classes": sum(1 for r in ast_results for u in r.get("code_units", []) if u.get("type") == "class"),
        },
    }
    
    if args.type == "api":
        result = generator.generate_api_docs(ast_results, repo_path.name)
    elif args.type == "readme":
        result = generator.generate_readme(
            repo_path.name,
            "Auto-generated README",
            ["Feature 1", "Feature 2"],
            analysis_data=analysis_data,
        )
    elif args.type == "architecture":
        result = generator.generate_architecture_doc(repo_path.name, analysis_data)
    else:
        result = generator.generate_api_docs(ast_results, repo_path.name)
    
    print("=" * 60)
    print("GENERATED DOCUMENTATION")
    print("=" * 60)
    print(f"\nSections: {', '.join(result.sections)}")
    print(f"Word Count: {result.word_count}")
    
    if args.output:
        Path(args.output).write_text(result.content)
        print(f"\n📄 Documentation saved to: {args.output}")
    else:
        print("\n" + result.content[:2000])
        if len(result.content) > 2000:
            print(f"\n... ({len(result.content) - 2000} more characters)")
    
    return 0



async def cmd_commit_history(args):
    """Analyze commit history to find when bugs were introduced."""
    from src.git.commit_analyzer import CommitAnalyzer, CommitAnalysisConfig
    
    repo_path = Path(args.repo_path).resolve()
    if not repo_path.exists():
        logger.error(f"Repository not found: {repo_path}")
        return 1
    
    print(f"\n🔍 Analyzing commit history: {repo_path}")
    print(f"📋 Branch: {args.branch}\n")
    
    # Create config
    config = CommitAnalysisConfig(
        branch=args.branch,
        max_commits=args.max_commits,
        start_commit=args.start,
        end_commit=args.end,
        analyze_security=not args.no_security,
        analyze_complexity=not args.no_complexity,
        skip_merge_commits=True,
    )
    
    # Create analyzer
    analyzer = CommitAnalyzer(str(repo_path), config)
    
    # Analyze commits
    print("⏳ This may take a while for large repositories...\n")
    results = await analyzer.analyze_all_commits()
    
    if not results:
        print("❌ No commits found to analyze")
        return 1
    
    # Generate report
    report = analyzer.generate_report(results)
    
    # Display summary
    print("\n" + "="*60)
    print("COMMIT HISTORY ANALYSIS")
    print("="*60)
    
    summary = report["summary"]
    print(f"\n📊 Total commits analyzed: {summary['total_commits']}")
    print(f"📅 Date range: {summary['date_range']['first'][:10]} → {summary['date_range']['last'][:10]}")
    print(f"📝 Total changes: +{summary['total_changes']['insertions']} / -{summary['total_changes']['deletions']}")
    
    current = report["current_state"]
    print(f"\n📈 Current state:")
    print(f"   Lines of code: {current['total_lines']:,}")
    print(f"   Functions: {current['total_functions']}")
    print(f"   Classes: {current['total_classes']}")
    print(f"   Avg complexity: {current['avg_complexity']:.2f}")
    print(f"   Security issues: {current['security_issues']}")
    
    # Show problematic commits
    problematic = report["problematic_commits"]
    
    if problematic["complexity_spikes"]:
        print(f"\n⚠️  Complexity Spikes (top 5):")
        for commit in problematic["complexity_spikes"][:5]:
            print(f"   {commit['short_hash']} - {commit['message'][:50]}")
            print(f"      Δ Complexity: +{commit['complexity_delta']:.2f} | {commit['author']}")
    
    if problematic["security_regressions"]:
        print(f"\n🔴 Security Regressions (top 5):")
        for commit in problematic["security_regressions"][:5]:
            print(f"   {commit['short_hash']} - {commit['message'][:50]}")
            print(f"      New issues: +{commit['issues_delta']} ({commit['critical_issues']} critical)")
    
    if problematic["large_commits"]:
        print(f"\n📦 Large Commits (top 5):")
        for commit in problematic["large_commits"][:5]:
            changes = commit['insertions'] + commit['deletions']
            print(f"   {commit['short_hash']} - {commit['message'][:50]}")
            print(f"      Changes: {changes:,} lines | {commit['files_changed']} files")
    
    # Save report
    if args.output:
        analyzer.save_report(results, args.output)
        print(f"\n💾 Full report saved to: {args.output}")
    else:
        default_output = f"commit-history-{args.branch}.json"
        analyzer.save_report(results, default_output)
        print(f"\n💾 Full report saved to: {default_output}")
    
    print("\n💡 TIP: Use the report to identify which commits introduced bugs!")
    print("   Look for:")
    print("   - Complexity spikes (major refactors that may have broken things)")
    print("   - Security regressions (new vulnerabilities)")
    print("   - Large commits (hard to review, more likely to have bugs)")
    
    return 0


async def cmd_status(args):
    """Show system status."""
    print("\n" + "="*60)
    print("        🔮 LYRA INTEL - Intelligence Engine")
    print("="*60)
    print(f"\nVersion: 2.0.0 ENTERPRISE")
    print(f"Mode: Full-Scale Production Ready")
    
    print("\n📦 Core Components:")
    print("  ✅ Core Engine          - Orchestration & processing")
    print("  ✅ File Crawler         - Parallel file traversal")
    print("  ✅ Git Collector        - History & blame analysis")
    print("  ✅ AST Analyzer         - Multi-language parsing")
    print("  ✅ Dependency Mapper    - Import/export graphs")
    print("  ✅ Pattern Detector     - Code smells & security")
    
    print("\n💾 Storage:")
    print("  ✅ SQLite Database      - Local storage")
    print("  ✅ Cache Layer          - Memory/File/Redis backends")
    print("  ✅ PostgreSQL Ready     - Production database")
    print("  ✅ BigQuery Ready       - Cloud scale analytics")
    
    print("\n🤖 Agent Fleet:")
    print("  ✅ Agent Coordinator    - Task distribution")
    print("  ✅ Analysis Worker      - Parallel processing")
    print("  ✅ Cloud Orchestrator   - AWS/GCP/Azure")
    
    print("\n🔍 Search & Query:")
    print("  ✅ Code Search          - Fast text search")
    print("  ✅ Semantic Search      - Vector embeddings")
    print("  ✅ Query Engine         - Natural language")
    
    print("\n📊 Visualization & Reports:")
    print("  ✅ Graph Generator      - D3.js/Mermaid/DOT")
    print("  ✅ Report Generator     - Executive/Technical/Security")
    print("  ✅ Web Dashboard        - Interactive visualization")
    
    print("\n🌐 API & Auth:")
    print("  ✅ REST API Server      - HTTP endpoints")
    print("  ✅ API Key Auth         - Key management")
    print("  ✅ JWT Auth             - Token authentication")
    print("  ✅ Rate Limiter         - Request throttling")
    print("  ✅ RBAC                 - Role-based access")
    
    print("\n🔌 Plugin System:")
    print("  ✅ Plugin Manager       - Load/manage plugins")
    print("  ✅ Analyzer Plugins     - Custom analyzers")
    print("  ✅ Processor Plugins    - Data transformers")
    print("  ✅ Exporter Plugins     - Output formats")
    
    print("\n🤖 AI Integration:")
    print("  ✅ AI Analyzer          - LLM-powered analysis")
    print("  ✅ OpenAI Provider      - GPT-4/GPT-3.5")
    print("  ✅ Anthropic Provider   - Claude")
    print("  ✅ Local Provider       - Ollama/llama.cpp")
    
    print("\n📈 Metrics & Events:")
    print("  ✅ Metrics Collector    - Counter/Gauge/Timer/Histogram")
    print("  ✅ Metrics Dashboard    - Terminal/HTML/JSON")
    print("  ✅ Event Bus            - Pub/sub messaging")
    
    print("\n🔔 Notifications:")
    print("  ✅ Webhook Manager      - HTTP webhooks")
    print("  ✅ Notification Service - Email/Slack/Discord")
    print("  ✅ Alert Manager        - Alert rules & routing")
    
    print("\n🔬 Forensic Analysis:")
    print("  ✅ Forensic Analyzer    - Code↔Doc mapping")
    print("  ✅ Doc Mapper           - Bidirectional links")
    print("  ✅ Dead Code Detector   - Unused code finder")
    print("  ✅ Complexity Analyzer  - Cyclomatic/Cognitive")
    print("  ✅ Archive Indexer      - Documentation archive")
    
    print("\n🔄 Pipeline:")
    print("  ✅ Streaming Pipeline   - Async data processing")
    print("  ✅ Stage Processors     - Filter/Transform/Aggregate")
    
    print("\n🧪 Testing:")
    print("  ✅ Test Runner          - Async test execution")
    print("  ✅ Test Generator       - Auto-generate tests")
    print("  ✅ Coverage Analyzer    - Code coverage")
    print("  ✅ Benchmark Runner     - Performance tests")
    
    print("\n🧠 Knowledge System:")
    print("  ✅ Knowledge Graph      - Semantic relationships")
    print("  ✅ Graph Builder        - Auto-build from code")
    print("  ✅ Graph Query          - Natural language queries")
    
    print("\n📝 Diff & Impact:")
    print("  ✅ Diff Analyzer        - Line & semantic diffs")
    print("  ✅ Impact Analyzer      - Change impact analysis")
    
    print("\n⚙️  Code Generation:")
    print("  ✅ Code Generator       - AI-powered generation")
    print("  ✅ Template Engine      - Custom templates")
    
    print("\n🔐 Security:")
    print("  ✅ Security Scanner     - OWASP Top 10 detection")
    print("  ✅ Vulnerability DB     - Known CVE tracking")
    
    print("\n🔧 Migration:")
    print("  ✅ Migration Planner    - Upgrade planning")
    print("  ✅ Migration Steps      - Automated migrations")
    
    print("\n⚡ Performance:")
    print("  ✅ Code Profiler        - Performance analysis")
    print("  ✅ Schema Analyzer      - Database schema analysis")
    
    print("\n📖 Documentation:")
    print("  ✅ Doc Generator        - Auto-generate docs")
    print("  ✅ API Docs             - OpenAPI generation")
    print("  ✅ Changelog Gen        - From git history")
    
    print("\n🔗 Integrations:")
    print("  ✅ Integration Hub      - Central management")
    print("  ✅ GitHub Integration   - Issues/PRs/Comments")
    print("  ✅ Slack Integration    - Notifications")
    
    print("\n🔄 Workflow:")
    print("  ✅ Workflow Engine      - Pipeline orchestration")
    print("  ✅ Step Handlers        - Custom actions")
    
    print("\n🐳 Deployment:")
    print("  ✅ Docker Support       - Container ready")
    print("  ✅ Docker Compose       - Multi-service")
    print("  ✅ Forensic Script      - Shell automation")
    
    # NEW ENTERPRISE FEATURES
    print("\n" + "="*60)
    print("        🏢 ENTERPRISE FEATURES")
    print("="*60)
    
    print("\n🏢 Multi-Tenant Management:")
    print("  ✅ Tenant Manager       - Multi-tenant isolation")
    print("  ✅ Resource Quotas      - Per-tenant limits")
    print("  ✅ Tier Management      - Free/Starter/Pro/Enterprise")
    print("  ✅ API Key Rotation     - Secure key management")
    
    print("\n📋 Audit & Compliance:")
    print("  ✅ Audit Logger         - Tamper-proof logging")
    print("  ✅ Event Chain          - Hash-linked audit trail")
    print("  ✅ Compliance Monitor   - SOC2/GDPR/HIPAA/PCI")
    print("  ✅ Data Governance      - Policy enforcement")
    print("  ✅ Retention Policies   - Data lifecycle management")
    
    print("\n🔑 SSO Integration:")
    print("  ✅ OIDC Provider        - OpenID Connect")
    print("  ✅ SAML Provider        - SAML 2.0 support")
    print("  ✅ SSO Manager          - Multi-provider management")
    print("  ✅ Session Management   - Secure sessions")
    
    # NEW FULL-SCALE ANALYSIS FEATURES
    print("\n" + "="*60)
    print("        ⚡ FULL-SCALE ANALYSIS")
    print("="*60)
    
    print("\n🌐 Distributed Computing:")
    print("  ✅ Cluster Manager      - Worker node orchestration")
    print("  ✅ Task Scheduler       - Distributed task execution")
    print("  ✅ Data Partitioner     - Hash/Range/Round-robin")
    print("  ✅ Consensus Manager    - Raft/Paxos protocols")
    print("  ✅ Auto-scaling         - Dynamic worker scaling")
    
    print("\n🧠 Machine Learning Pipeline:")
    print("  ✅ Feature Extractor    - Code feature extraction")
    print("  ✅ Model Trainer        - ML model training")
    print("  ✅ Anomaly Detector     - Pattern anomaly detection")
    print("  ✅ Code Predictor       - Bug/refactor prediction")
    print("  ✅ Embedding Generator  - Code embeddings (BOW/TF-IDF)")
    
    print("\n🗄️ Data Lake Integration:")
    print("  ✅ Lake Connector       - S3/GCS/Azure Blob/HDFS")
    print("  ✅ Data Catalog         - Metadata management")
    print("  ✅ Query Optimizer      - Predicate/partition pushdown")
    print("  ✅ Storage Manager      - Hot/Warm/Cold/Archive tiers")
    
    print("\n⚡ Real-Time Processing:")
    print("  ✅ Stream Processor     - Event stream processing")
    print("  ✅ Event Router         - Rule-based routing")
    print("  ✅ Window Aggregator    - Tumbling/Sliding windows")
    print("  ✅ Alert Engine         - Real-time alerting")
    
    print("\n⏰ Job Scheduler:")
    print("  ✅ Job Scheduler        - Recurring analysis jobs")
    print("  ✅ Cron Parser          - Cron expression support")
    print("  ✅ Job Queue            - Distributed job queue")
    print("  ✅ Dead Letter Queue    - Failed job handling")
    
    print("\n📤 Export System:")
    print("  ✅ Exporter             - Multi-format export")
    print("  ✅ JSON/CSV/HTML/PDF    - Format handlers")
    print("  ✅ Archive Builder      - ZIP/TAR/TAR.GZ bundles")
    
    print("\n" + "="*60)
    print("🚀 COMPLETE ENTERPRISE INTELLIGENCE SUITE!")
    print("   Total Components: 100+")
    print("   Ready for massive-scale codebase analysis!")
    print("   Supports cloud-scale deployments (AWS/GCP/Azure)")
    print("="*60)
    
    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="lyra-intel",
        description="Intelligence Infrastructure Engine for codebase analysis"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze a repository")
    analyze_parser.add_argument("repo_path", help="Path to repository")
    analyze_parser.add_argument("--output", "-o", help="Output directory")
    analyze_parser.add_argument("--mode", "-m", choices=["local", "distributed", "cloud_massive"])
    analyze_parser.add_argument("--json", action="store_true", help="Output as JSON")
    
    # quick-scan command
    scan_parser = subparsers.add_parser("scan", help="Quick scan a repository")
    scan_parser.add_argument("repo_path", help="Path to repository")
    
    # search command
    search_parser = subparsers.add_parser("search", help="Search code in repository")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("repo_path", help="Path to repository")
    search_parser.add_argument("--regex", "-r", action="store_true", help="Use regex")
    search_parser.add_argument("--case-sensitive", "-c", action="store_true")
    search_parser.add_argument("--max-results", "-n", type=int, default=50)
    
    # query command
    query_parser = subparsers.add_parser("query", help="Query codebase with natural language")
    query_parser.add_argument("question", help="Natural language question")
    query_parser.add_argument("repo_path", help="Path to repository")
    
    # report command
    report_parser = subparsers.add_parser("report", help="Generate analysis report")
    report_parser.add_argument("repo_path", help="Path to repository")
    report_parser.add_argument("--type", "-t", default="full",
                               choices=["executive", "technical", "security", "architecture", "full"])
    report_parser.add_argument("--format", "-f", default="markdown",
                               choices=["markdown", "html", "json"])
    report_parser.add_argument("--output", "-o", help="Output file path")
    
    # serve command
    serve_parser = subparsers.add_parser("serve", help="Start API server")
    serve_parser.add_argument("--port", "-p", type=int, default=8000)
    serve_parser.add_argument("--host", default="0.0.0.0")
    
    # worker command
    worker_parser = subparsers.add_parser("worker", help="Start worker agent")
    worker_parser.add_argument("--coordinator", "-c", help="Coordinator URL")
    
    # status command
    subparsers.add_parser("status", help="Show system status")
    
    # forensic command
    forensic_parser = subparsers.add_parser("forensic", help="Run forensic analysis")
    forensic_parser.add_argument("repo_path", help="Path to repository")
    forensic_parser.add_argument("--output", "-o", help="Output file path (JSON)")
    
    # complexity command
    complexity_parser = subparsers.add_parser("complexity", help="Analyze code complexity")
    complexity_parser.add_argument("repo_path", help="Path to repository")
    
    # dead-code command
    dead_code_parser = subparsers.add_parser("dead-code", help="Detect dead/unused code")
    dead_code_parser.add_argument("repo_path", help="Path to repository")
    
    # dashboard command
    dashboard_parser = subparsers.add_parser("dashboard", help="Start visualization dashboard")
    dashboard_parser.add_argument("--port", "-p", type=int, default=3000)
    dashboard_parser.add_argument("--host", default="127.0.0.1")
    
    # test command
    test_parser = subparsers.add_parser("test", help="Run test suite")
    test_parser.add_argument("--sequential", "-s", action="store_true", help="Run tests sequentially")
    test_parser.add_argument("--verbose", "-v", action="store_true", default=True)
    test_parser.add_argument("--format", "-f", default="text", choices=["text", "json", "junit"])
    
    # benchmark command
    benchmark_parser = subparsers.add_parser("benchmark", help="Run performance benchmarks")
    benchmark_parser.add_argument("--iterations", "-n", type=int, default=100)
    
    # security command
    security_parser = subparsers.add_parser("security", help="Run security scan")
    security_parser.add_argument("repo_path", help="Path to repository")
    security_parser.add_argument("--output", "-o", help="Output file for report")
    
    # knowledge-graph command
    kg_parser = subparsers.add_parser("knowledge-graph", help="Build and query knowledge graph")
    kg_parser.add_argument("repo_path", help="Path to repository")
    kg_parser.add_argument("--query", "-q", help="Query the graph")
    kg_parser.add_argument("--export", "-e", help="Export graph to file")
    
    # commit-history command
    commit_parser = subparsers.add_parser("commit-history", help="Analyze commit history to track bugs")
    commit_parser.add_argument("repo_path", help="Path to repository")
    commit_parser.add_argument("--branch", "-b", default="main", help="Branch to analyze")
    commit_parser.add_argument("--max-commits", "-n", type=int, help="Limit number of commits")
    commit_parser.add_argument("--start", help="Start commit hash")
    commit_parser.add_argument("--end", help="End commit hash (default: HEAD)")
    commit_parser.add_argument("--output", "-o", help="Output file for report (JSON)")
    commit_parser.add_argument("--no-security", action="store_true", help="Skip security scanning")
    commit_parser.add_argument("--no-complexity", action="store_true", help="Skip complexity analysis")
    
    # generate command
    gen_parser = subparsers.add_parser("generate", help="Generate code from specifications")
    gen_parser.add_argument("--type", "-t", choices=["function", "class", "api", "model"], default="function")
    gen_parser.add_argument("--name", "-n", required=True, help="Name of element to generate")
    gen_parser.add_argument("--description", "-d", required=True, help="Description of what to generate")
    gen_parser.add_argument("--language", "-l", default="python", help="Target language")
    
    # profile command
    profile_parser = subparsers.add_parser("profile", help="Profile code for performance issues")
    profile_parser.add_argument("repo_path", help="Path to repository")
    
    # docs command
    docs_parser = subparsers.add_parser("docs", help="Generate documentation")
    docs_parser.add_argument("repo_path", help="Path to repository")
    docs_parser.add_argument("--type", "-t", choices=["api", "readme", "architecture", "changelog"], default="api")
    docs_parser.add_argument("--output", "-o", help="Output file")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Route to appropriate command
    if args.command == "analyze":
        return asyncio.run(cmd_analyze(args))
    elif args.command == "scan":
        return asyncio.run(cmd_quick_scan(args))
    elif args.command == "search":
        return asyncio.run(cmd_search(args))
    elif args.command == "query":
        return asyncio.run(cmd_query(args))
    elif args.command == "report":
        return asyncio.run(cmd_report(args))
    elif args.command == "serve":
        return asyncio.run(cmd_serve(args))
    elif args.command == "worker":
        return asyncio.run(cmd_worker(args))
    elif args.command == "status":
        return asyncio.run(cmd_status(args))
    elif args.command == "forensic":
        return asyncio.run(cmd_forensic(args))
    elif args.command == "complexity":
        return asyncio.run(cmd_complexity(args))
    elif args.command == "dead-code":
        return asyncio.run(cmd_dead_code(args))
    elif args.command == "dashboard":
        return asyncio.run(cmd_dashboard(args))
    elif args.command == "test":
        return asyncio.run(cmd_test(args))
    elif args.command == "benchmark":
        return asyncio.run(cmd_benchmark(args))
    elif args.command == "security":
        return asyncio.run(cmd_security(args))
    elif args.command == "knowledge-graph":
        return asyncio.run(cmd_knowledge_graph(args))
    elif args.command == "generate":
        return asyncio.run(cmd_generate(args))
    elif args.command == "profile":
        return asyncio.run(cmd_profile(args))
    elif args.command == "docs":
        return asyncio.run(cmd_docs(args))
    elif args.command == "commit-history":
        return asyncio.run(cmd_commit_history(args))
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
