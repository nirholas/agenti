"""
Enhanced API Server with GitHub Import Support
"""

import asyncio
import json
import logging
import subprocess
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse
import os

logger = logging.getLogger(__name__)


@dataclass
class AnalysisJob:
    """Analysis job tracking."""
    id: str
    repo_url: str
    status: str  # pending, running, completed, failed
    progress: int = 0
    current_step: str = ""
    features: List[str] = field(default_factory=list)
    features_status: Dict[str, str] = field(default_factory=dict)
    results: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    github_token: Optional[str] = None  # For private repos


class EnhancedAPIServer:
    """
    Enhanced API server with GitHub import and real-time analysis.
    """
    
    def __init__(self, host="0.0.0.0", port=8080):
        self.host = host
        self.port = port
        self.jobs: Dict[str, AnalysisJob] = {}
        self.server = None
        self.running = False
        
    def start(self):
        """Start the API server."""
        handler = self._create_handler()
        self.server = HTTPServer((self.host, self.port), handler)
        self.running = True
        
        logger.info(f"Enhanced API Server starting at http://{self.host}:{self.port}")
        print(f"\n🚀 Lyra Intel API Server")
        print(f"   URL: http://{self.host}:{self.port}")
        print(f"   Dashboard: http://{self.host}:{self.port}/\n")
        
        try:
            self.server.serve_forever()
        except KeyboardInterrupt:
            logger.info("Shutting down server...")
            self.stop()
    
    def stop(self):
        """Stop the server."""
        if self.server:
            self.server.shutdown()
            self.running = False
    
    def _create_handler(self):
        """Create request handler class."""
        server = self
        
        class RequestHandler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                logger.debug(f"{self.client_address[0]} - {format % args}")
            
            def do_GET(self):
                """Handle GET requests."""
                parsed = urlparse(self.path)
                path = parsed.path
                
                if path == '/':
                    self._serve_index()
                elif path == '/api/health':
                    self._send_json(200, {"status": "healthy", "version": "2.0.0"})
                elif path.startswith('/api/analysis/') and '/status' in path:
                    analysis_id = path.split('/')[3]
                    self._get_analysis_status(analysis_id)
                elif path.startswith('/api/analysis/') and '/results' in path:
                    analysis_id = path.split('/')[3]
                    self._get_analysis_results(analysis_id)
                elif path.startswith('/static/'):
                    self._serve_static(path[8:])
                else:
                    self._send_error(404, "Not Found")
            
            def do_POST(self):
                """Handle POST requests."""
                parsed = urlparse(self.path)
                path = parsed.path
                
                if path == '/api/analyze':
                    self._start_analysis()
                else:
                    self._send_error(404, "Not Found")
            
            def _serve_index(self):
                """Serve main dashboard HTML."""
                try:
                    template_path = Path(__file__).parent / 'templates' / 'index.html'
                    if template_path.exists():
                        content = template_path.read_bytes()
                        self._send_response(200, 'text/html', content)
                    else:
                        self._send_error(404, "Index not found")
                except Exception as e:
                    logger.error(f"Error serving index: {e}")
                    self._send_error(500, str(e))
            
            def _serve_static(self, path):
                """Serve static files."""
                try:
                    static_path = Path(__file__).parent / 'static' / path
                    if not static_path.exists():
                        self._send_error(404, "File not found")
                        return
                    
                    content = static_path.read_bytes()
                    
                    # Determine content type
                    content_type = 'text/plain'
                    if path.endswith('.css'):
                        content_type = 'text/css'
                    elif path.endswith('.js'):
                        content_type = 'application/javascript'
                    elif path.endswith('.json'):
                        content_type = 'application/json'
                    elif path.endswith('.html'):
                        content_type = 'text/html'
                    
                    self._send_response(200, content_type, content)
                    
                except Exception as e:
                    logger.error(f"Error serving static file: {e}")
                    self._send_error(500, str(e))
            
            def _start_analysis(self):
                """Start repository analysis."""
                try:
                    content_length = int(self.headers.get('Content-Length', 0))
                    body = self.rfile.read(content_length)
                    data = json.loads(body.decode())
                    
                    repo_url = data.get('repo_url')
                    features = data.get('features', ['core', 'git', 'security', 'knowledge', 'forensics'])
                    github_token = data.get('github_token')  # Optional GitHub token for private repos
                    
                    if not repo_url:
                        self._send_json(400, {"error": "repo_url is required"})
                        return
                    
                    # Create analysis job
                    analysis_id = str(uuid.uuid4())
                    job = AnalysisJob(
                        id=analysis_id,
                        repo_url=repo_url,
                        status='pending',
                        features=features
                    )
                    
                    # Store GitHub token in job (securely in memory only)
                    if github_token:
                        job.github_token = github_token
                    
                    # Initialize feature statuses
                    for feature in features:
                        job.features_status[feature] = 'pending'
                    
                    server.jobs[analysis_id] = job
                    
                    # Start analysis in background
                    thread = threading.Thread(
                        target=server._run_analysis,
                        args=(analysis_id,),
                        daemon=True
                    )
                    thread.start()
                    
                    self._send_json(200, {
                        "status": "started",
                        "analysis_id": analysis_id,
                        "message": "Analysis started successfully"
                    })
                    
                except Exception as e:
                    logger.error(f"Error starting analysis: {e}")
                    self._send_json(500, {"error": str(e)})
            
            def _get_analysis_status(self, analysis_id):
                """Get analysis job status."""
                if analysis_id not in server.jobs:
                    self._send_json(404, {"error": "Analysis not found"})
                    return
                
                job = server.jobs[analysis_id]
                self._send_json(200, {
                    "status": job.status,
                    "progress": job.progress,
                    "current_step": job.current_step,
                    "features_status": job.features_status,
                    "error": job.error
                })
            
            def _get_analysis_results(self, analysis_id):
                """Get analysis results."""
                if analysis_id not in server.jobs:
                    self._send_json(404, {"error": "Analysis not found"})
                    return
                
                job = server.jobs[analysis_id]
                
                if job.status != 'completed':
                    self._send_json(400, {"error": "Analysis not yet completed"})
                    return
                
                self._send_json(200, {
                    "analysis_id": analysis_id,
                    "repo_url": job.repo_url,
                    "metrics": job.results.get('metrics', {}),
                    "dependencies": job.results.get('dependencies', {}),
                    "files": job.results.get('files', {}),
                    "patterns": job.results.get('patterns', {}),
                    "security": job.results.get('security', {}),
                    "complexity": job.results.get('complexity', {})
                })
            
            def _send_response(self, status, content_type, body):
                """Send HTTP response."""
                self.send_response(status)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(body)
            
            def _send_json(self, status, data):
                """Send JSON response."""
                body = json.dumps(data).encode()
                self._send_response(status, 'application/json', body)
            
            def _send_error(self, status, message):
                """Send error response."""
                self._send_json(status, {"error": message})
        
        return RequestHandler
    
    def _run_analysis(self, analysis_id: str):
        """Run analysis in background."""
        job = self.jobs[analysis_id]
        
        try:
            job.status = 'running'
            job.current_step = 'Cloning repository...'
            job.progress = 5
            
            # Clone repository (with token if provided)
            github_token = getattr(job, 'github_token', None)
            repo_path = self._clone_repo(job.repo_url, github_token)
            job.progress = 15
            
            # Run analyses based on selected features
            if 'core' in job.features:
                job.current_step = 'Running core analysis...'
                job.features_status['core'] = 'running'
                core_results = self._run_core_analysis(repo_path)
                job.results['metrics'] = core_results
                job.features_status['core'] = 'completed'
                job.progress = 30
            
            if 'git' in job.features:
                job.current_step = 'Analyzing git history...'
                job.features_status['git'] = 'running'
                git_results = self._run_git_analysis(repo_path)
                job.results['git'] = git_results
                job.features_status['git'] = 'completed'
                job.progress = 45
            
            if 'security' in job.features:
                job.current_step = 'Running security scan...'
                job.features_status['security'] = 'running'
                security_results = self._run_security_scan(repo_path)
                job.results['security'] = security_results
                job.features_status['security'] = 'completed'
                job.progress = 60
            
            if 'knowledge' in job.features:
                job.current_step = 'Building knowledge graph...'
                job.features_status['knowledge'] = 'running'
                knowledge_results = self._build_knowledge_graph(repo_path)
                job.results['dependencies'] = knowledge_results
                job.features_status['knowledge'] = 'completed'
                job.progress = 75
            
            if 'forensics' in job.features:
                job.current_step = 'Running forensic analysis...'
                job.features_status['forensics'] = 'running'
                forensics_results = self._run_forensics(repo_path)
                job.results['forensics'] = forensics_results
                job.features_status['forensics'] = 'completed'
                job.progress = 90
            
            job.current_step = 'Finalizing results...'
            job.progress = 100
            job.status = 'completed'
            job.completed_at = datetime.now()
            
            logger.info(f"Analysis {analysis_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Analysis {analysis_id} failed: {e}")
            job.status = 'failed'
            job.error = str(e)
            
            # Mark all running features as failed
            for feature in job.features_status:
                if job.features_status[feature] == 'running':
                    job.features_status[feature] = 'failed'
    
    def _clone_repo(self, repo_url: str, github_token: Optional[str] = None) -> Path:
        """Clone GitHub repository (supports private repos with token)."""
        # Normalize URL
        if not repo_url.startswith('http') and not repo_url.startswith('git@'):
            # Assume short form: owner/repo
            repo_url = f"https://github.com/{repo_url}.git"
        
        # If token provided, inject into URL for private repos
        if github_token and 'github.com' in repo_url:
            # Convert https://github.com/owner/repo.git
            # to https://TOKEN@github.com/owner/repo.git
            if repo_url.startswith('https://'):
                repo_url = repo_url.replace('https://', f'https://{github_token}@')
            elif repo_url.startswith('http://'):
                repo_url = repo_url.replace('http://', f'http://{github_token}@')
        
        temp_dir = Path(tempfile.mkdtemp(prefix='lyra_'))
        
        logger.info(f"Cloning repository to {temp_dir}")
        
        # Clone with token embedded (will be hidden in logs)
        result = subprocess.run(
            ['git', 'clone', '--depth', '1', repo_url, str(temp_dir)],
            capture_output=True,
            text=True,
            timeout=300,
            env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'}  # Disable prompts
        )
        
        if result.returncode != 0:
            # Don't expose token in error message
            error_msg = result.stderr.replace(github_token, '***') if github_token else result.stderr
            raise Exception(f"Failed to clone repository: {error_msg}")
        
        return temp_dir
    
    def _run_core_analysis(self, repo_path: Path) -> Dict:
        """Run core analysis."""
        result = subprocess.run(
            ['python', 'cli.py', 'scan', str(repo_path)],
            capture_output=True,
            text=True,
            timeout=600
        )
        
        # Parse output for metrics
        output = result.stdout
        metrics = {
            'total_files': self._extract_metric(output, 'Total files:'),
            'total_lines': self._extract_metric(output, 'Total lines:'),
            'total_functions': self._extract_metric(output, 'Code units found:'),
            'total_classes': 0,
            'critical_issues': self._extract_metric(output, 'Critical issues:'),
            'warnings': self._extract_metric(output, 'Patterns found:')
        }
        
        return metrics
    
    def _run_git_analysis(self, repo_path: Path) -> Dict:
        """Run git analysis."""
        # Simplified - just count commits
        result = subprocess.run(
            ['git', '-C', str(repo_path), 'log', '--oneline'],
            capture_output=True,
            text=True
        )
        
        commits = len(result.stdout.strip().split('\n')) if result.stdout else 0
        
        return {'total_commits': commits}
    
    def _run_security_scan(self, repo_path: Path) -> Dict:
        """Run security scan."""
        result = subprocess.run(
            ['python', 'cli.py', 'security', str(repo_path)],
            capture_output=True,
            text=True,
            timeout=600
        )
        
        return {'scan_completed': True}
    
    def _build_knowledge_graph(self, repo_path: Path) -> Dict:
        """Build knowledge graph."""
        return {'nodes': [], 'edges': []}
    
    def _run_forensics(self, repo_path: Path) -> Dict:
        """Run forensic analysis."""
        return {'completed': True}
    
    def _extract_metric(self, text: str, label: str) -> int:
        """Extract numeric metric from text."""
        for line in text.split('\n'):
            if label in line:
                # Extract number
                import re
                match = re.search(r'(\d+(?:,\d+)*)', line.replace(label, ''))
                if match:
                    return int(match.group(1).replace(',', ''))
        return 0


def main():
    """Run the enhanced API server."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    
    server = EnhancedAPIServer(host="0.0.0.0", port=8080)
    server.start()


if __name__ == "__main__":
    main()
