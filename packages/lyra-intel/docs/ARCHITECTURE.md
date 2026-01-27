# Lyra Intel - Architecture Documentation

Complete technical architecture and design documentation.

## Table of Contents

- [System Overview](#system-overview)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Module Architecture](#module-architecture)
- [Extension Points](#extension-points)
- [Deployment Architecture](#deployment-architecture)
- [Performance & Scalability](#performance--scalability)
- [Security Architecture](#security-architecture)

---

## System Overview

Lyra Intel is a modular, scalable code intelligence platform built with:

- **Core Engine**: Python 3.9+ with asyncio for high performance
- **Analyzers**: Pluggable AST-based code analyzers
- **Storage**: Multi-backend support (Redis, PostgreSQL, S3)
- **API Layer**: FastAPI for REST/WebSocket endpoints
- **Frontend**: React 18 + TypeScript dashboard
- **Extensions**: VS Code and JetBrains IDE plugins

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   CLI    │  │   Web    │  │ VS Code  │  │JetBrains │   │
│  │          │  │Dashboard │  │Extension │  │  Plugin  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼────────────┼─────────────┼─────────────┼───────────┘
        │            │             │             │
        └────────────┴─────────────┴─────────────┘
                     │
        ┌────────────▼────────────────────────────────────────┐
        │           API Layer (FastAPI)                       │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
        │  │   REST   │  │WebSocket │  │   Auth   │         │
        │  │   API    │  │  Server  │  │(SSO/JWT) │         │
        │  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
        └───────┼─────────────┼─────────────┼────────────────┘
                │             │             │
        ┌───────▼─────────────▼─────────────▼────────────────┐
        │          Core Engine (LyraIntelEngine)             │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
        │  │Analyzer  │  │ Semantic │  │  Plugin  │         │
        │  │  Pool    │  │  Search  │  │  Manager │         │
        │  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
        └───────┼─────────────┼─────────────┼────────────────┘
                │             │             │
        ┌───────▼─────────────▼─────────────▼────────────────┐
        │              Analyzer Layer                         │
        │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
        │  │ AST  │ │ C++  │ │  C#  │ │ Ruby │ │ PHP  │    │
        │  │Parser│ │Parser│ │Parser│ │Parser│ │Parser│    │
        │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘    │
        └─────┼────────┼────────┼────────┼────────┼──────────┘
              │        │        │        │        │
        ┌─────▼────────▼────────▼────────▼────────▼──────────┐
        │              Storage Layer                          │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
        │  │  Redis   │  │PostgreSQL│  │   S3     │         │
        │  │  Cache   │  │   DB     │  │ Storage  │         │
        │  └──────────┘  └──────────┘  └──────────┘         │
        └─────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Engine (`src/core/engine.py`)

The central orchestrator for all analysis operations.

```python
class LyraIntelEngine:
    """
    Main analysis engine that coordinates:
    - File collection and crawling
    - AST parsing and analysis
    - Security scanning
    - Metrics calculation
    - Result aggregation
    """
    
    async def analyze_repository(path: str) -> Dict:
        # 1. Collect files
        # 2. Parse ASTs
        # 3. Run analyzers
        # 4. Aggregate results
        # 5. Cache results
```

**Key responsibilities:**
- Manage analyzer lifecycle
- Coordinate async operations
- Handle caching and storage
- Emit progress events

### 2. Analyzers (`src/analyzers/`)

Modular code analyzers for different languages and purposes.

```
analyzers/
├── ast_analyzer.py      # Python AST analysis
├── cpp_parser.py        # C++ parsing
├── csharp_parser.py     # C# parsing
├── ruby_parser.py       # Ruby parsing
├── php_parser.py        # PHP parsing
├── dependency_mapper.py # Dependency analysis
└── pattern_detector.py  # Pattern matching
```

**Analyzer Interface:**

```python
class BaseAnalyzer:
    def analyze(self, code: str, file_path: str, language: str) -> Dict:
        """Analyze code and return findings."""
        pass
```

### 3. Semantic Search (`src/search/semantic_search.py`)

ML-powered code search using sentence transformers.

```python
class SemanticSearch:
    """
    Vector-based semantic code search:
    - Embeddings: sentence-transformers/all-MiniLM-L6-v2
    - Vector DB: FAISS for fast retrieval
    - Fallback: TF-IDF for non-ML environments
    """
```

**Components:**
- **Encoder**: Converts code to embeddings
- **Index**: FAISS vector database
- **Retriever**: Similarity search with filtering

### 4. Plugin System (`src/plugins/`)

Extensible plugin architecture for custom analyzers and exporters.

```python
# Plugin types
- AnalyzerPlugin: Custom code analyzers
- ReportPlugin: Custom report generators
- IntegrationPlugin: External tool integrations
```

**Plugin Lifecycle:**
1. Registration
2. Validation
3. Initialization
4. Execution
5. Result collection

### 5. API Layer (`src/api/`)

FastAPI-based REST and WebSocket API.

```
api/
├── server.py          # Main server
├── routes.py          # Endpoint definitions
└── enhanced_server.py # Advanced features
```

**Endpoints:**
- `POST /api/v1/analyze` - Start analysis
- `GET /api/v1/analyses/{id}` - Get results
- `WS /ws` - WebSocket streaming
- `GET /metrics` - Prometheus metrics

### 6. Storage Layer (`src/storage/`)

Multi-backend storage abstraction.

```python
class StorageBackend(ABC):
    def store(key: str, value: Any)
    def retrieve(key: str) -> Any
    def delete(key: str)
```

**Supported backends:**
- **Redis**: Fast caching, pub/sub
- **PostgreSQL**: Structured data, complex queries
- **S3**: Large file storage
- **Local**: Development/testing

---

## Data Flow

### Analysis Pipeline

```
1. Input
   └─> File path or Git URL

2. Collection
   └─> FileCrawler scans directory
   └─> GitCollector clones repository
   └─> Filter by language/pattern

3. Parsing
   └─> AST parsers extract structure
   └─> Language-specific parsers
   └─> Build code units

4. Analysis
   └─> Security scanner
   └─> Complexity calculator
   └─> Dependency mapper
   └─> Pattern detector

5. Indexing
   └─> Semantic search indexing
   └─> Cache storage
   └─> Database persistence

6. Output
   └─> JSON results
   └─> PDF/SARIF/Excel export
   └─> WebSocket streaming
   └─> API response
```

### Real-time Streaming Flow

```
Client          WebSocket Server        Engine
  │                    │                   │
  │─── Connect ───────>│                   │
  │                    │                   │
  │─ Subscribe(id) ───>│                   │
  │                    │                   │
  │                    │<── Analyze() ─────│
  │                    │                   │
  │<── Progress(10%) ──│<── Progress ──────│
  │                    │                   │
  │<── Issue Found ────│<── Issue ─────────│
  │                    │                   │
  │<── Progress(50%) ──│<── Progress ──────│
  │                    │                   │
  │<── Complete ───────│<── Complete ──────│
  │                    │                   │
```

---

## Module Architecture

### Collectors Module (`src/collectors/`)

```python
# File system collector
FileCrawler:
  - scan_directory()
  - filter_files()
  - read_content()

# Git repository collector
GitCollector:
  - clone_repository()
  - get_commits()
  - get_file_history()
```

### Security Module (`src/security/`)

```python
SecurityScanner:
  - scan_secrets()         # API keys, passwords
  - scan_vulnerabilities() # SQL injection, XSS
  - scan_dependencies()    # Known CVEs
  - generate_sarif()       # SARIF 2.1.0 output
```

### Metrics Module (`src/metrics/`)

```python
MetricsCalculator:
  - complexity()          # Cyclomatic complexity
  - maintainability()     # Maintainability index
  - test_coverage()       # Code coverage %
  - code_smells()         # Anti-patterns
```

### Export Module (`src/export/`)

```python
Exporters:
  - PDFExporter          # ReportLab PDF
  - SARIFExporter        # OASIS SARIF 2.1.0
  - ExcelExporter        # openpyxl multi-sheet
  - CSVExporter          # Pandas CSV
  - JSONExporter         # Standard JSON
```

### Monitoring Module (`src/monitoring/`)

```python
PrometheusMetrics:
  - track_request()
  - track_analysis()
  - track_cache()
  - track_error()

HealthChecker:
  - register_check()
  - run_checks()
  - get_status()
```

---

## Extension Points

### 1. Custom Analyzers

```python
from src.plugins.plugin_base import AnalyzerPlugin

class MyAnalyzer(AnalyzerPlugin):
    def analyze(self, code, language, **kwargs):
        # Custom analysis logic
        return {"issues": [...]}
```

### 2. Custom Exporters

```python
from src.plugins.plugin_base import ReportPlugin

class MyExporter(ReportPlugin):
    def generate_report(self, results, **kwargs):
        # Custom export format
        return formatted_output
```

### 3. Custom Storage Backends

```python
from src.storage.backends import StorageBackend

class MyStorage(StorageBackend):
    def store(self, key, value):
        # Custom storage logic
        pass
```

### 4. Custom Language Parsers

```python
from src.analyzers.base import BaseParser

class MyLanguageParser(BaseParser):
    def parse(self, code):
        # Custom parsing logic
        return ast_data
```

---

## Deployment Architecture

### Single Server Deployment

```
┌─────────────────────────────────┐
│      Server (Docker)            │
│  ┌─────────────────────────┐   │
│  │   Lyra Intel App        │   │
│  │   (FastAPI + Engine)    │   │
│  └───────────┬─────────────┘   │
│              │                  │
│  ┌───────────▼─────────────┐   │
│  │      Redis Cache        │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

### Kubernetes Deployment

```
┌─────────────────────────────────────────────────────┐
│               Kubernetes Cluster                    │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Ingress   │  │  Service    │  │   HPA      │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┘ │
│         │                │                         │
│  ┌──────▼────────────────▼──────┐                 │
│  │     API Pods (3 replicas)    │                 │
│  │  ┌────────┐ ┌────────┐       │                 │
│  │  │  Pod 1 │ │  Pod 2 │ ...   │                 │
│  │  └────────┘ └────────┘       │                 │
│  └──────────────┬────────────────┘                 │
│                 │                                  │
│  ┌──────────────▼────────────────┐                 │
│  │    Redis StatefulSet          │                 │
│  └───────────────────────────────┘                 │
│                                                     │
│  ┌───────────────────────────────┐                 │
│  │  PostgreSQL StatefulSet       │                 │
│  └───────────────────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

### AWS Deployment (Terraform)

```
VPC
├── Public Subnets
│   └── Application Load Balancer
│       └── ECS Service (Fargate)
│           ├── API Tasks (auto-scaling)
│           └── Worker Tasks
│
├── Private Subnets
│   ├── ElastiCache (Redis)
│   ├── RDS (PostgreSQL)
│   └── S3 (Storage)
│
└── Security Groups
    ├── ALB Security Group
    ├── ECS Security Group
    └── RDS Security Group
```

---

## Performance & Scalability

### Concurrency Model

```python
# Async I/O with asyncio
async def analyze_files(files):
    tasks = [analyze_file(f) for f in files]
    results = await asyncio.gather(*tasks)
    return results
```

**Benefits:**
- Non-blocking I/O
- Efficient resource usage
- Handles 1000+ concurrent operations

### Caching Strategy

```
L1: In-memory cache (LRU, 1000 items)
  └─> Hit: Return cached result
  └─> Miss: Check L2

L2: Redis cache (TTL: 1 hour)
  └─> Hit: Return cached result
  └─> Miss: Analyze and cache

Analysis: Fresh analysis
  └─> Cache in L1 and L2
```

### Horizontal Scaling

```
Load Balancer
  │
  ├─> Worker 1 (analyze files 1-100)
  ├─> Worker 2 (analyze files 101-200)
  └─> Worker 3 (analyze files 201-300)
        │
        └─> Shared Redis cache
        └─> Shared PostgreSQL
```

### Performance Targets

- **File analysis**: 50-100 files/second
- **API response**: < 200ms (p95)
- **WebSocket latency**: < 50ms
- **Semantic search**: < 100ms for 10K code units

---

## Security Architecture

### Authentication Flow

```
Client
  └─> Request with Bearer token
       │
       ├─> JWT validation
       │   └─> Verify signature
       │   └─> Check expiration
       │   └─> Extract claims
       │
       └─> SSO integration
           ├─> OAuth 2.0 / OIDC
           ├─> SAML 2.0
           └─> LDAP
```

### Authorization (RBAC)

```python
Roles:
  - Admin: Full access
  - Developer: Read + Analyze
  - Viewer: Read-only

Permissions:
  - analyze:create
  - analyze:read
  - analyze:delete
  - settings:write
```

### Data Security

- **At Rest**: AES-256 encryption
- **In Transit**: TLS 1.3
- **Secrets**: Environment variables, AWS Secrets Manager
- **API Keys**: Hashed with bcrypt

### Security Scanning

```python
SecurityScanner:
  - Detect hardcoded secrets
  - SQL injection patterns
  - XSS vulnerabilities
  - Insecure deserialization
  - Path traversal
  - Command injection
```

---

## Technology Stack

### Backend

- **Language**: Python 3.9+
- **Framework**: FastAPI
- **Async**: asyncio, aiohttp
- **Parsing**: ast, tree-sitter
- **ML**: sentence-transformers, scikit-learn
- **Storage**: Redis, PostgreSQL, S3

### Frontend

- **Framework**: React 18
- **Language**: TypeScript
- **UI**: Material-UI (MUI)
- **State**: React Context API
- **HTTP**: Axios
- **Build**: Vite

### Infrastructure

- **Containers**: Docker, Docker Compose
- **Orchestration**: Kubernetes, Helm
- **IaC**: Terraform
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus, Grafana

### IDE Extensions

- **VS Code**: TypeScript, VS Code API
- **JetBrains**: Java, IntelliJ Platform SDK

---

## Development Workflow

```
1. Local Development
   └─> docker-compose up
   └─> FastAPI auto-reload
   └─> React HMR

2. Testing
   └─> pytest (unit tests)
   └─> pytest-cov (coverage)
   └─> mypy (type checking)

3. CI Pipeline
   └─> Lint (ruff, black)
   └─> Type check (mypy)
   └─> Test (pytest)
   └─> Build (Docker)

4. Deployment
   └─> Tag release
   └─> Build images
   └─> Deploy to K8s/ECS
   └─> Run smoke tests
```

---

For implementation details, see [FEATURES.md](FEATURES.md) and [EXAMPLES.md](EXAMPLES.md).
contact [nich on Github](github.com/nirholas) | [nich on X](x.com/nichxbt)

