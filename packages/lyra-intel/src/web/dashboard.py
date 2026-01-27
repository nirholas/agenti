"""
Interactive Web Dashboard for Lyra Intel.

Provides a real-time visualization dashboard with:
- Code structure graphs (D3.js/Cytoscape)
- Dependency trees
- Pattern heatmaps
- Live analysis progress
- Searchable codebase explorer
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set
import hashlib
import html
import urllib.parse

logger = logging.getLogger(__name__)


class WidgetType(Enum):
    """Dashboard widget types."""
    GRAPH = "graph"
    TABLE = "table"
    CHART = "chart"
    METRICS = "metrics"
    TIMELINE = "timeline"
    HEATMAP = "heatmap"
    TREE = "tree"
    CODE = "code"
    SEARCH = "search"
    LOG = "log"


class ChartType(Enum):
    """Chart visualization types."""
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    DONUT = "donut"
    AREA = "area"
    SCATTER = "scatter"
    RADAR = "radar"
    TREEMAP = "treemap"


@dataclass
class Widget:
    """Dashboard widget configuration."""
    id: str
    widget_type: WidgetType
    title: str
    data_source: str
    config: Dict[str, Any] = field(default_factory=dict)
    position: Dict[str, int] = field(default_factory=lambda: {"x": 0, "y": 0, "w": 6, "h": 4})
    refresh_interval_seconds: int = 30


@dataclass
class DashboardConfig:
    """Dashboard configuration."""
    title: str = "Lyra Intel Dashboard"
    refresh_interval: int = 30
    theme: str = "dark"
    layout: str = "grid"
    widgets: List[Widget] = field(default_factory=list)
    websocket_enabled: bool = True
    port: int = 3000


class Dashboard:
    """
    Interactive web dashboard for codebase visualization.
    
    Features:
    - Real-time updates via WebSocket
    - Multiple visualization widgets
    - Searchable interface
    - Export capabilities
    """
    
    def __init__(self, config: Optional[DashboardConfig] = None):
        self.config = config or DashboardConfig()
        self.widgets: Dict[str, Widget] = {}
        self.data_sources: Dict[str, Callable] = {}
        self.websocket_clients: Set = set()
        self._running = False
        self._cached_data: Dict[str, Any] = {}
        self._setup_default_widgets()
    
    def _setup_default_widgets(self):
        """Setup default dashboard widgets."""
        default_widgets = [
            Widget(
                id="dep_graph",
                widget_type=WidgetType.GRAPH,
                title="Dependency Graph",
                data_source="dependencies",
                config={
                    "layout": "force-directed",
                    "node_color_by": "type",
                    "edge_weight_by": "import_count",
                    "interactive": True,
                },
                position={"x": 0, "y": 0, "w": 8, "h": 6},
            ),
            Widget(
                id="file_tree",
                widget_type=WidgetType.TREE,
                title="File Structure",
                data_source="file_tree",
                config={
                    "expandable": True,
                    "show_size": True,
                    "show_type_icons": True,
                },
                position={"x": 8, "y": 0, "w": 4, "h": 6},
            ),
            Widget(
                id="pattern_heatmap",
                widget_type=WidgetType.HEATMAP,
                title="Pattern Distribution",
                data_source="patterns",
                config={
                    "x_axis": "file",
                    "y_axis": "pattern_type",
                    "color_by": "severity",
                },
                position={"x": 0, "y": 6, "w": 6, "h": 4},
            ),
            Widget(
                id="metrics_panel",
                widget_type=WidgetType.METRICS,
                title="Key Metrics",
                data_source="metrics",
                config={
                    "metrics": ["files", "functions", "classes", "patterns", "complexity"],
                    "show_trends": True,
                },
                position={"x": 6, "y": 6, "w": 6, "h": 4},
            ),
            Widget(
                id="commit_timeline",
                widget_type=WidgetType.TIMELINE,
                title="Commit Activity",
                data_source="commits",
                config={
                    "time_range": "30d",
                    "group_by": "day",
                    "show_authors": True,
                },
                position={"x": 0, "y": 10, "w": 12, "h": 3},
            ),
            Widget(
                id="code_search",
                widget_type=WidgetType.SEARCH,
                title="Code Search",
                data_source="search",
                config={
                    "result_limit": 50,
                    "show_preview": True,
                    "highlight_matches": True,
                },
                position={"x": 0, "y": 13, "w": 12, "h": 3},
            ),
        ]
        
        for widget in default_widgets:
            self.widgets[widget.id] = widget
    
    def add_widget(self, widget: Widget):
        """Add a widget to the dashboard."""
        self.widgets[widget.id] = widget
    
    def remove_widget(self, widget_id: str):
        """Remove a widget from the dashboard."""
        self.widgets.pop(widget_id, None)
    
    def register_data_source(self, name: str, callback: Callable):
        """Register a data source callback."""
        self.data_sources[name] = callback
    
    async def get_widget_data(self, widget_id: str) -> Dict[str, Any]:
        """Get data for a specific widget."""
        if widget_id not in self.widgets:
            return {"error": "Widget not found"}
        
        widget = self.widgets[widget_id]
        source = widget.data_source
        
        if source in self.data_sources:
            try:
                data = await self.data_sources[source]()
                self._cached_data[widget_id] = data
                return data
            except Exception as e:
                logger.error(f"Error fetching data for widget {widget_id}: {e}")
                return self._cached_data.get(widget_id, {"error": str(e)})
        
        return self._cached_data.get(widget_id, {})
    
    def render_html(self, analysis_data: Dict[str, Any]) -> str:
        """Render the complete dashboard as HTML."""
        widgets_html = self._render_widgets(analysis_data)
        scripts = self._generate_scripts(analysis_data)
        styles = self._generate_styles()
        
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{html.escape(self.config.title)}</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="https://unpkg.com/cytoscape/dist/cytoscape.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>{styles}</style>
</head>
<body class="theme-{html.escape(self.config.theme)}">
    <div class="dashboard-container">
        <header class="dashboard-header">
            <h1>🔮 {html.escape(self.config.title)}</h1>
            <div class="dashboard-controls">
                <button onclick="refreshAll()">🔄 Refresh</button>
                <button onclick="exportDashboard()">📥 Export</button>
                <select onchange="changeTheme(this.value)">
                    <option value="dark">Dark Theme</option>
                    <option value="light">Light Theme</option>
                </select>
            </div>
        </header>
        <main class="dashboard-grid">
            {widgets_html}
        </main>
        <footer class="dashboard-footer">
            <span>Last updated: <span id="last-updated">{datetime.now().isoformat()}</span></span>
            <span id="connection-status">⬤ Connected</span>
        </footer>
    </div>
    <script>{scripts}</script>
</body>
</html>"""
    
    def _render_widgets(self, data: Dict[str, Any]) -> str:
        """Render all widgets."""
        html_parts = []
        
        for widget in self.widgets.values():
            pos = widget.position
            widget_html = self._render_single_widget(widget, data)
            
            style = f"grid-column: span {pos['w']}; grid-row: span {pos['h']};"
            html_parts.append(f"""
            <div class="widget widget-{widget.widget_type.value}" 
                 id="widget-{html.escape(widget.id)}" 
                 style="{style}">
                <div class="widget-header">
                    <h3>{html.escape(widget.title)}</h3>
                    <div class="widget-controls">
                        <button onclick="refreshWidget('{html.escape(widget.id)}')">🔄</button>
                        <button onclick="expandWidget('{html.escape(widget.id)}')">⤢</button>
                    </div>
                </div>
                <div class="widget-content" id="content-{html.escape(widget.id)}">
                    {widget_html}
                </div>
            </div>
            """)
        
        return "\n".join(html_parts)
    
    def _render_single_widget(self, widget: Widget, data: Dict[str, Any]) -> str:
        """Render a single widget based on its type."""
        widget_type = widget.widget_type
        source_data = data.get(widget.data_source, {})
        
        if widget_type == WidgetType.GRAPH:
            return self._render_graph_widget(widget, source_data)
        elif widget_type == WidgetType.TREE:
            return self._render_tree_widget(widget, source_data)
        elif widget_type == WidgetType.HEATMAP:
            return self._render_heatmap_widget(widget, source_data)
        elif widget_type == WidgetType.METRICS:
            return self._render_metrics_widget(widget, source_data)
        elif widget_type == WidgetType.TIMELINE:
            return self._render_timeline_widget(widget, source_data)
        elif widget_type == WidgetType.SEARCH:
            return self._render_search_widget(widget, source_data)
        elif widget_type == WidgetType.TABLE:
            return self._render_table_widget(widget, source_data)
        elif widget_type == WidgetType.CHART:
            return self._render_chart_widget(widget, source_data)
        else:
            return f"<p>Unknown widget type: {widget_type.value}</p>"
    
    def _render_graph_widget(self, widget: Widget, data: Dict) -> str:
        """Render dependency graph widget."""
        graph_id = f"graph-{widget.id}"
        return f"""
        <div id="{html.escape(graph_id)}" class="graph-container"></div>
        <div class="graph-legend">
            <span class="legend-item"><span class="dot" style="background:#4CAF50"></span> Module</span>
            <span class="legend-item"><span class="dot" style="background:#2196F3"></span> Class</span>
            <span class="legend-item"><span class="dot" style="background:#FF9800"></span> Function</span>
        </div>
        """
    
    def _render_tree_widget(self, widget: Widget, data: Dict) -> str:
        """Render file tree widget."""
        tree_id = f"tree-{widget.id}"
        return f"""
        <div id="{html.escape(tree_id)}" class="tree-container">
            <ul class="file-tree" id="file-tree-root">
                <li class="loading">Loading file structure...</li>
            </ul>
        </div>
        """
    
    def _render_heatmap_widget(self, widget: Widget, data: Dict) -> str:
        """Render pattern heatmap widget."""
        heatmap_id = f"heatmap-{widget.id}"
        return f'<canvas id="{html.escape(heatmap_id)}" class="heatmap-canvas"></canvas>'
    
    def _render_metrics_widget(self, widget: Widget, data: Dict) -> str:
        """Render metrics panel widget."""
        files = data.get("files", {})
        code_units = data.get("code_units", {})
        patterns = data.get("patterns", {})
        
        total_files = files.get("total", 0)
        total_lines = files.get("total_lines", 0)
        functions = code_units.get("functions", 0)
        classes = code_units.get("classes", 0)
        critical = patterns.get("by_severity", {}).get("critical", 0)
        warnings = patterns.get("by_severity", {}).get("warning", 0)
        
        return f"""
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">{total_files:,}</div>
                <div class="metric-label">Files</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{total_lines:,}</div>
                <div class="metric-label">Lines</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{functions:,}</div>
                <div class="metric-label">Functions</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">{classes:,}</div>
                <div class="metric-label">Classes</div>
            </div>
            <div class="metric-card critical">
                <div class="metric-value">{critical}</div>
                <div class="metric-label">Critical</div>
            </div>
            <div class="metric-card warning">
                <div class="metric-value">{warnings}</div>
                <div class="metric-label">Warnings</div>
            </div>
        </div>
        """
    
    def _render_timeline_widget(self, widget: Widget, data: Dict) -> str:
        """Render commit timeline widget."""
        timeline_id = f"timeline-{widget.id}"
        return f'<canvas id="{html.escape(timeline_id)}" class="timeline-canvas"></canvas>'
    
    def _render_search_widget(self, widget: Widget, data: Dict) -> str:
        """Render code search widget."""
        return """
        <div class="search-container">
            <div class="search-input-wrapper">
                <input type="text" id="code-search-input" 
                       placeholder="Search code... (e.g., function names, patterns)"
                       onkeyup="debounceSearch(event)">
                <button onclick="executeSearch()">🔍 Search</button>
            </div>
            <div class="search-filters">
                <label><input type="checkbox" id="search-regex"> Regex</label>
                <label><input type="checkbox" id="search-case"> Case sensitive</label>
                <select id="search-file-type">
                    <option value="all">All files</option>
                    <option value=".py">Python</option>
                    <option value=".js">.js/.ts</option>
                    <option value=".go">Go</option>
                </select>
            </div>
            <div id="search-results" class="search-results">
                <p class="search-hint">Enter a search query above</p>
            </div>
        </div>
        """
    
    def _render_table_widget(self, widget: Widget, data: Dict) -> str:
        """Render data table widget."""
        return '<table class="data-table"><thead></thead><tbody></tbody></table>'
    
    def _render_chart_widget(self, widget: Widget, data: Dict) -> str:
        """Render chart widget."""
        chart_id = f"chart-{widget.id}"
        return f'<canvas id="{html.escape(chart_id)}" class="chart-canvas"></canvas>'
    
    def _generate_styles(self) -> str:
        """Generate dashboard CSS styles."""
        return """
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
        }
        
        .theme-dark {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-tertiary: #21262d;
            --text-primary: #f0f6fc;
            --text-secondary: #8b949e;
            --border-color: #30363d;
            --accent-color: #58a6ff;
            --success-color: #3fb950;
            --warning-color: #d29922;
            --error-color: #f85149;
        }
        
        .theme-light {
            --bg-primary: #ffffff;
            --bg-secondary: #f6f8fa;
            --bg-tertiary: #eaeef2;
            --text-primary: #24292f;
            --text-secondary: #57606a;
            --border-color: #d0d7de;
            --accent-color: #0969da;
            --success-color: #1a7f37;
            --warning-color: #9a6700;
            --error-color: #cf222e;
        }
        
        body {
            background: var(--bg-primary);
            color: var(--text-primary);
        }
        
        .dashboard-container {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 2rem;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
        }
        
        .dashboard-header h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .dashboard-controls button,
        .dashboard-controls select {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            margin-left: 0.5rem;
        }
        
        .dashboard-controls button:hover {
            background: var(--accent-color);
            color: white;
        }
        
        .dashboard-grid {
            flex: 1;
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 1rem;
            padding: 1rem;
        }
        
        .widget {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            overflow: hidden;
        }
        
        .widget-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-color);
        }
        
        .widget-header h3 {
            font-size: 0.875rem;
            font-weight: 600;
        }
        
        .widget-controls button {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 0.25rem 0.5rem;
        }
        
        .widget-content {
            padding: 1rem;
            height: calc(100% - 50px);
            overflow: auto;
        }
        
        .graph-container {
            width: 100%;
            height: 100%;
            min-height: 300px;
        }
        
        .graph-legend {
            display: flex;
            gap: 1rem;
            padding-top: 0.5rem;
            font-size: 0.75rem;
        }
        
        .legend-item { display: flex; align-items: center; gap: 0.25rem; }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
        }
        
        .metric-card {
            text-align: center;
            padding: 1rem;
            background: var(--bg-tertiary);
            border-radius: 6px;
        }
        
        .metric-value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--accent-color);
        }
        
        .metric-card.critical .metric-value { color: var(--error-color); }
        .metric-card.warning .metric-value { color: var(--warning-color); }
        
        .metric-label {
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
        }
        
        .search-container { height: 100%; display: flex; flex-direction: column; }
        
        .search-input-wrapper {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
        }
        
        .search-input-wrapper input {
            flex: 1;
            padding: 0.5rem 1rem;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            font-size: 1rem;
        }
        
        .search-input-wrapper button {
            padding: 0.5rem 1rem;
            background: var(--accent-color);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
        }
        
        .search-filters {
            display: flex;
            gap: 1rem;
            margin-bottom: 0.5rem;
            font-size: 0.875rem;
        }
        
        .search-filters label { display: flex; align-items: center; gap: 0.25rem; }
        .search-filters select {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
        }
        
        .search-results {
            flex: 1;
            overflow-y: auto;
            background: var(--bg-tertiary);
            border-radius: 6px;
            padding: 0.5rem;
        }
        
        .search-hint { color: var(--text-secondary); text-align: center; padding: 2rem; }
        
        .file-tree {
            list-style: none;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.875rem;
        }
        
        .file-tree li { padding: 0.25rem 0; }
        .file-tree .folder::before { content: '📁 '; }
        .file-tree .file::before { content: '📄 '; }
        
        .dashboard-footer {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 2rem;
            background: var(--bg-secondary);
            border-top: 1px solid var(--border-color);
            font-size: 0.75rem;
            color: var(--text-secondary);
        }
        
        #connection-status { color: var(--success-color); }
        
        canvas { max-width: 100%; }
        
        .loading { color: var(--text-secondary); animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        """
    
    def _generate_scripts(self, data: Dict[str, Any]) -> str:
        """Generate dashboard JavaScript."""
        # Properly escape JSON to prevent XSS
        data_json = json.dumps(data, default=str)
        # Escape for safe embedding in JavaScript
        safe_json = data_json.replace("</", "<\\/").replace("<!--", "<\\!--")
        
        return f"""
        const dashboardData = {safe_json};
        let ws;
        
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {{
            initializeWidgets();
            setupWebSocket();
        }});
        
        function initializeWidgets() {{
            initDependencyGraph();
            initFileTree();
            initTimeline();
        }}
        
        function initDependencyGraph() {{
            const container = document.getElementById('graph-dep_graph');
            if (!container || !window.cytoscape) return;
            
            const deps = dashboardData.dependencies || {{}};
            const nodes = [];
            const edges = [];
            
            // Convert dependency data to cytoscape format
            if (deps.nodes) {{
                deps.nodes.forEach((node, i) => {{
                    nodes.push({{ data: {{ id: node.id || node, label: node.label || node }} }});
                }});
            }}
            
            if (deps.edges) {{
                deps.edges.forEach(edge => {{
                    edges.push({{ data: {{ source: edge.source, target: edge.target }} }});
                }});
            }}
            
            if (nodes.length === 0) {{
                container.innerHTML = '<p style="text-align:center;color:#888;padding:2rem;">No dependency data available</p>';
                return;
            }}
            
            cytoscape({{
                container: container,
                elements: {{ nodes: nodes, edges: edges }},
                style: [
                    {{ selector: 'node', style: {{ 'label': 'data(label)', 'background-color': '#4CAF50', 'color': '#fff' }} }},
                    {{ selector: 'edge', style: {{ 'width': 2, 'line-color': '#888', 'curve-style': 'bezier' }} }}
                ],
                layout: {{ name: 'cose' }}
            }});
        }}
        
        function initFileTree() {{
            const container = document.getElementById('file-tree-root');
            if (!container) return;
            
            const files = dashboardData.files || {{}};
            const tree = files.tree || [];
            
            if (tree.length === 0) {{
                container.innerHTML = '<li class="file">No files to display</li>';
                return;
            }}
            
            container.innerHTML = buildTreeHTML(tree);
        }}
        
        function buildTreeHTML(items) {{
            if (!items || items.length === 0) return '';
            return items.map(item => {{
                const isDir = item.type === 'directory';
                const icon = isDir ? '📁' : '📄';
                return '<li class="' + (isDir ? 'folder' : 'file') + '">' + item.name + '</li>';
            }}).join('');
        }}
        
        function initTimeline() {{
            const canvas = document.getElementById('timeline-commit_timeline');
            if (!canvas || !window.Chart) return;
            
            const commits = dashboardData.commits || {{}};
            const labels = commits.by_date ? Object.keys(commits.by_date) : [];
            const values = commits.by_date ? Object.values(commits.by_date) : [];
            
            new Chart(canvas, {{
                type: 'line',
                data: {{
                    labels: labels.slice(-30),
                    datasets: [{{
                        label: 'Commits',
                        data: values.slice(-30),
                        borderColor: '#58a6ff',
                        tension: 0.4
                    }}]
                }},
                options: {{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {{ legend: {{ display: false }} }}
                }}
            }});
        }}
        
        function setupWebSocket() {{
            // WebSocket connection for real-time updates
            const wsUrl = 'ws://' + window.location.host + '/ws';
            try {{
                ws = new WebSocket(wsUrl);
                ws.onmessage = function(event) {{
                    const data = JSON.parse(event.data);
                    updateWidgets(data);
                }};
                ws.onclose = function() {{
                    document.getElementById('connection-status').innerHTML = '⬤ Disconnected';
                    document.getElementById('connection-status').style.color = '#f85149';
                }};
            }} catch(e) {{
                console.log('WebSocket not available');
            }}
        }}
        
        function updateWidgets(data) {{
            Object.assign(dashboardData, data);
            document.getElementById('last-updated').textContent = new Date().toISOString();
        }}
        
        function refreshAll() {{
            location.reload();
        }}
        
        function refreshWidget(widgetId) {{
            console.log('Refreshing widget:', widgetId);
        }}
        
        function expandWidget(widgetId) {{
            const widget = document.getElementById('widget-' + widgetId);
            widget.classList.toggle('expanded');
        }}
        
        function changeTheme(theme) {{
            document.body.className = 'theme-' + theme;
            localStorage.setItem('theme', theme);
        }}
        
        function exportDashboard() {{
            const dataStr = JSON.stringify(dashboardData, null, 2);
            const blob = new Blob([dataStr], {{ type: 'application/json' }});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dashboard-export.json';
            a.click();
        }}
        
        let searchTimeout;
        function debounceSearch(event) {{
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(executeSearch, 300);
        }}
        
        function executeSearch() {{
            const query = document.getElementById('code-search-input').value;
            const results = document.getElementById('search-results');
            
            if (!query) {{
                results.innerHTML = '<p class="search-hint">Enter a search query above</p>';
                return;
            }}
            
            results.innerHTML = '<p class="loading">Searching...</p>';
            
            // Simulate search (in real implementation, call API)
            setTimeout(() => {{
                results.innerHTML = '<p>Found results for: ' + query + '</p>';
            }}, 500);
        }}
        
        // Initialize theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.body.className = 'theme-' + savedTheme;
        """
