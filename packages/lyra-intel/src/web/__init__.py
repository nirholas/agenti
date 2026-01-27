"""
Web UI and Interactive Visualization Module.

Provides:
- Interactive D3.js/Cytoscape visualization server
- Real-time dashboard
- Searchable codebase interface
- Graph exploration tools
"""

from .dashboard import Dashboard, DashboardConfig
from .visualization_server import VisualizationServer

__all__ = ["Dashboard", "DashboardConfig", "VisualizationServer"]
