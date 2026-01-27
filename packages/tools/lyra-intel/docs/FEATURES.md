# Complete Feature Documentation

Comprehensive guide to all features in Lyra Intel.

## Table of Contents

- [Semantic Search](#semantic-search)
- [SSO Integration](#sso-integration)
- [Language Parsers](#language-parsers)
- [Plugin System](#plugin-system)
- [IDE Extensions](#ide-extensions)
- [CI/CD Integrations](#cicd-integrations)
- [Export Formats](#export-formats)
- [WebSocket Streaming](#websocket-streaming)
- [Interactive CLI](#interactive-cli)
- [Web Dashboard](#web-dashboard)
- [Monitoring & Metrics](#monitoring--metrics)

---

## Semantic Search

AI-powered semantic code search using ML embeddings.

### Features

- **ML-Based Search** - Uses sentence-transformers for semantic understanding
- **Fast Retrieval** - FAISS vector database for sub-second searches
- **Intelligent Fallback** - Falls back to TF-IDF if ML models unavailable
- **Multi-Language** - Works across Python, TypeScript, JavaScript, Go, Rust, Java

### Basic Usage

```python
from src.search.semantic_search import SemanticSearch

# Initialize search
search = SemanticSearch()

# Index your codebase
code_units = [
    {
        "file_path": "auth/login.py",
        "name": "authenticate_user",
        "type": "function",
        "docstring": "Authenticate user with username and password",
        "line_start": 10,
        "line_end": 25
    }
]

files = {
    "auth/login.py": "def authenticate_user(username, password): ..."
}

search.index_code(code_units, files)

# Search
results = search.search("user login authentication")

for result in results:
    print(f"File: {result.file_path}")
    print(f"Function: {result.name}")
    print(f"Score: {result.score:.2f}")
    print(f"Code: {result.code}")
```

### Advanced Search

```python
# Search with filters
results = search.search(
    query="database connection",
    min_score=0.5,
    max_results=10,
    file_pattern="*.py"
)

# Search specific types
results = search.search_by_type(
    query="error handling",
    code_type="function"
)

# Get similar code
similar = search.find_similar(
    reference_code="def fetch_data(): ...",
    threshold=0.7
)
```

### Configuration

```python
# Custom model
search = SemanticSearch(
    model_name="sentence-transformers/all-mpnet-base-v2",
    use_faiss=True,
    cache_dir="~/.lyra-intel/models"
)

# Disable ML (use TF-IDF only)
search = SemanticSearch(use_ml=False)
```

---

## SSO Integration

Enterprise single sign-on with OAuth 2.0, SAML 2.0, and LDAP.

### OAuth 2.0 / OIDC

```python
from src.enterprise.sso_integration import OAuth2Provider

# Configure provider
oauth = OAuth2Provider(
    client_id="your-client-id",
    client_secret="your-client-secret",
    authorization_endpoint="https://auth.example.com/oauth/authorize",
    token_endpoint="https://auth.example.com/oauth/token",
    userinfo_endpoint="https://auth.example.com/oauth/userinfo"
)

# Get authorization URL
auth_url, state = oauth.get_authorization_url(
    redirect_uri="https://yourapp.com/callback"
)
print(f"Redirect user to: {auth_url}")

# Exchange code for token
session = oauth.exchange_code(
    code="authorization_code",
    redirect_uri="https://yourapp.com/callback"
)

print(f"Access Token: {session.access_token}")
print(f"User: {session.user_email}")
```

### SAML 2.0

```python
from src.enterprise.sso_integration import SAMLProvider

# Configure SAML
saml = SAMLProvider(
    entity_id="https://yourapp.com",
    sso_url="https://idp.example.com/sso",
    x509_cert="""-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKL...
-----END CERTIFICATE-----"""
)

# Generate SAML request
auth_url, request_id = saml.get_authorization_url(
    redirect_uri="https://yourapp.com/acs"
)

# Validate SAML response
session = saml.validate_response(
    saml_response="base64_encoded_response",
    request_id=request_id
)

print(f"Authenticated: {session.user_email}")
```

### LDAP

```python
from src.enterprise.sso_integration import LDAPProvider

# Configure LDAP
ldap = LDAPProvider(
    server="ldap://ldap.example.com:389",
    base_dn="dc=example,dc=com",
    bind_dn="cn=admin,dc=example,dc=com",
    bind_password="admin_password"
)

# Authenticate user
session = ldap.authenticate(
    username="john.doe",
    password="user_password"
)

if session:
    print(f"User authenticated: {session.user_email}")
    print(f"Groups: {session.groups}")
```

### Using SSO in API Server

```python
from fastapi import FastAPI, Depends
from src.enterprise.sso_integration import OAuth2Provider, get_current_user

app = FastAPI()
oauth = OAuth2Provider(...)

@app.get("/protected")
async def protected_route(user=Depends(get_current_user)):
    return {"user": user.email, "message": "Access granted"}
```

---

## Language Parsers

Specialized parsers for C++, C#, Ruby, and PHP.

### C++ Parser

```python
from src.analyzers.cpp_parser import CppParser

parser = CppParser()

cpp_code = '''
#include <iostream>
#include <vector>

namespace myapp {
    template<typename T>
    class Container {
    private:
        std::vector<T> items;
    
    public:
        virtual void add(T item) {
            items.push_back(item);
        }
        
        T get(int index) const {
            return items[index];
        }
    };
}
'''

result = parser.parse(cpp_code)

print(f"Classes: {result['classes']}")
print(f"Functions: {result['functions']}")
print(f"Includes: {result['includes']}")
print(f"Namespaces: {result['namespaces']}")
print(f"Metrics: {result['metrics']}")

# Output:
# Classes: [{'name': 'Container', 'is_template': True, 'bases': [], ...}]
# Functions: [...]
# Includes: ['iostream', 'vector']
# Namespaces: ['myapp']
# Metrics: {'total_classes': 1, 'template_classes': 1, ...}
```

### C# Parser

```python
from src.analyzers.csharp_parser import CSharpParser

parser = CSharpParser()

csharp_code = '''
using System;
using System.Threading.Tasks;

namespace MyApp.Services {
    public class UserService : IUserService {
        public string Name { get; set; }
        private int _count;
        
        public async Task<User> GetUserAsync(int id) {
            return await _repository.FindAsync(id);
        }
        
        public void UpdateCount() {
            _count++;
        }
    }
}
'''

result = parser.parse(csharp_code)

for cls in result['classes']:
    print(f"Class: {cls['namespace']}.{cls['name']}")
    print(f"Base: {cls['base_class']}")
    print(f"Interfaces: {cls['interfaces']}")
    print(f"Properties: {[p['name'] for p in cls['properties']]}")
    print(f"Methods: {[m['name'] for m in cls['methods']]}")
    print(f"Async methods: {sum(1 for m in cls['methods'] if m['is_async'])}")
```

### Ruby Parser

```python
from src.analyzers.ruby_parser import RubyParser

parser = RubyParser()

ruby_code = '''
require 'json'

module Authentication
  def authenticate(token)
    verify_token(token)
  end
end

class User
  include Authentication
  
  attr_accessor :name, :email
  
  def initialize(name, email)
    @name = name
    @email = email
  end
  
  def self.find(id)
    # class method
  end
  
  private
  
  def verify_token(token)
    # private method
  end
end
'''

result = parser.parse(ruby_code)

print(f"Modules: {len(result['modules'])}")
print(f"Classes: {len(result['classes'])}")

for cls in result['classes']:
    print(f"\nClass: {cls['name']}")
    print(f"Parent: {cls['parent']}")
    print(f"Mixins: {cls['modules']}")
    print(f"Methods: {len(cls['methods'])}")
    for method in cls['methods']:
        print(f"  - {method['name']} ({method['visibility']})")
```

### PHP Parser

```python
from src.analyzers.php_parser import PhpParser

parser = PhpParser()

php_code = '''
<?php
namespace App\\Services;

use App\\Models\\User;
use App\\Traits\\Cacheable;

abstract class BaseService {
    use Cacheable;
    
    protected $repository;
    
    abstract public function find(int $id): ?User;
}

final class UserService extends BaseService {
    public function find(int $id): ?User {
        return $this->cache->get("user.$id");
    }
    
    public static function create(array $data): User {
        return new User($data);
    }
}
'''

result = parser.parse(php_code)

for cls in result['classes']:
    print(f"Class: {cls['namespace']}.{cls['name']}")
    print(f"Abstract: {cls['is_abstract']}")
    print(f"Final: {cls['is_final']}")
    print(f"Parent: {cls['parent']}")
    print(f"Traits: {cls['traits']}")
    print(f"Methods: {len(cls['methods'])}")
```

---

## Plugin System

Extensible plugin architecture for custom analyzers and exporters.

### Creating a Custom Analyzer Plugin

```python
from src.plugins.plugin_base import AnalyzerPlugin
from typing import Dict, Any

class MyCustomAnalyzer(AnalyzerPlugin):
    """Custom code analyzer."""
    
    def get_name(self) -> str:
        return "my-analyzer"
    
    def get_version(self) -> str:
        return "1.0.0"
    
    def get_description(self) -> str:
        return "My custom code analyzer"
    
    def analyze(self, code: str, language: str, **kwargs) -> Dict[str, Any]:
        """Analyze code and return results."""
        issues = []
        
        # Custom analysis logic
        if "TODO" in code:
            issues.append({
                "type": "todo_found",
                "severity": "low",
                "message": "TODO comment found"
            })
        
        return {
            "plugin": self.get_name(),
            "issues": issues,
            "metrics": {
                "todo_count": code.count("TODO")
            }
        }
```

### Using Plugins

```python
from src.plugins.plugin_manager import PluginManager
from my_plugin import MyCustomAnalyzer

# Initialize plugin manager
manager = PluginManager()

# Register plugin
plugin = MyCustomAnalyzer()
manager.register_plugin(plugin)

# List available plugins
plugins = manager.list_plugins()
print(f"Available plugins: {plugins}")

# Run specific plugin
result = manager.run_plugin("my-analyzer", code, language="python")
print(result)

# Run all plugins
results = manager.run_all_plugins(code, language="python")
```

### Built-in Example Plugins

```python
from src.plugins.example_plugins import (
    CodeQualityPlugin,
    MetricsCollectorPlugin,
    JSONReportPlugin,
    HTMLReportPlugin
)

# Code quality analysis
quality = CodeQualityPlugin()
result = quality.analyze(code, "python")
print(f"Quality score: {result['quality_score']}")
print(f"Issues: {result['issues']}")

# Metrics collection
metrics = MetricsCollectorPlugin()
result = metrics.analyze(code, "python")
print(f"LOC: {result['loc']}")
print(f"Complexity: {result['complexity']}")
print(f"Maintainability: {result['maintainability']}")
```

### Creating Report Plugins

```python
from src.plugins.plugin_base import ReportPlugin

class MarkdownReportPlugin(ReportPlugin):
    """Generate Markdown reports."""
    
    def get_name(self) -> str:
        return "markdown-report"
    
    def get_version(self) -> str:
        return "1.0.0"
    
    def get_description(self) -> str:
        return "Generate Markdown format reports"
    
    def generate_report(self, analysis_results: Dict[str, Any], **kwargs) -> str:
        """Generate markdown report."""
        md = "# Analysis Report\n\n"
        md += f"**Total Issues:** {len(analysis_results.get('issues', []))}\n\n"
        
        for issue in analysis_results.get('issues', []):
            md += f"- **{issue['severity']}**: {issue['message']}\n"
        
        return md
    
    def get_supported_formats(self) -> list:
        return ["markdown", "md"]
```

---

## IDE Extensions

### VS Code Extension

**Installation:**

```bash
cd extensions/vscode
npm install
npm run compile
vsce package
code --install-extension lyra-intel-vscode-1.0.0.vsix
```

**Configuration** (settings.json):

```json
{
  "lyraIntel.serverUrl": "http://localhost:8080",
  "lyraIntel.apiKey": "your-api-key",
  "lyraIntel.autoAnalyze": false,
  "lyraIntel.showInlineHints": true,
  "lyraIntel.securityScanOnSave": true
}
```

**Usage:**

- `Ctrl+Shift+A` (Windows/Linux) or `Cmd+Shift+A` (Mac) - Analyze current file
- `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac) - Security scan
- Right-click in editor → "Lyra Intel: Analyze Current File"
- Command Palette → "Lyra Intel: Analyze Workspace"

**Features:**

```typescript
// Programmatic usage from extension
import { LyraIntelClient } from './client';

const client = new LyraIntelClient(
    'http://localhost:8080',
    'your-api-key'
);

// Analyze file
const result = await client.analyzeFile(
    filePath,
    fileContent
);

// Security scan
const findings = await client.securityScan(
    filePath,
    fileContent
);

// Display inline warnings
findings.forEach(finding => {
    const diagnostic = new vscode.Diagnostic(
        new vscode.Range(finding.line, 0, finding.line, 1000),
        finding.description,
        vscode.DiagnosticSeverity.Warning
    );
    diagnosticCollection.set(document.uri, [diagnostic]);
});
```

### JetBrains Plugin

**Installation:**

1. Open IntelliJ IDEA / PyCharm / WebStorm
2. Go to Settings → Plugins → ⚙️ → Install Plugin from Disk
3. Select `lyra-intel-jetbrains.jar`
4. Restart IDE

**Configuration:**

```
Settings → Tools → Lyra Intel
  Server URL: http://localhost:8080
  API Key: your-api-key
  Auto-analyze: false
```

**Usage:**

- Right-click file → "Analyze with Lyra Intel"
- Tools → Lyra Intel → Analyze Project
- Tools → Lyra Intel → Security Scan

**Features:**

```java
// Integration from plugin
LyraIntelClient client = new LyraIntelClient(
    "http://localhost:8080",
    "your-api-key"
);

// Analyze current file
AnalysisResult result = client.analyzeFile(
    filePath,
    fileContent
);

// Show results in tool window
LyraIntelToolWindow toolWindow = project.getService(LyraIntelToolWindow.class);
toolWindow.displayResults(result);
```

---

## CI/CD Integrations

### GitLab Integration

```python
from src.integrations.gitlab_integration import GitLabIntegration

# Initialize
gitlab = GitLabIntegration(
    gitlab_url="https://gitlab.com",
    access_token="glpat-your-token",
    project_id="12345"
)

# Create issue for findings
gitlab.create_issue(
    title="Security vulnerabilities found",
    description="Found 5 critical security issues...",
    labels=["security", "critical"]
)

# Comment on merge request
gitlab.comment_on_merge_request(
    mr_iid=42,
    comment="## Lyra Intel Analysis\n\n✅ No security issues found"
)

# Add inline comment
gitlab.comment_on_merge_request(
    mr_iid=42,
    comment="⚠️ Hardcoded secret detected",
    line=15,
    file_path="src/config.py"
)

# Post full analysis results
from src.core.engine import LyraIntelEngine

engine = LyraIntelEngine()
results = await engine.analyze_repository("/path/to/repo")

gitlab.post_analysis_results(
    mr_iid=42,
    results=results
)
```

### Bitbucket Integration

```python
from src.integrations.bitbucket_integration import BitbucketIntegration

# Initialize
bitbucket = BitbucketIntegration(
    workspace="myworkspace",
    repo_slug="myrepo",
    username="myuser",
    app_password="app-password"
)

# Create issue
bitbucket.create_issue(
    title="Code quality issues",
    content="Found 10 code quality issues...",
    kind="bug",  # bug, enhancement, proposal, task
    priority="major"  # trivial, minor, major, critical, blocker
)

# Comment on pull request
bitbucket.comment_on_pull_request(
    pr_id=123,
    comment="✅ Analysis passed"
)

# Inline comment
bitbucket.comment_on_pull_request(
    pr_id=123,
    comment="⚠️ SQL injection vulnerability",
    inline={"path": "api/users.py", "line": 45}
)

# Create build status
bitbucket.create_build_status(
    commit_hash="abc123",
    state="SUCCESSFUL",  # INPROGRESS, SUCCESSFUL, FAILED
    key="lyra-intel",
    name="Lyra Intel Analysis",
    url="https://dashboard.example.com/analysis/123"
)

# Post analysis
bitbucket.post_analysis_results(pr_id=123, results=results)
```

### GitHub Actions Integration

```yaml
# .github/workflows/lyra-intel.yml
name: Lyra Intel Analysis

on:
  pull_request:
    branches: [main]
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
          pip install lyra-intel
      
      - name: Run Analysis
        run: |
          lyra-intel analyze . --output analysis.json
          
      - name: Security Scan
        run: |
          lyra-intel security-scan . --output security.json
          
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: analysis-results
          path: |
            analysis.json
            security.json
      
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('analysis.json'));
            const issues = results.security?.findings || [];
            
            const comment = `## Lyra Intel Analysis
            
**Total Issues:** ${issues.length}
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

---

## Export Formats

### PDF Export

```python
from src.export.enhanced_formats import PDFExporter

exporter = PDFExporter()

results = {
    "project_name": "My Project",
    "files": [...],
    "issues": [...],
    "metrics": {
        "complexity": 7.5,
        "maintainability": 82.3,
        "coverage": 85.0
    }
}

# Generate PDF
pdf_path = exporter.export(results, "analysis_report.pdf")
print(f"PDF saved to: {pdf_path}")
```

### SARIF Export

```python
from src.export.enhanced_formats import SARIFExporter

exporter = SARIFExporter()

# Export to SARIF 2.1.0 format
sarif_path = exporter.export(results, "analysis.sarif")

# Upload to GitHub Code Scanning
import requests

with open(sarif_path, 'rb') as f:
    requests.post(
        f"https://api.github.com/repos/{owner}/{repo}/code-scanning/sarifs",
        headers={"Authorization": f"token {github_token}"},
        json={"commit_sha": commit_sha, "ref": ref, "sarif": f.read().decode()}
    )
```

### CSV Export

```python
from src.export.enhanced_formats import CSVExporter

exporter = CSVExporter()

# Export issues to CSV
csv_path = exporter.export(results, "issues.csv")

# Export metrics to CSV
metrics_path = exporter.export_metrics(results, "metrics.csv")
```

### Excel Export

```python
from src.export.enhanced_formats import ExcelExporter

exporter = ExcelExporter()

# Creates multi-sheet Excel with:
# - Summary sheet
# - Issues sheet
# - Metrics sheet
# - Files sheet
excel_path = exporter.export(results, "analysis_report.xlsx")
```

---

## WebSocket Streaming

Real-time analysis progress streaming via WebSocket.

### Server Setup

```python
from src.realtime.websocket_server import WebSocketAnalysisServer
import asyncio

async def main():
    server = WebSocketAnalysisServer(host="0.0.0.0", port=8765)
    await server.start()
    
    # Keep running
    await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
```

### Client Usage (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
    // Subscribe to analysis session
    ws.send(JSON.stringify({
        command: 'subscribe',
        session_id: 'analysis-123'
    }));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'start':
            console.log(`Analysis started: ${data.data.total_files} files`);
            break;
            
        case 'progress':
            console.log(`Progress: ${data.progress}% - ${data.file}`);
            updateProgressBar(data.progress);
            break;
            
        case 'issue':
            console.log(`Issue found: ${data.data.message}`);
            addIssueToUI(data.data);
            break;
            
        case 'complete':
            console.log('Analysis complete!');
            displayResults(data.data);
            break;
            
        case 'error':
            console.error(`Error: ${data.message}`);
            break;
    }
};
```

### Python Client

```python
import asyncio
import websockets
import json

async def monitor_analysis(session_id):
    uri = "ws://localhost:8765"
    
    async with websockets.connect(uri) as websocket:
        # Subscribe
        await websocket.send(json.dumps({
            "command": "subscribe",
            "session_id": session_id
        }))
        
        # Receive updates
        async for message in websocket:
            data = json.loads(message)
            
            if data['type'] == 'progress':
                print(f"Progress: {data['progress']:.1f}%")
            elif data['type'] == 'issue':
                print(f"Issue: {data['data']['message']}")
            elif data['type'] == 'complete':
                print("Analysis complete!")
                break

asyncio.run(monitor_analysis("analysis-123"))
```

### Streaming Analyzer

```python
from src.realtime.websocket_server import WebSocketAnalysisServer, StreamingAnalyzer
from src.core.engine import LyraIntelEngine

# Start WebSocket server
ws_server = WebSocketAnalysisServer()
await ws_server.start()

# Create streaming analyzer
streaming = StreamingAnalyzer(ws_server)

# Run analysis with real-time updates
engine = LyraIntelEngine()
session_id = "analysis-123"
files = ["file1.py", "file2.py", "file3.py"]

results = await streaming.analyze_with_streaming(
    session_id=session_id,
    files=files,
    analyzer=engine
)
```

---

## Interactive CLI

Rich terminal interface with colors, progress bars, and tables.

### Basic Commands

```bash
# Interactive analysis
lyra-intel analyze /path/to/repo --interactive

# Security scan with auto-fix
lyra-intel security /path/to/repo --fix

# Explain code with AI
lyra-intel explain path/to/file.py

# Show project tree
lyra-intel tree /path/to/repo

# Launch dashboard
lyra-intel dashboard
```

### Python API

```python
from src.cli.interactive import cli

# Programmatic usage
from click.testing import CliRunner

runner = CliRunner()
result = runner.invoke(cli, ['analyze', '/path/to/repo', '-i'])
print(result.output)
```

### Custom CLI Commands

```python
import click
from rich.console import Console
from rich.table import Table

console = Console()

@click.command()
@click.argument('path')
def my_command(path):
    """Custom CLI command."""
    
    # Create fancy table
    table = Table(title="Analysis Results")
    table.add_column("File", style="cyan")
    table.add_column("Issues", style="magenta")
    
    table.add_row("file1.py", "5")
    table.add_row("file2.py", "2")
    
    console.print(table)
```

---

## Web Dashboard

Modern React dashboard with Material-UI.

### Setup & Installation

```bash
cd src/web/dashboard

# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build
npm run preview
```

### Configuration

Create `.env.local`:

```env
VITE_API_URL=http://localhost:8080/api/v1
```

### Features

- **Dashboard Overview** - Metrics, charts, recent analyses
- **Projects View** - Manage and analyze projects
- **Analysis View** - Detailed analysis results
- **Security View** - Security vulnerabilities dashboard
- **Settings** - Configure API connection and preferences

### API Integration

```typescript
// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export const api = {
  // Dashboard stats
  getDashboardStats: async () => {
    const response = await axios.get(`${API_BASE_URL}/dashboard/stats`);
    return response.data;
  },
  
  // Analyses
  getAnalyses: async (params) => {
    const response = await axios.get(`${API_BASE_URL}/analyses`, { params });
    return response.data;
  },
  
  createAnalysis: async (data) => {
    const response = await axios.post(`${API_BASE_URL}/analyze`, data);
    return response.data;
  }
};
```

### Custom Components

```tsx
// Custom metric card
import { MetricCard } from './components/MetricCard';
import { BugReport } from '@mui/icons-material';

<MetricCard
  title="Total Issues"
  value={stats.total_issues}
  icon={<BugReport />}
  color="#ef4444"
  subtitle="+12% from last week"
/>
```

---

## Monitoring & Metrics

### Prometheus Metrics

**Enable metrics:**

```python
from src.monitoring.prometheus_metrics import get_metrics_collector

# Initialize metrics
collector = get_metrics_collector()

# Track request
collector.track_request(
    method="POST",
    endpoint="/analyze",
    status=200,
    duration=1.5
)

# Track analysis
collector.track_analysis(
    analyzer_type="security",
    status="success",
    duration=5.2
)

# Track file analyzed
collector.track_file_analyzed(language="python")

# Track cache
collector.track_cache(cache_type="ast", hit=True)

# Track AI request
collector.track_ai_request(
    provider="openai",
    status="success",
    input_tokens=150,
    output_tokens=200
)

# Track error
collector.track_error(
    error_type="ValueError",
    component="ast_analyzer"
)
```

**Expose metrics endpoint:**

```python
from fastapi import FastAPI
from src.monitoring.prometheus_metrics import get_metrics_collector

app = FastAPI()

@app.get("/metrics")
async def metrics():
    collector = get_metrics_collector()
    return Response(
        content=collector.get_metrics(),
        media_type="text/plain"
    )
```

**Decorator for automatic tracking:**

```python
from src.monitoring.prometheus_metrics import track_time

@track_time("security_scanner")
async def scan_code(code: str):
    # Automatically tracks duration and status
    return await scanner.scan(code)
```

### Grafana Dashboards

**Import dashboards:**

```python
from src.monitoring.grafana_dashboards import (
    DASHBOARD_API_OVERVIEW,
    DASHBOARD_ANALYSIS,
    DASHBOARD_AI_PROVIDERS
)
import requests

# Import to Grafana
grafana_url = "http://localhost:3000"
api_key = "your-grafana-api-key"

for dashboard in [DASHBOARD_API_OVERVIEW, DASHBOARD_ANALYSIS, DASHBOARD_AI_PROVIDERS]:
    response = requests.post(
        f"{grafana_url}/api/dashboards/db",
        headers={"Authorization": f"Bearer {api_key}"},
        json=dashboard
    )
    print(f"Imported: {dashboard['dashboard']['title']}")
```

**Available dashboards:**

1. **API Overview** - Request rate, duration, errors, active analyses
2. **Analysis Metrics** - Analysis rate by type, duration, file counts, cache hit rate
3. **AI Providers** - AI request rate, token usage, error rate

### Health Checks

```python
from src.monitoring.prometheus_metrics import get_health_checker

health = get_health_checker()

# Register health checks
health.register_check("database", lambda: db.is_connected())
health.register_check("redis", lambda: redis.ping())
health.register_check("api", lambda: requests.get("http://localhost:8080/health").ok)

# Run checks
status = health.run_checks()

print(f"Healthy: {status['healthy']}")
for name, check in status['checks'].items():
    print(f"{name}: {check['status']}")
```

### Structured Logging

```python
from src.monitoring.prometheus_metrics import StructuredLogger

logger = StructuredLogger(__name__)

# Set context
logger.set_context(
    user_id="12345",
    request_id="abc-123",
    environment="production"
)

# Log with context
logger.info("User logged in", action="login", success=True)
logger.error("Database error", error_type="ConnectionError", retry_count=3)

# Clear context
logger.clear_context()
```

---

## Complete Example: End-to-End Workflow

```python
import asyncio
from src.core.engine import LyraIntelEngine, EngineConfig
from src.search.semantic_search import SemanticSearch
from src.integrations.gitlab_integration import GitLabIntegration
from src.export.enhanced_formats import PDFExporter, SARIFExporter
from src.monitoring.prometheus_metrics import get_metrics_collector

async def full_analysis_workflow():
    # 1. Initialize engine
    engine = LyraIntelEngine(EngineConfig())
    
    # 2. Run analysis
    results = await engine.analyze_repository("/path/to/repo")
    
    # 3. Index for semantic search
    search = SemanticSearch()
    search.index_code(results['code_units'], results['files'])
    
    # 4. Search for patterns
    auth_code = search.search("authentication and authorization")
    
    # 5. Export results
    pdf = PDFExporter()
    pdf.export(results, "report.pdf")
    
    sarif = SARIFExporter()
    sarif.export(results, "security.sarif")
    
    # 6. Post to GitLab
    gitlab = GitLabIntegration(...)
    gitlab.post_analysis_results(mr_iid=42, results=results)
    
    # 7. Track metrics
    metrics = get_metrics_collector()
    metrics.track_analysis("full_workflow", "success", 45.2)
    
    return results

# Run workflow
results = asyncio.run(full_analysis_workflow())
```

---

For more examples, see the `/examples` directory or visit the [GitHub repository](https://github.com/nirholas/lyra-intel).

contact [nich on Github](github.com/nirholas) | [nich on X](x.com/nichxbt)

