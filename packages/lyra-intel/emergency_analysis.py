#!/usr/bin/env python3
"""
Emergency Analysis Script

Quickly compare two branches to find where things went wrong.
"""

import subprocess
import json
from pathlib import Path
import sys

def analyze_branch_diff(repo_path, base_branch="main", compare_branch="preview"):
    """Analyze differences between branches."""
    print(f"\n{'='*60}")
    print(f"ANALYZING: {compare_branch} vs {base_branch}")
    print(f"{'='*60}\n")
    
    # Get commit diff
    result = subprocess.run(
        ['git', '-C', repo_path, 'log', f'{base_branch}..{compare_branch}', '--oneline'],
        capture_output=True,
        text=True
    )
    
    commits = result.stdout.strip().split('\n')
    print(f"📊 Total commits ahead: {len(commits)}")
    print("\nCommit history:")
    for commit in commits[:10]:  # Show first 10
        print(f"  {commit}")
    if len(commits) > 10:
        print(f"  ... and {len(commits) - 10} more")
    
    # Find when MCP plugin issues started
    print("\n🔍 Searching for MCP plugin related commits...")
    mcp_commits = [c for c in commits if any(keyword in c.lower() for keyword in ['mcp', 'plugin', 'api', 'fetch'])]
    
    if mcp_commits:
        print(f"\n⚠️  Found {len(mcp_commits)} MCP/plugin related commits:")
        for commit in mcp_commits:
            print(f"  {commit}")
    
    # Get file changes
    result = subprocess.run(
        ['git', '-C', repo_path, 'diff', f'{base_branch}...{compare_branch}', '--stat'],
        capture_output=True,
        text=True
    )
    
    print(f"\n📁 File changes summary:")
    print(result.stdout)
    
    # Get current issues
    result = subprocess.run(
        ['git', '-C', repo_path, 'status', '--short'],
        capture_output=True,
        text=True
    )
    
    if result.stdout.strip():
        print(f"\n⚠️  Uncommitted changes:")
        print(result.stdout)

def find_problematic_commit(repo_path, keyword="mcp"):
    """Find the first commit that introduced a specific keyword."""
    result = subprocess.run(
        ['git', '-C', repo_path, 'log', '--all', '--oneline', f'--grep={keyword}', '-i'],
        capture_output=True,
        text=True
    )
    
    commits = result.stdout.strip().split('\n') if result.stdout else []
    
    if commits:
        print(f"\n🎯 First {keyword.upper()} commit: {commits[-1]}")
        return commits[-1].split()[0]
    
    return None

def analyze_code_complexity(repo_path):
    """Run Lyra Intel analysis."""
    print(f"\n{'='*60}")
    print("RUNNING LYRA INTEL ANALYSIS")
    print(f"{'='*60}\n")
    
    # Run quick scan
    result = subprocess.run(
        ['python', 'cli.py', 'scan', repo_path],
        capture_output=True,
        text=True,
        timeout=300
    )
    
    print(result.stdout)
    
    # Run complexity analysis
    print("\n🔬 Analyzing code complexity...")
    result = subprocess.run(
        ['python', 'cli.py', 'complexity', repo_path],
        capture_output=True,
        text=True,
        timeout=300
    )
    
    print(result.stdout)
    
    # Run dead code detection
    print("\n💀 Detecting dead code...")
    result = subprocess.run(
        ['python', 'cli.py', 'dead-code', repo_path],
        capture_output=True,
        text=True,
        timeout=300
    )
    
    print(result.stdout)

def generate_recommendation(repo_path):
    """Generate recommendation based on analysis."""
    print(f"\n{'='*60}")
    print("RECOMMENDATION")
    print(f"{'='*60}\n")
    
    # Check git status
    result = subprocess.run(
        ['git', '-C', repo_path, 'log', 'main..preview', '--oneline'],
        capture_output=True,
        text=True
    )
    
    commit_count = len(result.stdout.strip().split('\n')) if result.stdout.strip() else 0
    
    print(f"Preview branch is {commit_count} commits ahead of main\n")
    
    # Find MCP-related commit
    result = subprocess.run(
        ['git', '-C', repo_path, 'log', '--all', '--oneline', '--grep=mcp', '-i'],
        capture_output=True,
        text=True
    )
    
    mcp_commits = result.stdout.strip().split('\n') if result.stdout else []
    
    if mcp_commits:
        first_mcp = mcp_commits[-1].split()[0]
        
        print("📋 OPTION 1: Surgical Revert (RECOMMENDED)")
        print(f"   Go back to just before MCP issues started")
        print(f"   Command: git checkout preview")
        print(f"            git revert {first_mcp}..HEAD")
        print(f"   or:      git reset --hard {first_mcp}^")
        print(f"   Pros: Keep all good work, remove problematic changes")
        print(f"   Cons: Need to redo MCP plugin implementation")
        
    print("\n📋 OPTION 2: Cherry-pick Good Commits")
    print("   1. Create new branch from main")
    print("   2. Cherry-pick the working commits (agents, UI, etc.)")
    print("   3. Skip the problematic MCP commits")
    print("   Command: git checkout -b preview-clean main")
    print("            git cherry-pick <good-commit-hash>")
    print("   Pros: Fresh start, keep only what works")
    print("   Cons: Manual process, time-consuming")
    
    print("\n📋 OPTION 3: Debug & Fix Forward (NOT RECOMMENDED)")
    print("   Stay on preview, keep debugging")
    print("   Pros: Don't lose any work")
    print("   Cons: Already spent days, unclear root cause")
    
    print("\n📋 OPTION 4: Parallel Development")
    print("   1. Backup preview branch")
    print("   2. Create clean branch for MCP work")
    print("   3. Implement MCP properly with isolated testing")
    print("   4. Merge when working")
    print("   Command: git checkout -b preview-backup preview")
    print("            git checkout -b mcp-fix main")
    print("   Pros: Safe, systematic, learn from mistakes")
    print("   Cons: Need discipline to not repeat issues")
    
    print("\n💡 MY RECOMMENDATION:")
    print("   OPTION 4 - Parallel Development")
    print("   1. Backup current work")
    print("   2. Start fresh MCP implementation")
    print("   3. Use Lyra Intel to analyze before each commit")
    print("   4. Merge only when tests pass")

def main():
    if len(sys.argv) < 2:
        print("Usage: python emergency_analysis.py /path/to/repo [base_branch] [compare_branch]")
        print("Example: python emergency_analysis.py ../my-repo main feature-branch")
        sys.exit(1)
    
    repo_path = sys.argv[1]
    base_branch = sys.argv[2] if len(sys.argv) > 2 else "main"
    compare_branch = sys.argv[3] if len(sys.argv) > 3 else "preview"
    
    if not Path(repo_path).exists():
        print(f"Error: Path {repo_path} does not exist")
        sys.exit(1)
    
    # Verify it's a git repository
    if not Path(repo_path, '.git').exists():
        print(f"Error: {repo_path} is not a git repository")
        sys.exit(1)
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           🚨 LYRA INTEL EMERGENCY ANALYSIS 🚨               ║
║                  Repository Debug Session                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    # Step 1: Analyze branch differences
    analyze_branch_diff(repo_path, base_branch, compare_branch)
    
    # Step 2: Find problematic commit
    mcp_commit = find_problematic_commit(repo_path, "mcp")
    
    # Step 3: Run code analysis
    analyze_code_complexity(repo_path)
    
    # Step 4: Generate recommendation
    generate_recommendation(repo_path)
    
    print("\n" + "="*60)
    print("Analysis complete! Review recommendations above.")
    print("="*60)

if __name__ == "__main__":
    main()
