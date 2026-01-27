"""
WebSocket server for real-time code analysis streaming.
"""

import asyncio
import json
from typing import Dict, Set, Any, Optional
from dataclasses import dataclass, asdict
import logging

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class AnalysisUpdate:
    """Represents an analysis progress update."""
    type: str  # 'start', 'progress', 'issue', 'complete', 'error'
    file: Optional[str] = None
    progress: Optional[float] = None
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class WebSocketAnalysisServer:
    """WebSocket server for streaming analysis results."""
    
    def __init__(self, host: str = "0.0.0.0", port: int = 8765):
        if not WEBSOCKETS_AVAILABLE:
            raise ImportError("websockets library required. Install with: pip install websockets")
        
        self.host = host
        self.port = port
        self.clients: Set[WebSocketServerProtocol] = set()
        self.analysis_sessions: Dict[str, Set[WebSocketServerProtocol]] = {}
        self._server = None
    
    async def start(self):
        """Start the WebSocket server."""
        self._server = await websockets.serve(
            self.handle_client,
            self.host,
            self.port
        )
        logger.info(f"WebSocket server started on ws://{self.host}:{self.port}")
    
    async def stop(self):
        """Stop the WebSocket server."""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            logger.info("WebSocket server stopped")
    
    async def handle_client(self, websocket: WebSocketServerProtocol, path: str):
        """Handle a new WebSocket client connection."""
        self.clients.add(websocket)
        logger.info(f"Client connected: {websocket.remote_address}")
        
        try:
            async for message in websocket:
                await self.process_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected: {websocket.remote_address}")
        finally:
            self.clients.remove(websocket)
            # Remove from all sessions
            for session_clients in self.analysis_sessions.values():
                session_clients.discard(websocket)
    
    async def process_message(self, websocket: WebSocketServerProtocol, message: str):
        """Process incoming message from client."""
        try:
            data = json.loads(message)
            command = data.get('command')
            
            if command == 'subscribe':
                session_id = data.get('session_id')
                if session_id:
                    if session_id not in self.analysis_sessions:
                        self.analysis_sessions[session_id] = set()
                    self.analysis_sessions[session_id].add(websocket)
                    
                    await websocket.send(json.dumps({
                        'type': 'subscribed',
                        'session_id': session_id
                    }))
            
            elif command == 'unsubscribe':
                session_id = data.get('session_id')
                if session_id and session_id in self.analysis_sessions:
                    self.analysis_sessions[session_id].discard(websocket)
                    
                    await websocket.send(json.dumps({
                        'type': 'unsubscribed',
                        'session_id': session_id
                    }))
            
            elif command == 'ping':
                await websocket.send(json.dumps({'type': 'pong'}))
        
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from client: {message}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Invalid JSON'
            }))
    
    async def broadcast_update(self, session_id: str, update: AnalysisUpdate):
        """Broadcast an analysis update to all subscribed clients."""
        if session_id not in self.analysis_sessions:
            return
        
        message = json.dumps({
            'session_id': session_id,
            **asdict(update)
        })
        
        # Send to all clients subscribed to this session
        disconnected = set()
        for client in self.analysis_sessions[session_id]:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
        
        # Clean up disconnected clients
        for client in disconnected:
            self.analysis_sessions[session_id].discard(client)
    
    async def send_start(self, session_id: str, total_files: int):
        """Send analysis start notification."""
        await self.broadcast_update(session_id, AnalysisUpdate(
            type='start',
            data={'total_files': total_files}
        ))
    
    async def send_progress(self, session_id: str, current_file: str, progress: float):
        """Send progress update."""
        await self.broadcast_update(session_id, AnalysisUpdate(
            type='progress',
            file=current_file,
            progress=progress
        ))
    
    async def send_issue(self, session_id: str, issue: Dict[str, Any]):
        """Send issue found during analysis."""
        await self.broadcast_update(session_id, AnalysisUpdate(
            type='issue',
            file=issue.get('file'),
            data=issue
        ))
    
    async def send_complete(self, session_id: str, results: Dict[str, Any]):
        """Send analysis completion."""
        await self.broadcast_update(session_id, AnalysisUpdate(
            type='complete',
            data=results
        ))
    
    async def send_error(self, session_id: str, error: str):
        """Send error notification."""
        await self.broadcast_update(session_id, AnalysisUpdate(
            type='error',
            message=error
        ))


class StreamingAnalyzer:
    """Wrapper for analyzers to stream results via WebSocket."""
    
    def __init__(self, ws_server: WebSocketAnalysisServer):
        self.ws_server = ws_server
    
    async def analyze_with_streaming(self, session_id: str, files: list, analyzer):
        """Run analysis with real-time progress streaming."""
        total_files = len(files)
        await self.ws_server.send_start(session_id, total_files)
        
        results = {
            'files': [],
            'issues': [],
            'metrics': {}
        }
        
        try:
            for i, file_path in enumerate(files):
                # Send progress
                progress = (i / total_files) * 100
                await self.ws_server.send_progress(session_id, file_path, progress)
                
                # Analyze file
                try:
                    file_result = analyzer.analyze_file(file_path)
                    results['files'].append(file_result)
                    
                    # Stream issues as they're found
                    for issue in file_result.get('issues', []):
                        await self.ws_server.send_issue(session_id, issue)
                        results['issues'].append(issue)
                
                except Exception as e:
                    logger.error(f"Error analyzing {file_path}: {e}")
                    await self.ws_server.send_issue(session_id, {
                        'file': file_path,
                        'severity': 'error',
                        'message': f"Analysis failed: {str(e)}"
                    })
            
            # Send completion
            await self.ws_server.send_complete(session_id, results)
            return results
        
        except Exception as e:
            logger.error(f"Analysis error: {e}")
            await self.ws_server.send_error(session_id, str(e))
            raise


# Example usage
async def main():
    """Example of running the WebSocket server."""
    server = WebSocketAnalysisServer(host="0.0.0.0", port=8765)
    await server.start()
    
    # Keep server running
    try:
        await asyncio.Future()  # Run forever
    except KeyboardInterrupt:
        await server.stop()


if __name__ == "__main__":
    if WEBSOCKETS_AVAILABLE:
        asyncio.run(main())
    else:
        print("Please install websockets: pip install websockets")
