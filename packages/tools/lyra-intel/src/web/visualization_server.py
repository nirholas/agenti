"""
Visualization Server - Serves interactive dashboards via HTTP.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Optional
import threading
import http.server
import socketserver
import hashlib

logger = logging.getLogger(__name__)


@dataclass
class ServerConfig:
    """Visualization server configuration."""
    host: str = "127.0.0.1"
    port: int = 3000
    static_dir: Optional[Path] = None
    cors_enabled: bool = True
    auto_reload: bool = True


class VisualizationServer:
    """
    HTTP server for serving interactive visualizations.
    
    Serves:
    - Main dashboard HTML
    - Static assets (JS, CSS)
    - WebSocket for live updates
    - REST API for data queries
    """
    
    def __init__(self, config: Optional[ServerConfig] = None):
        self.config = config or ServerConfig()
        self._httpd = None
        self._thread = None
        self._running = False
        self._dashboard_data: Dict[str, Any] = {}
        self._routes: Dict[str, Callable] = {}
        
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup default routes."""
        self._routes = {
            "/": self._handle_index,
            "/api/data": self._handle_data,
            "/api/search": self._handle_search,
            "/api/graph": self._handle_graph,
            "/health": self._handle_health,
        }
    
    def set_dashboard_data(self, data: Dict[str, Any]):
        """Set the dashboard data to serve."""
        self._dashboard_data = data
    
    def add_route(self, path: str, handler: Callable):
        """Add a custom route handler."""
        self._routes[path] = handler
    
    def _handle_index(self, path: str, query: Dict) -> tuple:
        """Handle index page request."""
        from .dashboard import Dashboard, DashboardConfig
        
        config = DashboardConfig()
        dashboard = Dashboard(config)
        html = dashboard.render_html(self._dashboard_data)
        
        return 200, "text/html", html.encode()
    
    def _handle_data(self, path: str, query: Dict) -> tuple:
        """Handle data API request."""
        widget_id = query.get("widget", [None])[0]
        
        if widget_id and widget_id in self._dashboard_data:
            data = self._dashboard_data[widget_id]
        else:
            data = self._dashboard_data
        
        return 200, "application/json", json.dumps(data).encode()
    
    def _handle_search(self, path: str, query: Dict) -> tuple:
        """Handle search API request."""
        q = query.get("q", [""])[0]
        
        results = {"query": q, "results": [], "total": 0}
        return 200, "application/json", json.dumps(results).encode()
    
    def _handle_graph(self, path: str, query: Dict) -> tuple:
        """Handle graph data request."""
        graph_type = query.get("type", ["dependencies"])[0]
        
        graph_data = self._dashboard_data.get(graph_type, {"nodes": [], "edges": []})
        return 200, "application/json", json.dumps(graph_data).encode()
    
    def _handle_health(self, path: str, query: Dict) -> tuple:
        """Handle health check."""
        return 200, "application/json", json.dumps({"status": "healthy"}).encode()
    
    def _create_request_handler(self):
        """Create the HTTP request handler class."""
        server = self
        
        class RequestHandler(http.server.BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                logger.debug(f"Request: {args}")
            
            def do_GET(self):
                # Parse path and query
                from urllib.parse import urlparse, parse_qs
                parsed = urlparse(self.path)
                path = parsed.path
                query = parse_qs(parsed.query)
                
                # Find handler
                handler = server._routes.get(path)
                
                if handler:
                    try:
                        status, content_type, body = handler(path, query)
                        self._send_response(status, content_type, body)
                    except Exception as e:
                        logger.error(f"Handler error: {e}")
                        self._send_response(500, "text/plain", str(e).encode())
                else:
                    self._send_response(404, "text/plain", b"Not Found")
            
            def _send_response(self, status: int, content_type: str, body: bytes):
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                
                if server.config.cors_enabled:
                    self.send_header("Access-Control-Allow-Origin", "*")
                
                self.end_headers()
                self.wfile.write(body)
        
        return RequestHandler
    
    def start(self, blocking: bool = False):
        """Start the visualization server."""
        handler_class = self._create_request_handler()
        
        self._httpd = socketserver.TCPServer(
            (self.config.host, self.config.port),
            handler_class
        )
        
        self._running = True
        
        logger.info(f"Starting visualization server at http://{self.config.host}:{self.config.port}")
        
        if blocking:
            self._httpd.serve_forever()
        else:
            self._thread = threading.Thread(target=self._httpd.serve_forever)
            self._thread.daemon = True
            self._thread.start()
    
    def stop(self):
        """Stop the visualization server."""
        if self._httpd:
            self._httpd.shutdown()
            self._running = False
            logger.info("Visualization server stopped")
    
    def is_running(self) -> bool:
        """Check if server is running."""
        return self._running
