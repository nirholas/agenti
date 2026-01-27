# Lyra Intel - Complete Tutorial

Step-by-step tutorials for common use cases.

## Table of Contents

- [Tutorial 1: First Analysis](#tutorial-1-first-analysis)
- [Tutorial 2: Security Audit](#tutorial-2-security-audit)
- [Tutorial 3: Setting Up Semantic Search](#tutorial-3-setting-up-semantic-search)
- [Tutorial 4: CI/CD Integration](#tutorial-4-cicd-integration)
- [Tutorial 5: Custom Plugin Development](#tutorial-5-custom-plugin-development)
- [Tutorial 6: Production Deployment](#tutorial-6-production-deployment)
- [Tutorial 7: Real-time Dashboard](#tutorial-7-real-time-dashboard)

---

## Tutorial 1: First Analysis

**Goal**: Analyze your first codebase and generate a report.

### Step 1: Installation

```bash
git clone https://github.com/nirholas/lyra-intel.git
cd lyra-intel
pip install -e .
```

### Step 2: Create Analysis Script

Create `my_first_analysis.py`:

```python
import asyncio
from src.core.engine import LyraIntelEngine

async def analyze():
    # Initialize engine
    engine = LyraIntelEngine()
    
    # Analyze repository
    print("Starting analysis...")
    results = await engine.analyze_repository("/path/to/your/repo")
    
    # Print summary
    print(f"\n✅ Analysis Complete!")
    print(f"Files analyzed: {len(results['files'])}")
    print(f"Total issues: {len(results['issues'])}")
    print(f"Security findings: {len(results['security']['findings'])}")
    
    # Print top issues
    print(f"\n🔴 Top Issues:")
    for issue in results['issues'][:5]:
        print(f"  - {issue['file']}:{issue['line']} - {issue['message']}")
    
    return results

if __name__ == "__main__":
    results = asyncio.run(analyze())
```

### Step 3: Run Analysis

```bash
python my_first_analysis.py
```

### Step 4: Export Report

```python
from src.export.enhanced_formats import PDFExporter

# Generate PDF
pdf = PDFExporter()
pdf.export(results, "my_report.pdf")
print("PDF report saved to: my_report.pdf")
```

**✅ Success!** You've completed your first analysis.

---

## Tutorial 2: Security Audit

**Goal**: Perform a comprehensive security audit of a codebase.

### Step 1: Run Security Scan

```python
import asyncio
from src.core.engine import LyraIntelEngine, EngineConfig

async def security_audit():
    # Configure for security focus
    config = EngineConfig(
        enable_security=True,
        enable_dependency_scan=True,
        security_level="strict"
    )
    
    engine = LyraIntelEngine(config)
    results = await engine.analyze_repository("/path/to/repo")
    
    # Extract security findings
    security = results['security']
    findings = security['findings']
    
    # Group by severity
    critical = [f for f in findings if f['severity'] == 'critical']
    high = [f for f in findings if f['severity'] == 'high']
    medium = [f for f in findings if f['severity'] == 'medium']
    
    print(f"\n🔐 Security Audit Results:")
    print(f"Critical: {len(critical)}")
    print(f"High: {len(high)}")
    print(f"Medium: {len(medium)}")
    
    # Show critical issues
    if critical:
        print(f"\n🚨 Critical Issues:")
        for finding in critical:
            print(f"\n  File: {finding['file']}:{finding['line']}")
            print(f"  Type: {finding['type']}")
            print(f"  Description: {finding['description']}")
            print(f"  Fix: {finding.get('fix_suggestion', 'N/A')}")
    
    return results

results = asyncio.run(security_audit())
```

### Step 2: Export SARIF for GitHub

```python
from src.export.enhanced_formats import SARIFExporter

sarif = SARIFExporter()
sarif.export(results, "security.sarif")

# Upload to GitHub Code Scanning
import subprocess
subprocess.run([
    "gh", "api",
    f"/repos/OWNER/REPO/code-scanning/sarifs",
    "-f", "sarif=@security.sarif",
    "-f", f"commit_sha={commit_sha}",
    "-f", f"ref={ref}"
])
```

### Step 3: Generate Security Report

```python
from src.export.enhanced_formats import PDFExporter

pdf = PDFExporter()
pdf.export(results, "security_audit.pdf")

print("✅ Security audit complete!")
print("📄 PDF report: security_audit.pdf")
print("📊 SARIF output: security.sarif")
```

---

## Tutorial 3: Setting Up Semantic Search

**Goal**: Create a searchable code index for your repository.

### Step 1: Analyze and Index

```python
import asyncio
from src.core.engine import LyraIntelEngine
from src.search.semantic_search import SemanticSearch

async def setup_search():
    # Step 1: Analyze codebase
    print("Analyzing codebase...")
    engine = LyraIntelEngine()
    results = await engine.analyze_repository("/path/to/repo")
    
    # Step 2: Initialize semantic search
    print("Initializing semantic search...")
    search = SemanticSearch()
    
    # Step 3: Index code
    print("Indexing code units...")
    search.index_code(results['code_units'], results['files'])
    
    # Step 4: Save index
    search.save_index("code_index.pkl")
    
    print("✅ Search index created!")
    return search

search = asyncio.run(setup_search())
```

### Step 2: Search Your Code

```python
from src.search.semantic_search import SemanticSearch

# Load index
search = SemanticSearch()
search.load_index("code_index.pkl")

# Search for authentication code
results = search.search("user authentication and login")

print(f"Found {len(results)} results:")
for i, result in enumerate(results[:5], 1):
    print(f"\n{i}. {result.file_path}:{result.line_start}")
    print(f"   Function: {result.name}")
    print(f"   Score: {result.score:.2f}")
    print(f"   {result.docstring[:100]}...")
```

### Step 3: Find Similar Code

```python
# Find code similar to a reference
reference = """
def process_payment(amount, currency):
    if amount <= 0:
        raise ValueError("Invalid amount")
    return payment_gateway.charge(amount, currency)
"""

similar = search.find_similar(reference, threshold=0.7)

print(f"Found {len(similar)} similar code blocks:")
for s in similar:
    print(f"  - {s.file_path}:{s.line_start} (similarity: {s.score:.2f})")
```

---

## Tutorial 4: CI/CD Integration

**Goal**: Integrate Lyra Intel into your CI/CD pipeline.

### Step 1: GitHub Actions Setup

Create `.github/workflows/lyra-intel.yml`:

```yaml
name: Lyra Intel Analysis

on:
  pull_request:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install Lyra Intel
        run: |
          git clone https://github.com/nirholas/lyra-intel.git
          cd lyra-intel
          pip install -e .
      
      - name: Run Analysis
        run: |
          python -m src.cli analyze . --output analysis.json
      
      - name: Security Scan
        run: |
          python -m src.cli security-scan . --output security.sarif
      
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: security.sarif
      
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('analysis.json'));
            const issues = results.issues || [];
            
            const comment = `## 🔍 Lyra Intel Analysis
            
**Files Analyzed:** ${results.files?.length || 0}
**Issues Found:** ${issues.length}
**Critical:** ${issues.filter(i => i.severity === 'critical').length}
**High:** ${issues.filter(i => i.severity === 'high').length}
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### Step 2: GitLab CI Integration

Create `.gitlab-ci.yml`:

```yaml
lyra_intel:
  image: python:3.11
  script:
    - pip install lyra-intel
    - lyra-intel analyze . --output analysis.json
    - lyra-intel security-scan . --output security.json
  artifacts:
    reports:
      codequality: analysis.json
    paths:
      - analysis.json
      - security.json
```

### Step 3: Add MR Comments (GitLab)

```python
# .gitlab/lyra_comment.py
import json
import os
from src.integrations.gitlab_integration import GitLabIntegration

gitlab = GitLabIntegration(
    gitlab_url=os.getenv('CI_SERVER_URL'),
    access_token=os.getenv('GITLAB_TOKEN'),
    project_id=os.getenv('CI_PROJECT_ID')
)

with open('analysis.json') as f:
    results = json.load(f)

mr_iid = os.getenv('CI_MERGE_REQUEST_IID')
if mr_iid:
    gitlab.post_analysis_results(int(mr_iid), results)
```

---

## Tutorial 5: Custom Plugin Development

**Goal**: Create a custom analyzer plugin.

### Step 1: Create Plugin

Create `my_plugin.py`:

```python
from src.plugins.plugin_base import AnalyzerPlugin
from typing import Dict, Any
import re

class TodoTracker(AnalyzerPlugin):
    """Track TODO comments and technical debt."""
    
    def get_name(self) -> str:
        return "todo-tracker"
    
    def get_version(self) -> str:
        return "1.0.0"
    
    def get_description(self) -> str:
        return "Tracks TODO, FIXME, and HACK comments"
    
    def analyze(self, code: str, language: str, **kwargs) -> Dict[str, Any]:
        issues = []
        
        # Find TODO patterns
        patterns = {
            'TODO': r'#\s*TODO:?\s*(.+)',
            'FIXME': r'#\s*FIXME:?\s*(.+)',
            'HACK': r'#\s*HACK:?\s*(.+)',
        }
        
        for line_num, line in enumerate(code.split('\n'), 1):
            for tag, pattern in patterns.items():
                match = re.search(pattern, line)
                if match:
                    issues.append({
                        'type': f'{tag.lower()}_found',
                        'severity': 'low' if tag == 'TODO' else 'medium',
                        'line': line_num,
                        'message': f'{tag}: {match.group(1).strip()}',
                        'tag': tag
                    })
        
        return {
            'plugin': self.get_name(),
            'issues': issues,
            'metrics': {
                'todo_count': len([i for i in issues if i['tag'] == 'TODO']),
                'fixme_count': len([i for i in issues if i['tag'] == 'FIXME']),
                'hack_count': len([i for i in issues if i['tag'] == 'HACK']),
            }
        }
```

### Step 2: Register and Use Plugin

```python
from src.plugins.plugin_manager import PluginManager
from my_plugin import TodoTracker

# Register plugin
manager = PluginManager()
manager.register_plugin(TodoTracker())

# Use plugin
code = """
# TODO: Implement caching
def fetch_data():
    # FIXME: This is inefficient
    return slow_query()
"""

result = manager.run_plugin("todo-tracker", code, language="python")

print(f"Found {len(result['issues'])} items:")
for issue in result['issues']:
    print(f"  Line {issue['line']}: {issue['message']}")

print(f"\nMetrics:")
for key, value in result['metrics'].items():
    print(f"  {key}: {value}")
```

### Step 3: Integrate with Engine

```python
from src.core.engine import LyraIntelEngine

engine = LyraIntelEngine()
engine.register_plugin(TodoTracker())

results = await engine.analyze_repository("/path/to/repo")

# Plugin results included in output
plugin_results = results.get('plugins', {}).get('todo-tracker', {})
print(f"Technical debt items: {len(plugin_results['issues'])}")
```

---

## Tutorial 6: Production Deployment

**Goal**: Deploy Lyra Intel to production on Kubernetes.

### Step 1: Build Docker Image

```bash
# Build image
docker build -t lyra-intel:1.0.0 .

# Test locally
docker run -p 8080:8080 lyra-intel:1.0.0
```

### Step 2: Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace lyra-intel

# Deploy using Helm
helm install lyra-intel ./deploy/helm \
  --namespace lyra-intel \
  --set image.tag=1.0.0 \
  --set ingress.enabled=true \
  --set ingress.host=lyra.example.com

# Check status
kubectl get pods -n lyra-intel
```

### Step 3: Configure Environment

Create `values-production.yaml`:

```yaml
replicaCount: 3

image:
  repository: lyra-intel
  tag: "1.0.0"

env:
  - name: REDIS_URL
    value: "redis://redis:6379"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: lyra-secrets
        key: database-url

ingress:
  enabled: true
  host: lyra.example.com
  tls:
    - secretName: lyra-tls
      hosts:
        - lyra.example.com

resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

Deploy:

```bash
helm upgrade lyra-intel ./deploy/helm \
  -f values-production.yaml \
  --namespace lyra-intel
```

### Step 4: Setup Monitoring

```bash
# Install Prometheus
helm install prometheus prometheus-community/prometheus \
  --namespace monitoring

# Install Grafana
helm install grafana grafana/grafana \
  --namespace monitoring

# Import Lyra Intel dashboards
kubectl apply -f deploy/monitoring/dashboards/
```

---

## Tutorial 7: Real-time Dashboard

**Goal**: Set up the web dashboard with real-time analysis streaming.

### Step 1: Start Backend

```bash
# Start API server with WebSocket support
python src/api/server.py
```

### Step 2: Start Frontend

```bash
cd src/web/dashboard
npm install
npm run dev
```

### Step 3: Configure Connection

Create `src/web/dashboard/.env.local`:

```env
VITE_API_URL=http://localhost:8080/api/v1
VITE_WS_URL=ws://localhost:8080/ws
```

### Step 4: Start Analysis with Streaming

```python
import asyncio
from src.realtime.websocket_server import WebSocketAnalysisServer, StreamingAnalyzer
from src.core.engine import LyraIntelEngine

async def stream_analysis():
    # Start WebSocket server
    ws_server = WebSocketAnalysisServer(port=8765)
    await ws_server.start()
    
    # Create streaming analyzer
    streaming = StreamingAnalyzer(ws_server)
    engine = LyraIntelEngine()
    
    # Run analysis with real-time updates
    session_id = "analysis-123"
    results = await streaming.analyze_with_streaming(
        session_id=session_id,
        repo_path="/path/to/repo",
        analyzer=engine
    )
    
    return results

asyncio.run(stream_analysis())
```

### Step 5: View Dashboard

Open browser to `http://localhost:5173`

- Dashboard shows real-time progress
- Issues appear as they're found
- Metrics update live
- Charts animate with new data

---

## Next Steps

- Read [FEATURES.md](FEATURES.md) for detailed feature documentation
- See [EXAMPLES.md](EXAMPLES.md) for more code examples
- Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Review [API.md](API.md) for complete API reference

---

Need help? Open an issue on [GitHub](https://github.com/nirholas/lyra-intel/issues).
contact [nich on Github](github.com/nirholas) | [nich on X](x.com/nichxbt)

