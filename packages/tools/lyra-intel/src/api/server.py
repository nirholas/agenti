"""
API Server - REST API for the intelligence engine.

Provides endpoints for:
- Repository analysis
- Query operations
- Search functionality
- Report generation
- Real-time status updates
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Callable
from pathlib import Path
from datetime import datetime
import http.server
import socketserver
import urllib.parse
import threading

logger = logging.getLogger(__name__)


@dataclass
class APIConfig:
    """Configuration for API server."""
    host: str = "127.0.0.1"  # Default to localhost for security
    port: int = 8000
    debug: bool = False
    cors_origins: List[str] = field(default_factory=lambda: ["*"])
    max_request_size: int = 100 * 1024 * 1024  # 100MB
    rate_limit: int = 100  # requests per minute
    api_key: Optional[str] = None  # Optional API key for authentication


class RequestHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler with routing support."""
    
    routes: Dict[str, Dict[str, Callable]] = {}
    server_instance: 'APIServer' = None
    
    def log_message(self, format, *args):
        """Override to use our logger."""
        logger.info(f"{self.address_string()} - {format % args}")
    
    def send_json_response(self, data: Any, status: int = 200):
        """Send JSON response."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        
        response = json.dumps(data, indent=2, default=str)
        self.wfile.write(response.encode())
    
    def send_error_response(self, message: str, status: int = 400):
        """Send error response."""
        self.send_json_response({"error": message, "status": status}, status)
    
    def get_request_body(self) -> Dict[str, Any]:
        """Parse JSON request body."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            body = self.rfile.read(content_length)
            return json.loads(body.decode())
        return {}
    
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        self._handle_request("GET")
    
    def do_POST(self):
        """Handle POST requests."""
        self._handle_request("POST")
    
    def do_PUT(self):
        """Handle PUT requests."""
        self._handle_request("PUT")
    
    def do_DELETE(self):
        """Handle DELETE requests."""
        self._handle_request("DELETE")
    
    def _handle_request(self, method: str):
        """Route request to handler."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        
        # Find matching route
        handler = None
        path_params = {}
        
        for route_path, methods in self.routes.items():
            if method in methods:
                # Check for exact match
                if route_path == path:
                    handler = methods[method]
                    break
                
                # Check for pattern match (e.g., /repos/{id})
                route_parts = route_path.split("/")
                path_parts = path.split("/")
                
                if len(route_parts) == len(path_parts):
                    match = True
                    for rp, pp in zip(route_parts, path_parts):
                        if rp.startswith("{") and rp.endswith("}"):
                            param_name = rp[1:-1]
                            path_params[param_name] = pp
                        elif rp != pp:
                            match = False
                            break
                    
                    if match:
                        handler = methods[method]
                        break
        
        if handler:
            try:
                body = self.get_request_body() if method in ("POST", "PUT") else {}
                result = handler(
                    server=self.server_instance,
                    path_params=path_params,
                    query_params=query,
                    body=body,
                )
                self.send_json_response(result)
            except Exception as e:
                logger.error(f"Request error: {e}")
                self.send_error_response(str(e), 500)
        else:
            self.send_error_response(f"Not found: {path}", 404)


class APIServer:
    """
    REST API server for Lyra Intel.
    
    Endpoints:
    - GET /health - Health check
    - GET /status - System status
    - POST /analyze - Start analysis
    - GET /analysis/{id} - Get analysis status
    - POST /query - Query codebase
    - POST /search - Search code
    - GET /reports/{id} - Get report
    """
    
    def __init__(self, config: Optional[APIConfig] = None):
        self.config = config or APIConfig()
        self._server = None
        self._thread = None
        self._analyses: Dict[str, Dict] = {}
        self._engine = None
        
        # Register routes
        self._register_routes()
    
    def _register_routes(self):
        """Register API routes."""
        RequestHandler.routes = {
            "/health": {"GET": self._health},
            "/status": {"GET": self._status},
            "/api/v1/analyze": {"POST": self._start_analysis},
            "/api/v1/analysis/{id}": {"GET": self._get_analysis},
            "/api/v1/repositories": {"GET": self._list_repositories, "POST": self._add_repository},
            "/api/v1/repositories/{id}": {"GET": self._get_repository, "DELETE": self._delete_repository},
            "/api/v1/query": {"POST": self._query},
            "/api/v1/search": {"POST": self._search},
            "/api/v1/reports": {"GET": self._list_reports, "POST": self._generate_report},
            "/api/v1/reports/{id}": {"GET": self._get_report},
            "/api/v1/patterns": {"GET": self._list_patterns},
            "/api/v1/dependencies": {"GET": self._get_dependencies},
            "/api/v1/metrics": {"GET": self._get_metrics},
        }
        RequestHandler.server_instance = self
    
    def start(self, blocking: bool = True):
        """Start the API server."""
        logger.info(f"Starting API server on {self.config.host}:{self.config.port}")
        
        self._server = socketserver.TCPServer(
            (self.config.host, self.config.port),
            RequestHandler
        )
        
        if blocking:
            self._server.serve_forever()
        else:
            self._thread = threading.Thread(target=self._server.serve_forever)
            self._thread.daemon = True
            self._thread.start()
            logger.info("API server started in background")
    
    def stop(self):
        """Stop the API server."""
        if self._server:
            self._server.shutdown()
            logger.info("API server stopped")
    
    # Route handlers
    
    def _health(self, **kwargs) -> Dict[str, Any]:
        """Health check endpoint."""
        return {"status": "healthy", "timestamp": datetime.now().isoformat()}
    
    def _status(self, **kwargs) -> Dict[str, Any]:
        """System status endpoint."""
        return {
            "version": "0.1.0",
            "status": "running",
            "components": {
                "api": "healthy",
                "storage": "healthy",
                "analyzers": "healthy",
                "collectors": "healthy",
            },
            "active_analyses": len(self._analyses),
            "timestamp": datetime.now().isoformat(),
        }
    
    def _start_analysis(self, body: Dict, **kwargs) -> Dict[str, Any]:
        """Start a new analysis."""
        repo_path = body.get("repository_path")
        if not repo_path:
            raise ValueError("repository_path is required")
        
        analysis_id = f"analysis_{len(self._analyses) + 1}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        self._analyses[analysis_id] = {
            "id": analysis_id,
            "repository_path": repo_path,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "progress": 0,
            "results": None,
        }
        
        # Would start async analysis here
        
        return {"analysis_id": analysis_id, "status": "started"}
    
    def _get_analysis(self, path_params: Dict, **kwargs) -> Dict[str, Any]:
        """Get analysis status."""
        analysis_id = path_params.get("id")
        
        if analysis_id not in self._analyses:
            raise ValueError(f"Analysis not found: {analysis_id}")
        
        return self._analyses[analysis_id]
    
    def _list_repositories(self, **kwargs) -> Dict[str, Any]:
        """List analyzed repositories."""
        return {"repositories": [], "total": 0}
    
    def _add_repository(self, body: Dict, **kwargs) -> Dict[str, Any]:
        """Add a repository for analysis."""
        return {"status": "added", "repository": body}
    
    def _get_repository(self, path_params: Dict, **kwargs) -> Dict[str, Any]:
        """Get repository details."""
        return {"id": path_params.get("id"), "status": "not_found"}
    
    def _delete_repository(self, path_params: Dict, **kwargs) -> Dict[str, Any]:
        """Delete a repository."""
        return {"status": "deleted", "id": path_params.get("id")}
    
    def _query(self, body: Dict, **kwargs) -> Dict[str, Any]:
        """Query the codebase."""
        query = body.get("query", "")
        return {
            "query": query,
            "results": [],
            "total": 0,
            "execution_time_ms": 0,
        }
    
    def _search(self, body: Dict, **kwargs) -> Dict[str, Any]:
        """Search code."""
        query = body.get("query", "")
        return {
            "query": query,
            "results": [],
            "total": 0,
        }
    
    def _list_reports(self, **kwargs) -> Dict[str, Any]:
        """List generated reports."""
        return {"reports": [], "total": 0}
    
    def _generate_report(self, body: Dict, **kwargs) -> Dict[str, Any]:
        """Generate a new report."""
        return {"status": "generating", "report_id": "report_1"}
    
    def _get_report(self, path_params: Dict, **kwargs) -> Dict[str, Any]:
        """Get a specific report."""
        return {"id": path_params.get("id"), "status": "not_found"}
    
    def _list_patterns(self, query_params: Dict, **kwargs) -> Dict[str, Any]:
        """List detected patterns."""
        return {"patterns": [], "total": 0}
    
    def _get_dependencies(self, query_params: Dict, **kwargs) -> Dict[str, Any]:
        """Get dependency graph."""
        return {"nodes": [], "edges": [], "total_nodes": 0, "total_edges": 0}
    
    def _get_metrics(self, **kwargs) -> Dict[str, Any]:
        """Get codebase metrics."""
        return {
            "total_files": 0,
            "total_lines": 0,
            "total_functions": 0,
            "total_classes": 0,
            "languages": {},
        }
