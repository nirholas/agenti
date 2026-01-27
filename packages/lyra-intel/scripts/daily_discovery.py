#!/usr/bin/env python3
"""
Daily Discovery Scheduler

This script is designed to be run daily (via cron or GitHub Actions) to:
1. Scan GitHub for new MCP crypto repositories
2. Analyze discovered repositories
3. Submit approved tools to the Lyra Registry

Usage:
    python scripts/daily_discovery.py [--submit] [--dry-run]
    
Environment Variables:
    GITHUB_TOKEN: GitHub API token (for higher rate limits)
    OPENAI_API_KEY: OpenAI API key (for AI-powered analysis)
    LYRA_REGISTRY_URL: Registry API URL
    LYRA_REGISTRY_API_KEY: Registry API key
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.discovery.pipeline import DiscoveryPipeline, PipelineConfig
from src.discovery.github_scanner import GitHubScanConfig
from src.discovery.analyzer import ToolAnalysisConfig
from src.discovery.submitter import SubmitterConfig

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("daily-discovery")


async def run_daily_discovery(
    submit: bool = False,
    dry_run: bool = True,
    days_back: int = 1,  # Just look at last 24 hours for daily runs
):
    """
    Run the daily discovery pipeline.
    
    Args:
        submit: Whether to submit discovered tools to registry
        dry_run: If True, simulate submission without actually submitting
        days_back: How many days back to search (default 1 for daily)
    """
    logger.info("="*60)
    logger.info("LYRA INTEL DAILY DISCOVERY")
    logger.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    logger.info("="*60)
    
    # Configuration
    scanner_config = GitHubScanConfig(
        github_token=os.environ.get("GITHUB_TOKEN"),
        days_back=days_back,
        min_stars=0,  # Accept any repo for daily discovery
        max_total_results=100,  # Reasonable limit for daily runs
    )
    
    analyzer_config = ToolAnalysisConfig(
        ai_provider="openai" if os.environ.get("OPENAI_API_KEY") else "local",
        api_key=os.environ.get("OPENAI_API_KEY"),
        check_security=True,
    )
    
    submitter_config = SubmitterConfig(
        registry_url=os.environ.get("LYRA_REGISTRY_URL", "http://localhost:3002/api"),
        registry_api_key=os.environ.get("LYRA_REGISTRY_API_KEY"),
        dry_run=dry_run,
        min_quality_score=50.0,
        min_security_score=70.0,
    )
    
    pipeline_config = PipelineConfig(
        scanner_config=scanner_config,
        analyzer_config=analyzer_config,
        submitter_config=submitter_config,
        save_results=True,
        results_dir="./discovery_results",
        parallel_analysis=3,
    )
    
    # Run pipeline
    async with DiscoveryPipeline(pipeline_config) as pipeline:
        result = await pipeline.run(
            days_back=days_back,
            submit=submit,
        )
    
    # Log summary
    logger.info("\n" + result.summary())
    
    # Save summary to GitHub Actions output if running in CI
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"repos_discovered={result.repos_discovered}\n")
            f.write(f"tools_found={result.total_tools_found}\n")
            f.write(f"tools_accepted={result.tools_accepted}\n")
            f.write(f"duration={result.duration_seconds:.1f}\n")
    
    # Exit code based on results
    if result.errors and len(result.errors) > len(result.analyzed_repos):
        logger.error(f"Too many errors: {len(result.errors)}")
        return 1
    
    return 0


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Daily Discovery Pipeline")
    parser.add_argument("--submit", action="store_true", 
                       help="Submit discovered tools to registry")
    parser.add_argument("--dry-run", action="store_true", default=True,
                       help="Simulate submission (default: True)")
    parser.add_argument("--days-back", type=int, default=1,
                       help="Days to look back (default: 1)")
    parser.add_argument("--no-dry-run", action="store_true",
                       help="Actually submit (not a dry run)")
    
    args = parser.parse_args()
    
    # --no-dry-run overrides --dry-run
    dry_run = not args.no_dry_run if args.no_dry_run else args.dry_run
    
    return asyncio.run(run_daily_discovery(
        submit=args.submit,
        dry_run=dry_run,
        days_back=args.days_back,
    ))


if __name__ == "__main__":
    sys.exit(main())
