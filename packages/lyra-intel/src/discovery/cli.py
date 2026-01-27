#!/usr/bin/env python3
"""
Discovery CLI - Command-line interface for the discovery module.

Usage:
    python -m src.discovery.cli scan [--days-back N] [--min-stars N] [--format json|text]
    python -m src.discovery.cli analyze <repo-url> [--check-security]
    python -m src.discovery.cli submit <repo-url> [--dry-run] [--min-quality N]
    python -m src.discovery.cli run [--days-back N] [--submit] [--dry-run]
    python -m src.discovery.cli stats
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.discovery.github_scanner import GitHubScanner, GitHubScanConfig
from src.discovery.analyzer import ToolAnalyzer, ToolAnalysisConfig
from src.discovery.submitter import RegistrySubmitter, SubmitterConfig
from src.discovery.pipeline import DiscoveryPipeline, PipelineConfig

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("discovery")


async def cmd_scan(args):
    """Scan GitHub for MCP crypto repositories."""
    config = GitHubScanConfig(
        days_back=args.days_back,
        min_stars=args.min_stars,
        max_total_results=args.max_results,
    )
    
    async with GitHubScanner(config) as scanner:
        repos = await scanner.scan_and_enrich(
            days_back=args.days_back,
            enrich=not args.quick,
        )
        
        if args.format == 'json':
            result = {
                "success": True,
                "count": len(repos),
                "repos": [r.to_dict() for r in repos],
                "stats": scanner.get_stats(),
            }
            print(json.dumps(result, indent=2))
        else:
            print(f"\n{'='*60}")
            print(f"DISCOVERED {len(repos)} REPOSITORIES")
            print(f"{'='*60}\n")
            
            for repo in repos:
                stars = f"⭐{repo.stars}" if repo.stars > 0 else ""
                quality = f"[{repo.quality.value.upper()}]" if repo.quality else ""
                print(f"  {repo.full_name} {stars} {quality}")
                if repo.description:
                    print(f"    {repo.description[:80]}...")
                print()
            
            stats = scanner.get_stats()
            print(f"Stats: {stats['queries_run']} queries, {stats['api_calls']} API calls")
    
    return 0


async def cmd_analyze(args):
    """Analyze a GitHub repository."""
    config = ToolAnalysisConfig(
        check_security=args.check_security,
    )
    
    analyzer = ToolAnalyzer(config)
    await analyzer.initialize()
    
    # Initialize pipeline just for cloning
    pipeline_config = PipelineConfig(analyzer_config=config)
    async with DiscoveryPipeline(pipeline_config) as pipeline:
        analyzed = await pipeline.analyze_single(args.repo_url)
        
        if analyzed is None:
            print(json.dumps({"success": False, "error": "Analysis failed"}))
            return 1
        
        if args.format == 'json':
            print(json.dumps(analyzed.to_dict(), indent=2))
        else:
            print(f"\n{'='*60}")
            print(f"ANALYSIS: {analyzed.repo_full_name}")
            print(f"{'='*60}\n")
            
            print(f"Tools Found: {analyzed.total_tools}")
            print(f"Quality Score: {analyzed.quality_score:.1f}/100")
            print(f"Security Score: {analyzed.security_score:.1f}/100")
            print(f"Categories: {', '.join(analyzed.categories_found)}")
            print(f"Chains: {', '.join(analyzed.chains_supported)}")
            
            print(f"\nTools:")
            for tool in analyzed.tools:
                print(f"  - {tool.name} [{tool.category.value}]")
                print(f"    {tool.description[:60]}...")
            
            if analyzed.issues:
                print(f"\nIssues:")
                for issue in analyzed.issues[:5]:
                    print(f"  ⚠️ {issue}")
    
    return 0


async def cmd_submit(args):
    """Submit analyzed tools to registry."""
    # First analyze
    analyzer_config = ToolAnalysisConfig(check_security=True)
    submitter_config = SubmitterConfig(
        dry_run=args.dry_run,
        min_quality_score=args.min_quality,
        min_security_score=args.min_security,
        registry_url=args.registry_url,
    )
    
    pipeline_config = PipelineConfig(
        analyzer_config=analyzer_config,
        submitter_config=submitter_config,
    )
    
    async with DiscoveryPipeline(pipeline_config) as pipeline:
        analyzed = await pipeline.analyze_single(args.repo_url)
        
        if analyzed is None:
            print(json.dumps({"success": False, "error": "Analysis failed"}))
            return 1
        
        # Submit
        async with RegistrySubmitter(submitter_config) as submitter:
            results = await submitter.submit_analyzed_repo(analyzed)
            
            if args.format == 'json':
                output = {
                    "success": True,
                    "dry_run": args.dry_run,
                    "submitted": len([r for r in results if r.status.value != 'rejected']),
                    "accepted": len([r for r in results if r.status.value == 'accepted']),
                    "rejected": len([r for r in results if r.status.value == 'rejected']),
                    "results": [r.to_dict() for r in results],
                    "stats": submitter.get_stats(),
                }
                print(json.dumps(output, indent=2))
            else:
                print(f"\n{'='*60}")
                print(f"SUBMISSION RESULTS {'(DRY RUN)' if args.dry_run else ''}")
                print(f"{'='*60}\n")
                
                for result in results:
                    status_icon = {
                        'accepted': '✅',
                        'rejected': '❌',
                        'pending': '⏳',
                        'error': '⚠️',
                    }.get(result.status.value, '?')
                    
                    print(f"{status_icon} {result.tool_name}: {result.status.value}")
                    if result.message:
                        print(f"   {result.message}")
    
    return 0


async def cmd_run(args):
    """Run the complete discovery pipeline."""
    scanner_config = GitHubScanConfig(
        days_back=args.days_back,
        max_total_results=args.max_repos,
    )
    submitter_config = SubmitterConfig(
        dry_run=args.dry_run,
        min_quality_score=args.min_quality,
        min_security_score=args.min_security,
    )
    
    pipeline_config = PipelineConfig(
        scanner_config=scanner_config,
        submitter_config=submitter_config,
        save_results=True,
    )
    
    async with DiscoveryPipeline(pipeline_config) as pipeline:
        result = await pipeline.run(
            days_back=args.days_back,
            submit=args.submit,
        )
        
        if args.format == 'json':
            print(json.dumps(result.to_dict(), indent=2))
        else:
            print(result.summary())
            
            print("\nTop Repositories:")
            for repo in result.analyzed_repos[:5]:
                name = repo.get('repo_full_name', 'unknown')
                tools = repo.get('total_tools', 0)
                quality = repo.get('quality_score', 0)
                print(f"  {name}: {tools} tools, quality {quality:.1f}")
    
    return 0


async def cmd_stats(args):
    """Show discovery statistics."""
    results_dir = Path("./discovery_results")
    
    if not results_dir.exists():
        print(json.dumps({
            "success": False,
            "message": "No discovery results found. Run discovery first.",
        }))
        return 1
    
    # Find most recent result
    result_files = sorted(results_dir.glob("discovery_*.json"), reverse=True)
    
    if not result_files:
        print(json.dumps({
            "success": False,
            "message": "No discovery results found.",
        }))
        return 1
    
    # Load last few results for stats
    stats = {
        "total_runs": len(result_files),
        "last_run": None,
        "total_repos_discovered": 0,
        "total_tools_found": 0,
        "recent_runs": [],
    }
    
    for f in result_files[:5]:
        with open(f) as fp:
            data = json.load(fp)
            
            run_info = {
                "date": data.get("started_at"),
                "repos": data.get("repos_discovered", 0),
                "tools": data.get("total_tools_found", 0),
                "accepted": data.get("tools_accepted", 0),
            }
            stats["recent_runs"].append(run_info)
            stats["total_repos_discovered"] += data.get("repos_discovered", 0)
            stats["total_tools_found"] += data.get("total_tools_found", 0)
    
    if stats["recent_runs"]:
        stats["last_run"] = stats["recent_runs"][0]["date"]
    
    print(json.dumps(stats, indent=2))
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Lyra Intel Discovery CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Scan command
    scan_parser = subparsers.add_parser("scan", help="Scan GitHub for MCP repos")
    scan_parser.add_argument("--days-back", type=int, default=7, help="Days to look back")
    scan_parser.add_argument("--min-stars", type=int, default=0, help="Minimum stars")
    scan_parser.add_argument("--max-results", type=int, default=50, help="Max results")
    scan_parser.add_argument("--quick", action="store_true", help="Skip enrichment")
    scan_parser.add_argument("--format", choices=["json", "text"], default="json")
    
    # Analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze a repository")
    analyze_parser.add_argument("repo_url", help="GitHub repository URL")
    analyze_parser.add_argument("--check-security", action="store_true", default=True)
    analyze_parser.add_argument("--format", choices=["json", "text"], default="json")
    
    # Submit command
    submit_parser = subparsers.add_parser("submit", help="Submit tools to registry")
    submit_parser.add_argument("repo_url", help="GitHub repository URL")
    submit_parser.add_argument("--dry-run", action="store_true", default=True)
    submit_parser.add_argument("--min-quality", type=float, default=50)
    submit_parser.add_argument("--min-security", type=float, default=70)
    submit_parser.add_argument("--registry-url", default="http://localhost:3002/api")
    submit_parser.add_argument("--format", choices=["json", "text"], default="json")
    
    # Run command
    run_parser = subparsers.add_parser("run", help="Run complete pipeline")
    run_parser.add_argument("--days-back", type=int, default=7)
    run_parser.add_argument("--max-repos", type=int, default=20)
    run_parser.add_argument("--submit", action="store_true", help="Submit to registry")
    run_parser.add_argument("--dry-run", action="store_true", default=True)
    run_parser.add_argument("--min-quality", type=float, default=50)
    run_parser.add_argument("--min-security", type=float, default=70)
    run_parser.add_argument("--format", choices=["json", "text"], default="json")
    
    # Stats command
    stats_parser = subparsers.add_parser("stats", help="Show discovery statistics")
    stats_parser.add_argument("--format", choices=["json", "text"], default="json")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Run the appropriate command
    commands = {
        "scan": cmd_scan,
        "analyze": cmd_analyze,
        "submit": cmd_submit,
        "run": cmd_run,
        "stats": cmd_stats,
    }
    
    return asyncio.run(commands[args.command](args))


if __name__ == "__main__":
    sys.exit(main())
