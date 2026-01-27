# Lyra Intel - Use Cases & Best Practices

Real-world scenarios and proven workflows for getting the most out of Lyra Intel.

## Table of Contents

- [Use Case 1: Securing a Legacy Codebase](#use-case-1-securing-a-legacy-codebase)
- [Use Case 2: Pre-Commit Code Quality Gates](#use-case-2-pre-commit-code-quality-gates)
- [Use Case 3: CI/CD Security Pipeline](#use-case-3-cicd-security-pipeline)
- [Use Case 4: Code Review Assistance](#use-case-4-code-review-assistance)
- [Use Case 5: Monorepo Migration Planning](#use-case-5-monorepo-migration-planning)
- [Use Case 6: Technical Debt Assessment](#use-case-6-technical-debt-assessment)
- [Use Case 7: Team Knowledge Base](#use-case-7-team-knowledge-base)
- [Best Practices](#best-practices)

---

## Use Case 1: Securing a Legacy Codebase

**Scenario**: You've inherited a 10-year-old codebase with unknown security issues and no automated scanning.

### Prerequisites

- Python 3.9+ installed
- Lyra Intel installed (`pip install lyra-intel`)
- Git repository cloned locally
- 30 minutes for initial scan

### Step-by-Step Workflow

#### Step 1: Run Initial Security Audit

```python
# audit_legacy_code.py
import asyncio
import json
from src.core.engine import LyraIntelEngine, EngineConfig
from src.security.security_scanner import SecurityScanner

async def audit():
    # Configure for security-first analysis
    config = EngineConfig(
        mode="local",
        max_workers=8,
        enable_cache=True,
        cache_backend="memory"
    )
    
    engine = LyraIntelEngine(config)
    repo_path = "/path/to/legacy/repo"
    
    print("🔍 Starting security audit of legacy codebase...")
    print(f"Repository: {repo_path}\n")
    
    # Run comprehensive analysis
    results = await engine.analyze_repository(
        repo_path,
        features=["security", "dependencies", "patterns", "git-history"]
    )
    
    return results

if __name__ == "__main__":
    results = asyncio.run(audit())
    
    # Extract security findings
    security = results.get("security", {})
    findings = security.get("findings", [])
    
    print("\n" + "="*60)
    print("SECURITY AUDIT RESULTS")
    print("="*60 + "\n")
    
    # Group by severity
    by_severity = {}
    for finding in findings:
        severity = finding.get("severity", "unknown").upper()
        if severity not in by_severity:
            by_severity[severity] = []
        by_severity[severity].append(finding)
    
    # Print summary
    for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        count = len(by_severity.get(severity, []))
        icon = "🔴" if severity == "CRITICAL" else "🟠" if severity == "HIGH" else "🟡" if severity == "MEDIUM" else "🔵"
        print(f"{icon} {severity}: {count} findings")
    
    print("\n" + "="*60)
    print("TOP CRITICAL ISSUES (First 5)")
    print("="*60 + "\n")
    
    critical = by_severity.get("CRITICAL", [])[:5]
    for i, issue in enumerate(critical, 1):
        print(f"{i}. {issue.get('title', 'Unknown')}")
        print(f"   File: {issue.get('file', 'N/A')}")
        print(f"   Line: {issue.get('line', 'N/A')}")
        print(f"   Description: {issue.get('description', 'N/A')}")
        print(f"   Recommendation: {issue.get('recommendation', 'N/A')}\n")
    
    # Save full report
    with open("security_audit.json", "w") as f:
        json.dump(results, f, indent=2)
    print("✅ Full audit saved to: security_audit.json")
```

Run the audit:
```bash
python audit_legacy_code.py
```

#### Step 2: Generate Executive Report

```python
# generate_security_report.py
from src.export.report_generator import ReportGenerator
from src.reports.generator import SecurityReportGenerator
import json

# Load previous results
with open("security_audit.json") as f:
    results = json.load(f)

# Generate executive report
report_gen = SecurityReportGenerator()
executive_report = report_gen.generate(results, format="pdf")

# Generate technical report
technical_report = report_gen.generate(results, format="html", detail_level="detailed")

print("✅ Reports generated:")
print("   - Executive: executive_security_report.pdf")
print("   - Technical: technical_security_report.html")
```

#### Step 3: Triage and Action Plan

```python
# create_action_plan.py
import json
from datetime import datetime, timedelta

with open("security_audit.json") as f:
    results = json.load(f)

findings = results.get("security", {}).get("findings", [])

# Create action plan with priorities
action_plan = {
    "generated": datetime.now().isoformat(),
    "summary": {
        "total_findings": len(findings),
        "critical": len([f for f in findings if f.get("severity") == "CRITICAL"]),
        "high": len([f for f in findings if f.get("severity") == "HIGH"]),
    },
    "timeline": {
        "week_1": {"target": "critical", "estimate_hours": 40},
        "week_2_3": {"target": "high", "estimate_hours": 60},
        "week_4": {"target": "medium", "estimate_hours": 40},
    },
    "critical_issues": [f for f in findings if f.get("severity") == "CRITICAL"],
}

# Save action plan
with open("security_action_plan.json", "w") as f:
    json.dump(action_plan, f, indent=2)

print("Security Action Plan Created")
print(f"Total Issues: {action_plan['summary']['total_findings']}")
print(f"  Critical: {action_plan['summary']['critical']}")
print(f"  High: {action_plan['summary']['high']}")
print(f"\nEstimated remediation time: 140 hours (2-3 weeks)")
print("Plan saved to: security_action_plan.json")
```

### Expected Output

```
============================================================
SECURITY AUDIT RESULTS
============================================================

🔴 CRITICAL: 3 findings
🟠 HIGH: 12 findings
🟡 MEDIUM: 28 findings
🔵 LOW: 45 findings

============================================================
TOP CRITICAL ISSUES (First 5)
============================================================

1. Hardcoded API Key in Config
   File: src/config/database.py
   Line: 42
   Description: API key hardcoded in source code
   Recommendation: Move to environment variables or AWS Secrets Manager

2. SQL Injection Vulnerability
   File: src/api/routes.py
   Line: 156
   Description: Unsanitized user input in SQL query
   Recommendation: Use parameterized queries with ORM
```

### Tips & Pitfalls

**✅ Do:**
- Start with CRITICAL findings
- Document remediation process
- Run regular rescans (monthly)
- Version control the audit results

**❌ Don't:**
- Try to fix everything at once
- Ignore recurring patterns
- Skip dependency scanning
- Forget to test fixes

---

## Use Case 2: Pre-Commit Code Quality Gates

**Scenario**: You want to prevent bad code from entering the repository using git hooks.

### Prerequisites

- Git repository with pre-commit hook support
- Lyra Intel installed locally
- 2-5 minutes scanning time per commit

### Setup

#### Step 1: Create Pre-Commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Lyra Intel Pre-Commit Hook
# Prevents commits with critical issues

set -e

STAGED_FILES=$(git diff --cached --name-only)
TEMP_DIR=$(mktemp -d)

echo "🔍 Running Lyra Intel pre-commit checks..."

# Check out staged files to temp directory
git checkout-index --prefix="$TEMP_DIR/" -- $STAGED_FILES

# Run Lyra Intel on staged changes
python -c "
import asyncio
import subprocess
import sys
from src.security.security_scanner import SecurityScanner

async def check_code():
    scanner = SecurityScanner()
    
    # Scan staged files
    for file in '$STAGED_FILES'.split():
        if not file.endswith('.py'):
            continue
        try:
            with open('$TEMP_DIR' + file) as f:
                code = f.read()
            findings = await scanner.scan_code(code, 'python')
            
            # Fail on critical issues
            critical = [f for f in findings if f.get('severity') == 'CRITICAL']
            if critical:
                print(f'❌ CRITICAL ISSUES in {file}:')
                for issue in critical:
                    print(f'   - {issue.get(\"message\")}')
                sys.exit(1)
        except Exception as e:
            print(f'⚠️  Error scanning {file}: {e}')
    
    print('✅ Pre-commit checks passed')

asyncio.run(check_code())
"

# Cleanup
rm -rf "$TEMP_DIR"
exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

#### Step 2: Configure for Your Team

Create `.lyra-pre-commit.json`:

```json
{
  "enabled": true,
  "check_severity": "HIGH",
  "check_patterns": [
    "hardcoded_secrets",
    "sql_injection",
    "command_injection",
    "path_traversal"
  ],
  "exclude_patterns": [
    "tests/**",
    "vendor/**",
    "*.min.js"
  ],
  "max_check_time_seconds": 30,
  "allow_override": false,
  "failure_message": "⛔ Code quality gate failed. Fix issues before committing.",
  "warning_message": "⚠️  Code quality warnings (non-blocking)"
}
```

#### Step 3: Usage

```bash
# Make a change with an issue
echo 'api_key = "sk-123456"' >> src/config.py

# Try to commit
git add src/config.py
git commit -m "Update config"

# Output:
# 🔍 Running Lyra Intel pre-commit checks...
# ❌ CRITICAL ISSUES in src/config.py:
#    - Hardcoded API key detected
```

### Expected Workflow

```
Developer makes changes
    ↓
git commit -m "message"
    ↓
Pre-commit hook triggered
    ↓
Lyra Intel scans staged files (2-5s)
    ↓
Critical issues found? → YES → Commit blocked ❌
    ↓ NO
Commit proceeds ✅
    ↓
Push to repository
```

### Performance Tips

- Scan only staged files (faster)
- Increase timeout for large files
- Cache results between commits
- Run full scans in CI/CD pipeline

---

## Use Case 3: CI/CD Security Pipeline

**Scenario**: Automatically scan all pull requests and prevent merging code with security issues.

### GitHub Actions Example

Create `.github/workflows/security-scan.yml`:

```yaml
name: Security Scan with Lyra Intel

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
      with:
        fetch-depth: 0  # Full history for analysis
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: "3.11"
    
    - name: Install Lyra Intel
      run: |
        pip install lyra-intel
    
    - name: Run Security Scan
      run: |
        python -m src.security.security_scanner \
          --path . \
          --format json \
          --output scan-results.json
    
    - name: Check for Critical Issues
      run: |
        python scripts/check_critical_issues.py scan-results.json
    
    - name: Upload Results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: security-scan-results
        path: scan-results.json
    
    - name: Comment on PR
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const results = JSON.parse(fs.readFileSync('scan-results.json'));
          const critical = results.findings.filter(f => f.severity === 'CRITICAL').length;
          const high = results.findings.filter(f => f.severity === 'HIGH').length;
          
          let comment = `## 🔍 Lyra Intel Security Scan\n\n`;
          comment += `- 🔴 Critical: ${critical}\n`;
          comment += `- 🟠 High: ${high}\n`;
          
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: comment
          });
```

Create `scripts/check_critical_issues.py`:

```python
import json
import sys

def check_critical_issues(results_file):
    with open(results_file) as f:
        results = json.load(f)
    
    findings = results.get("findings", [])
    critical = [f for f in findings if f.get("severity") == "CRITICAL"]
    
    if critical:
        print(f"❌ Found {len(critical)} critical issues:")
        for issue in critical:
            print(f"   - {issue.get('title')} in {issue.get('file')}")
        sys.exit(1)
    
    print("✅ No critical issues found")
    sys.exit(0)

if __name__ == "__main__":
    check_critical_issues(sys.argv[1])
```

### Expected Workflow

```
Developer creates PR
    ↓
GitHub Actions triggered
    ↓
Lyra Intel runs security scan (1-5 min)
    ↓
Critical issues? → YES → PR fails ❌
    ↓ NO
Continues to other checks
    ↓
Developer can merge ✅
```

---

## Use Case 4: Code Review Assistance

**Scenario**: Use Lyra Intel to get AI-powered insights during code reviews.

### Setup

```python
# code_review_assistant.py
import asyncio
from src.ai.ai_analyzer import AIAnalyzer
from src.security.security_scanner import SecurityScanner
from src.analyzers.pattern_detector import PatternDetector

async def review_code(file_path, language="python"):
    """Provide comprehensive code review insights."""
    
    with open(file_path) as f:
        code = f.read()
    
    print(f"\n📋 Code Review: {file_path}\n")
    print("="*60)
    
    # 1. Security Issues
    print("\n🔐 Security Analysis")
    print("-"*60)
    scanner = SecurityScanner()
    security_findings = await scanner.scan_code(code, language)
    
    if security_findings:
        for finding in security_findings[:5]:
            print(f"⚠️  {finding.get('title')}")
            print(f"   Line: {finding.get('line')}")
            print(f"   Fix: {finding.get('recommendation')}\n")
    else:
        print("✅ No security issues found\n")
    
    # 2. Code Patterns
    print("🎯 Code Patterns")
    print("-"*60)
    detector = PatternDetector()
    patterns = detector.detect_patterns(code, language)
    
    if patterns:
        for pattern in patterns[:3]:
            print(f"📍 {pattern.get('name')}: {pattern.get('description')}")
    else:
        print("✅ No problematic patterns found\n")
    
    # 3. AI Insights
    print("🤖 AI-Powered Insights")
    print("-"*60)
    analyzer = AIAnalyzer()
    
    insights = await analyzer.analyze(
        code=code,
        language=language,
        analysis_type="code_review"
    )
    
    print(f"Summary: {insights.get('summary')}")
    print(f"\nSuggestions:")
    for suggestion in insights.get('suggestions', [])[:3]:
        print(f"  • {suggestion}")
    
    print("\n" + "="*60)

# Usage
if __name__ == "__main__":
    file_path = "src/api/routes.py"
    asyncio.run(review_code(file_path))
```

### Integration with GitHub PR Comments

Create a bot that comments on PRs with review insights:

```python
# Add to your CI/CD workflow
def post_code_review(pr_number, files):
    """Post code review comments on PR."""
    for file in files:
        review = asyncio.run(review_code(file))
        
        # Post comment via GitHub API
        github_api.post_comment(
            pr=pr_number,
            file=file,
            body=format_review(review)
        )
```

---

## Use Case 5: Monorepo Migration Planning

**Scenario**: You need to migrate a monorepo from one framework/language version to another.

### Prerequisites

- Monorepo with 100+ packages
- Lyra Intel with migration planner
- 30-60 minutes for analysis

### Workflow

```python
# plan_migration.py
import asyncio
import json
from src.migration.migration_planner import MigrationPlanner
from src.core.engine import LyraIntelEngine

async def plan_monorepo_migration():
    """Create detailed migration plan for monorepo."""
    
    engine = LyraIntelEngine()
    planner = MigrationPlanner()
    
    # Analyze current state
    print("📊 Analyzing monorepo structure...")
    results = await engine.analyze_repository("/path/to/monorepo")
    
    # Plan migration
    print("🔄 Planning migration...")
    migration_plan = await planner.plan_migration(
        current_state=results,
        from_version="Node 14",
        to_version="Node 18",
        strategy="gradual"  # or 'big_bang'
    )
    
    # Generate report
    print("\n" + "="*60)
    print("MIGRATION PLAN")
    print("="*60 + "\n")
    
    print(f"Total Packages: {migration_plan['total_packages']}")
    print(f"Affected Packages: {migration_plan['affected_packages']}")
    print(f"Complexity: {migration_plan['complexity_score']}/10\n")
    
    print("Phases:")
    for i, phase in enumerate(migration_plan['phases'], 1):
        print(f"\nPhase {i}: {phase['name']} ({phase['duration']})")
        print(f"  Packages: {len(phase['packages'])}")
        print(f"  Estimated effort: {phase['effort_hours']} hours")
        print(f"  Dependencies: {', '.join(phase['dependencies'])}")
        
        print("  Steps:")
        for step in phase['steps']:
            print(f"    1. {step['name']}")
            print(f"       Command: {step['command']}")
            print(f"       Validation: {step['validation']}")
    
    # Save migration plan
    with open("migration_plan.json", "w") as f:
        json.dump(migration_plan, f, indent=2)
    
    print("\n✅ Migration plan saved to: migration_plan.json")
    return migration_plan

# Usage
if __name__ == "__main__":
    plan = asyncio.run(plan_monorepo_migration())
```

### Expected Output

```
================================================================================
MIGRATION PLAN
================================================================================

Total Packages: 47
Affected Packages: 43
Complexity: 7/10

Phases:

Phase 1: Dependencies & Core (2 weeks)
  Packages: 5
  Estimated effort: 40 hours
  Dependencies: @types/node, typescript, jest
  Steps:
    1. Update @types/node to v18
       Command: npm install @types/node@18 --save-dev
       Validation: npm run type-check
    
    2. Update TypeScript to 4.9+
       Command: npm install typescript@4.9 --save-dev
       Validation: npm run build

Phase 2: Framework Updates (3 weeks)
  Packages: 23
  Estimated effort: 60 hours
  ...
```

---

## Use Case 6: Technical Debt Assessment

**Scenario**: Quantify and track technical debt over time.

### Setup

```python
# assess_tech_debt.py
import asyncio
import json
from datetime import datetime
from src.core.engine import LyraIntelEngine

async def assess_technical_debt():
    """Comprehensive technical debt assessment."""
    
    engine = LyraIntelEngine()
    results = await engine.analyze_repository("/path/to/repo")
    
    assessment = {
        "timestamp": datetime.now().isoformat(),
        "metrics": {
            "code_quality": calculate_code_quality(results),
            "test_coverage": results.get("test_coverage", 0),
            "complexity": calculate_complexity(results),
            "security_debt": calculate_security_debt(results),
            "documentation": calculate_documentation_score(results),
        },
        "debt_items": categorize_debt_items(results),
        "estimated_resolution_time": estimate_resolution_hours(results),
        "recommendations": generate_recommendations(results),
    }
    
    # Print assessment
    print_assessment(assessment)
    
    # Save for tracking
    with open(f"tech_debt_{datetime.now().strftime('%Y-%m-%d')}.json", "w") as f:
        json.dump(assessment, f, indent=2)
    
    return assessment

def calculate_code_quality(results):
    """Score from 0-100."""
    metrics = results.get("metrics", {})
    
    score = 100
    score -= metrics.get("avg_complexity", 0) * 0.5
    score -= (100 - metrics.get("test_coverage", 0)) * 0.2
    score -= len(results.get("code_smells", [])) * 0.1
    
    return max(0, min(100, score))

def calculate_complexity(results):
    """Average cyclomatic complexity."""
    metrics = results.get("metrics", {})
    return metrics.get("avg_complexity", 0)

def calculate_security_debt(results):
    """Score debt from security issues."""
    security = results.get("security", {})
    findings = security.get("findings", [])
    
    debt_score = 0
    for finding in findings:
        if finding.get("severity") == "CRITICAL":
            debt_score += 50
        elif finding.get("severity") == "HIGH":
            debt_score += 20
        elif finding.get("severity") == "MEDIUM":
            debt_score += 5
    
    return debt_score

def categorize_debt_items(results):
    """Categorize debt by type."""
    return {
        "security": len(results.get("security", {}).get("findings", [])),
        "complexity": count_high_complexity(results),
        "dead_code": count_dead_code(results),
        "test_coverage": count_untested_code(results),
        "documentation": count_undocumented_code(results),
    }

def print_assessment(assessment):
    """Pretty print assessment."""
    metrics = assessment["metrics"]
    
    print("\n" + "="*60)
    print("TECHNICAL DEBT ASSESSMENT")
    print("="*60 + "\n")
    
    print(f"Code Quality Score: {metrics['code_quality']:.1f}/100")
    print(f"Complexity Score: {metrics['complexity']:.1f}/10")
    print(f"Security Debt: {metrics['security_debt']} points")
    print(f"Test Coverage: {metrics['test_coverage']:.1f}%")
    print(f"Documentation Score: {metrics['documentation']:.1f}/100\n")
    
    print("Debt Breakdown:")
    for category, count in assessment["debt_items"].items():
        print(f"  • {category.title()}: {count} items")
    
    print(f"\nEstimated Resolution Time: {assessment['estimated_resolution_time']} hours\n")
    
    print("Top Recommendations:")
    for i, rec in enumerate(assessment["recommendations"][:5], 1):
        print(f"  {i}. {rec}")

# Usage
if __name__ == "__main__":
    assessment = asyncio.run(assess_technical_debt())
```

### Track Over Time

```python
# track_tech_debt_trends.py
import json
import glob
from datetime import datetime

def track_debt_trends():
    """Analyze technical debt trends over time."""
    
    # Load all assessments
    files = sorted(glob.glob("tech_debt_*.json"))
    assessments = []
    
    for file in files:
        with open(file) as f:
            assessments.append(json.load(f))
    
    # Analyze trends
    print("\n" + "="*60)
    print("TECHNICAL DEBT TRENDS")
    print("="*60 + "\n")
    
    first = assessments[0]["metrics"]["code_quality"]
    latest = assessments[-1]["metrics"]["code_quality"]
    change = latest - first
    
    print(f"Code Quality Change: {first:.1f} → {latest:.1f} ({change:+.1f})")
    print(f"Trend: {'📈 Improving' if change > 0 else '📉 Declining'}\n")
    
    # Security debt trend
    first_security = assessments[0]["metrics"]["security_debt"]
    latest_security = assessments[-1]["metrics"]["security_debt"]
    
    print(f"Security Debt: {first_security} → {latest_security} ({latest_security - first_security:+d})")
    
    if latest_security < first_security:
        print("✅ Security issues are being resolved!")

track_debt_trends()
```

---

## Use Case 7: Team Knowledge Base

**Scenario**: Build a searchable knowledge base from your codebase for onboarding and documentation.

### Setup

```python
# build_knowledge_base.py
import asyncio
from src.knowledge.knowledge_graph import KnowledgeGraph
from src.search.semantic_search import SemanticSearch

async def build_knowledge_base():
    """Build searchable knowledge base from codebase."""
    
    # Analyze repository
    engine = LyraIntelEngine()
    results = await engine.analyze_repository("/path/to/repo")
    
    # Build knowledge graph
    kg = KnowledgeGraph()
    kg.build_from_analysis(results)
    
    # Index for semantic search
    search = SemanticSearch()
    await search.index_codebase("/path/to/repo")
    
    print("✅ Knowledge base built!")
    print("   Ready for semantic queries")
    
    return kg, search

async def query_knowledge_base(search, query):
    """Query knowledge base with natural language."""
    
    results = await search.search(query, top_k=5)
    
    print(f"\n🔍 Query: {query}\n")
    print("="*60)
    
    for i, result in enumerate(results, 1):
        print(f"\n{i}. {result['file']}:{result['line']}")
        print(f"   Type: {result['element_type']}")
        print(f"   Score: {result['similarity']:.2f}")
        print(f"   Code:\n{result['code_snippet']}")

# Usage Examples
if __name__ == "__main__":
    kg, search = asyncio.run(build_knowledge_base())
    
    # Example queries
    queries = [
        "How do we authenticate users?",
        "Find all payment processing code",
        "Where is the database connection setup?",
        "How do we handle errors?",
    ]
    
    for query in queries:
        asyncio.run(query_knowledge_base(search, query))
```

---

## Best Practices

### 1. Scheduling Regular Scans

```python
# schedule_scans.py
from apscheduler.schedulers.background import BackgroundScheduler
import asyncio
from src.core.engine import LyraIntelEngine

def schedule_scans():
    """Schedule regular security scans."""
    
    scheduler = BackgroundScheduler()
    
    # Daily security scan at 2 AM
    scheduler.add_job(
        lambda: asyncio.run(daily_security_scan()),
        'cron',
        hour=2,
        minute=0,
        id='daily_security_scan'
    )
    
    # Weekly comprehensive analysis on Sunday
    scheduler.add_job(
        lambda: asyncio.run(weekly_analysis()),
        'cron',
        day_of_week=6,
        hour=3,
        minute=0,
        id='weekly_analysis'
    )
    
    scheduler.start()
    print("✅ Scan scheduler started")

async def daily_security_scan():
    """Run daily security scan."""
    engine = LyraIntelEngine()
    results = await engine.analyze_repository("/path/to/repo", features=["security"])
    # Send alerts if critical issues found
    send_alerts(results)

async def weekly_analysis():
    """Run comprehensive weekly analysis."""
    engine = LyraIntelEngine()
    results = await engine.analyze_repository("/path/to/repo", features=["all"])
    # Generate and archive report
    archive_report(results)
```

### 2. Integration with Issue Tracking

```python
# auto_create_issues.py
import asyncio
import json
from github import Github

async def auto_create_github_issues(scan_results):
    """Automatically create GitHub issues from scan findings."""
    
    g = Github(os.getenv("GITHUB_TOKEN"))
    repo = g.get_repo("org/repo")
    
    findings = scan_results.get("security", {}).get("findings", [])
    
    for finding in findings:
        if finding.get("severity") in ["CRITICAL", "HIGH"]:
            # Check if issue already exists
            existing = repo.get_issues(
                state="open",
                labels=["security"]
            )
            
            if not any(f['title'] in issue.title for issue in existing):
                # Create new issue
                repo.create_issue(
                    title=finding.get("title"),
                    body=f"""
## Security Finding

**Severity:** {finding.get('severity')}
**File:** {finding.get('file')}
**Line:** {finding.get('line')}

### Description
{finding.get('description')}

### Recommendation
{finding.get('recommendation')}

---
*Auto-generated by Lyra Intel*
                    """,
                    labels=["security", "auto-generated"]
                )
                print(f"✅ Created issue: {finding.get('title')}")
```

### 3. Performance Optimization

```python
# optimize_scanning.py

# Best Practices:
# 1. Use caching aggressively
config = EngineConfig(
    enable_cache=True,
    cache_backend="redis",  # Distributed cache
    cache_ttl=3600 * 24 * 7  # 1 week
)

# 2. Parallelize analysis
config = EngineConfig(
    max_workers=min(cpu_count(), 16),
    batch_size=1000
)

# 3. Target specific features
results = await engine.analyze_repository(
    repo_path,
    features=["security"]  # Only security, skip everything else
)

# 4. Use streaming for large repos
async for batch in engine.stream_analysis(repo_path):
    process_batch(batch)
```

### 4. Alerting and Notifications

```python
# alerts.py
from slack_sdk import WebClient

def send_slack_alert(findings):
    """Send critical findings to Slack."""
    
    critical = [f for f in findings if f.get("severity") == "CRITICAL"]
    
    if not critical:
        return
    
    client = WebClient(token=os.getenv("SLACK_BOT_TOKEN"))
    
    message = f"""
🚨 *Lyra Intel - Critical Security Issues Found*

Found {len(critical)} critical issues:

"""
    
    for issue in critical[:5]:
        message += f"• {issue.get('title')} in {issue.get('file')}\n"
    
    client.chat_postMessage(
        channel="#security",
        text=message,
        blocks=[
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": message}
            }
        ]
    )
```

### 5. Multi-Environment Configuration

```json
{
  "environments": {
    "development": {
      "enabled_features": ["all"],
      "report_format": "json",
      "send_alerts": false
    },
    "staging": {
      "enabled_features": ["security", "dependencies"],
      "report_format": "html",
      "send_alerts": "warning"
    },
    "production": {
      "enabled_features": ["security"],
      "report_format": "slack",
      "send_alerts": "critical",
      "block_on_critical": true
    }
  }
}
```

---

## Summary

| Use Case | Frequency | Team Size | Setup Time | ROI |
|----------|-----------|-----------|-----------|-----|
| Legacy Security Audit | One-time | Any | 30 min | Very High |
| Pre-Commit Gates | Per commit | 1-20 | 1 hour | High |
| CI/CD Pipeline | Per PR | Any | 2 hours | Very High |
| Code Review | Per PR | 5+ | 30 min | High |
| Migration Planning | Project phase | 5+ | 1 hour | Very High |
| Tech Debt Tracking | Monthly | Any | 30 min | Medium |
| Knowledge Base | Project | 10+ | 2 hours | High |

---

## Next Steps

1. Choose a use case that matches your needs
2. Follow the step-by-step workflow
3. Customize for your environment
4. Schedule regular runs
5. Integrate with your existing tools
6. Share results with your team

For questions or additional use cases, see [README.md](../README.md) or [FAQ.md](FAQ.md).
