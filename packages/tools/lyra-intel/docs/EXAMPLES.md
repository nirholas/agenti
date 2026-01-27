# Lyra Intel - Complete Code Examples

Practical working examples for every feature in Lyra Intel.

## Table of Contents

- [Quick Start](#quick-start)
- [Core Analysis](#core-analysis)
- [Semantic Search](#semantic-search)
- [SSO Integration](#sso-integration)
- [Language Parsers](#language-parsers)
- [Plugins](#plugins)
- [IDE Extensions](#ide-extensions)
- [CI/CD Integration](#cicd-integration)
- [Export Formats](#export-formats)
- [WebSocket Streaming](#websocket-streaming)
- [CLI Usage](#cli-usage)
- [Web Dashboard](#web-dashboard)
- [Monitoring](#monitoring)
- [Advanced Workflows](#advanced-workflows)

---

## Quick Start

### Installation

```bash
# Install from source
git clone https://github.com/nirholas/lyra-intel.git
cd lyra-intel
pip install -e .

# Or install via pip (when published)
pip install lyra-intel
```

### 60-Second Analysis

```python
import asyncio
from src.core.engine import LyraIntelEngine

async def quick_analysis():
    engine = LyraIntelEngine()
    results = await engine.analyze_repository("/path/to/your/project")
    
    print(f"Files analyzed: {len(results['files'])}")
    print(f"Issues found: {len(results['issues'])}")
    print(f"Security findings: {len(results['security']['findings'])}")
    
    return results

results = asyncio.run(quick_analysis())
```

### Command Line

```bash
# Analyze a repository
lyra-intel analyze /path/to/repo --output report.json

# Security scan
lyra-intel security-scan /path/to/repo --fix

# Generate PDF report
lyra-intel analyze /path/to/repo --export pdf --output report.pdf

# Launch dashboard
lyra-intel dashboard
```

---

## Core Analysis

### Analyzing a Single File

```python
import asyncio
from src.core.engine import LyraIntelEngine, EngineConfig

async def analyze_file():
    config = EngineConfig(
        enable_ai=True,
        enable_security=True,
        enable_metrics=True
    )
    engine = LyraIntelEngine(config)
    
    with open('example.py', 'r') as f:
        code = f.read()
    
    result = await engine.analyze_code(code, 'example.py', 'python')
    
    print(f"\n=== Analysis Results ===")
    print(f"Issues found: {len(result.get('issues', []))}")
    
    for issue in result['issues']:
        print(f"\n[{issue['severity'].upper()}] Line {issue['line']}")
        print(f"  {issue['message']}")
        if 'suggestion' in issue:
            print(f"  Suggestion: {issue['suggestion']}")
    
    if 'metrics' in result:
        m = result['metrics']
        print(f"\n=== Metrics ===")
        print(f"Complexity: {m.get('complexity', 0):.1f}")
        print(f"Maintainability: {m.get('maintainability', 0):.1f}")
        print(f"Test Coverage: {m.get('coverage', 0):.1f}%")

asyncio.run(analyze_file())
```

### Analyzing an Entire Repository

```python
import asyncio
from src.core.engine import LyraIntelEngine

async def analyze_repository():
    engine = LyraIntelEngine()
    
    # Analyze with progress callback
    def on_progress(current, total, file_path):
        percent = (current / total) * 100
        print(f"Progress: {percent:.1f}% - Analyzing {file_path}")
    
    results = await engine.analyze_repository(
        "/path/to/repo",
        progress_callback=on_progress
    )
    
    # Group issues by severity
    critical = [i for i in results['issues'] if i['severity'] == 'critical']
    high = [i for i in results['issues'] if i['severity'] == 'high']
    medium = [i for i in results['issues'] if i['severity'] == 'medium']
    low = [i for i in results['issues'] if i['severity'] == 'low']
    
    print(f"\n=== Summary ===")
    print(f"Total files: {len(results['files'])}")
    print(f"Critical issues: {len(critical)}")
    print(f"High issues: {len(high)}")
    print(f"Medium issues: {len(medium)}")
    print(f"Low issues: {len(low)}")
    
    # Security findings
    security = results.get('security', {})
    findings = security.get('findings', [])
    print(f"\nSecurity vulnerabilities: {len(findings)}")
    
    return results

results = asyncio.run(analyze_repository())
```

---

## Semantic Search

### Basic Semantic Search

```python
from src.search.semantic_search import SemanticSearch

# Initialize
search = SemanticSearch()

# Index codebase
code_units = [
    {
        "file_path": "auth/login.py",
        "name": "authenticate_user",
        "type": "function",
        "docstring": "Authenticate user with username and password",
        "code": "def authenticate_user(username, password): ...",
        "line_start": 10,
        "line_end": 25
    }
]

files = {"auth/login.py": "# login code..."}
search.index_code(code_units, files)

# Search
results = search.search("user authentication")

for result in results:
    print(f"Score: {result.score:.2f}")
    print(f"File: {result.file_path}")
    print(f"Function: {result.name}")
```

---

## SSO Integration

### OAuth 2.0 Setup

```python
from src.enterprise.sso_integration import OAuth2Provider
from fastapi import FastAPI
from fastapi.responses import RedirectResponse

app = FastAPI()

oauth = OAuth2Provider(
    client_id="your-client-id",
    client_secret="your-client-secret",
    authorization_endpoint="https://accounts.google.com/o/oauth2/v2/auth",
    token_endpoint="https://oauth2.googleapis.com/token",
    userinfo_endpoint="https://openidconnect.googleapis.com/v1/userinfo",
    scope="openid email profile"
)

@app.get("/login")
async def login():
    auth_url, state = oauth.get_authorization_url(
        redirect_uri="http://localhost:8080/callback"
    )
    return RedirectResponse(url=auth_url)

@app.get("/callback")
async def callback(code: str):
    session = oauth.exchange_code(
        code=code,
        redirect_uri="http://localhost:8080/callback"
    )
    return {"user": session.user_email}
```

---

## Language Parsers

### C++ Parser

```python
from src.analyzers.cpp_parser import CppParser

parser = CppParser()
cpp_code = '''
#include <iostream>
template<typename T>
class Container {
    void add(T item) {}
};
'''

result = parser.parse(cpp_code)
print(f"Classes: {result['classes']}")
print(f"Includes: {result['includes']}")
```

### C# Parser

```python
from src.analyzers.csharp_parser import CSharpParser

parser = CSharpParser()
csharp_code = '''
using System.Threading.Tasks;
public class UserService {
    public async Task<User> GetUserAsync(int id) {
        return await _repository.FindAsync(id);
    }
}
'''

result = parser.parse(csharp_code)
for cls in result['classes']:
    print(f"Class: {cls['name']}")
    for method in cls['methods']:
        if method['is_async']:
            print(f"  Async method: {method['name']}")
```

---

## Plugins

### Creating a Custom Plugin

```python
from src.plugins.plugin_base import AnalyzerPlugin

class MyAnalyzer(AnalyzerPlugin):
    def get_name(self) -> str:
        return "my-analyzer"
    
    def analyze(self, code: str, language: str, **kwargs):
        issues = []
        if "TODO" in code:
            issues.append({
                "type": "todo_found",
                "message": "TODO comment found"
            })
        return {"issues": issues}

# Use plugin
from src.plugins.plugin_manager import PluginManager

manager = PluginManager()
manager.register_plugin(MyAnalyzer())
result = manager.run_plugin("my-analyzer", code, language="python")
```

---

## CI/CD Integration

### GitLab Integration

```python
from src.integrations.gitlab_integration import GitLabIntegration

gitlab = GitLabIntegration(
    gitlab_url="https://gitlab.com",
    access_token="glpat-your-token",
    project_id="12345"
)

# Comment on merge request
gitlab.comment_on_merge_request(
    mr_iid=42,
    comment="✅ No security issues found"
)

# Create issue
gitlab.create_issue(
    title="Security vulnerabilities found",
    description="Found 5 critical issues...",
    labels=["security", "critical"]
)
```

### Bitbucket Integration

```python
from src.integrations.bitbucket_integration import BitbucketIntegration

bitbucket = BitbucketIntegration(
    workspace="myworkspace",
    repo_slug="myrepo",
    username="myuser",
    app_password="app-password"
)

# Comment on PR
bitbucket.comment_on_pull_request(
    pr_id=123,
    comment="✅ Analysis passed"
)

# Create build status
bitbucket.create_build_status(
    commit_hash="abc123",
    state="SUCCESSFUL",
    key="lyra-intel",
    name="Lyra Intel Analysis"
)
```

---

## Export Formats

### PDF Export

```python
from src.export.enhanced_formats import PDFExporter

exporter = PDFExporter()
pdf_path = exporter.export(results, "report.pdf")
print(f"PDF saved to: {pdf_path}")
```

### SARIF Export

```python
from src.export.enhanced_formats import SARIFExporter

exporter = SARIFExporter()
sarif_path = exporter.export(results, "analysis.sarif")
```

### Excel Export

```python
from src.export.enhanced_formats import ExcelExporter

exporter = ExcelExporter()
excel_path = exporter.export(results, "report.xlsx")
```

---

## WebSocket Streaming

### Server

```python
from src.realtime.websocket_server import WebSocketAnalysisServer
import asyncio

async def main():
    server = WebSocketAnalysisServer(host="0.0.0.0", port=8765)
    await server.start()
    await asyncio.Future()

asyncio.run(main())
```

### Client (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'progress') {
        console.log(`Progress: ${data.progress}%`);
    }
};
```

---

## CLI Usage

```bash
# Interactive analysis
lyra-intel analyze /path/to/repo --interactive

# Security scan with auto-fix
lyra-intel security /path/to/repo --fix

# Explain code with AI
lyra-intel explain path/to/file.py

# Launch dashboard
lyra-intel dashboard
```

---

## Web Dashboard

```bash
cd src/web/dashboard
npm install
npm run dev
```

Configure `.env.local`:
```
VITE_API_URL=http://localhost:8080/api/v1
```

---

## Monitoring

### Prometheus Metrics

```python
from src.monitoring.prometheus_metrics import get_metrics_collector

collector = get_metrics_collector()

# Track request
collector.track_request(
    method="POST",
    endpoint="/analyze",
    status=200,
    duration=1.5
)

# Get metrics
print(collector.get_metrics())
```

### Health Checks

```python
from src.monitoring.prometheus_metrics import get_health_checker

health = get_health_checker()
health.register_check("database", lambda: db.is_connected())
status = health.run_checks()
print(f"Healthy: {status['healthy']}")
```

---

## Advanced Workflows

### Complete End-to-End Pipeline

```python
import asyncio
from src.core.engine import LyraIntelEngine
from src.search.semantic_search import SemanticSearch
from src.integrations.gitlab_integration import GitLabIntegration
from src.export.enhanced_formats import PDFExporter, SARIFExporter
from src.monitoring.prometheus_metrics import get_metrics_collector

async def full_pipeline():
    # 1. Analyze
    engine = LyraIntelEngine()
    results = await engine.analyze_repository("/path/to/repo")
    
    # 2. Index for search
    search = SemanticSearch()
    search.index_code(results['code_units'], results['files'])
    
    # 3. Export reports
    pdf = PDFExporter()
    pdf.export(results, "report.pdf")
    
    sarif = SARIFExporter()
    sarif.export(results, "security.sarif")
    
    # 4. Post to GitLab
    gitlab = GitLabIntegration(...)
    gitlab.post_analysis_results(mr_iid=42, results=results)
    
    # 5. Track metrics
    metrics = get_metrics_collector()
    metrics.track_analysis("full_workflow", "success", 45.2)
    
    return results

asyncio.run(full_pipeline())
```

---

For more details, see [FEATURES.md](FEATURES.md) and [API.md](API.md).
contact [nich on Github](github.com/nirholas) | [nich on X](x.com/nichxbt)

