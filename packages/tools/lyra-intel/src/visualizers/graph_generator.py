"""
Graph Generator - Creates visual dependency graphs.

Supports multiple output formats:
- DOT (Graphviz)
- JSON (D3.js, Cytoscape)
- SVG (embedded rendering)
- Mermaid (markdown diagrams)
"""

import json
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class GraphFormat(Enum):
    """Supported graph output formats."""
    DOT = "dot"          # Graphviz DOT format
    JSON = "json"        # JSON for D3.js/Cytoscape
    MERMAID = "mermaid"  # Mermaid diagram syntax
    SVG = "svg"          # SVG output (requires graphviz)
    HTML = "html"        # Interactive HTML


class LayoutAlgorithm(Enum):
    """Graph layout algorithms."""
    HIERARCHICAL = "hierarchical"  # Top-down hierarchy
    FORCE = "force"                # Force-directed
    CIRCULAR = "circular"          # Circular layout
    GRID = "grid"                  # Grid layout
    RADIAL = "radial"              # Radial tree


@dataclass
class GraphNode:
    """Node in a graph."""
    id: str
    label: str
    type: str  # file, function, class, module, package
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Visual properties
    color: Optional[str] = None
    size: float = 1.0
    shape: str = "box"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "type": self.type,
            "metadata": self.metadata,
            "color": self.color,
            "size": self.size,
            "shape": self.shape,
        }


@dataclass
class GraphEdge:
    """Edge in a graph."""
    source: str
    target: str
    type: str  # import, call, inherit, implement
    weight: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Visual properties
    color: Optional[str] = None
    style: str = "solid"  # solid, dashed, dotted
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "target": self.target,
            "type": self.type,
            "weight": self.weight,
            "metadata": self.metadata,
            "color": self.color,
            "style": self.style,
        }


@dataclass
class Graph:
    """Complete graph structure."""
    nodes: List[GraphNode] = field(default_factory=list)
    edges: List[GraphEdge] = field(default_factory=list)
    title: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_node(self, node: GraphNode):
        """Add a node to the graph."""
        self.nodes.append(node)
    
    def add_edge(self, edge: GraphEdge):
        """Add an edge to the graph."""
        self.edges.append(edge)
    
    def get_node(self, node_id: str) -> Optional[GraphNode]:
        """Get node by ID."""
        for node in self.nodes:
            if node.id == node_id:
                return node
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "nodes": [n.to_dict() for n in self.nodes],
            "edges": [e.to_dict() for e in self.edges],
            "metadata": self.metadata,
        }


@dataclass
class GraphConfig:
    """Configuration for graph generation."""
    format: GraphFormat = GraphFormat.JSON
    layout: LayoutAlgorithm = LayoutAlgorithm.FORCE
    
    # Node styling
    node_colors: Dict[str, str] = field(default_factory=lambda: {
        "file": "#4CAF50",
        "function": "#2196F3",
        "class": "#9C27B0",
        "module": "#FF9800",
        "package": "#F44336",
    })
    
    # Edge styling
    edge_colors: Dict[str, str] = field(default_factory=lambda: {
        "import": "#666666",
        "call": "#2196F3",
        "inherit": "#9C27B0",
        "implement": "#FF9800",
    })
    
    # Layout options
    max_nodes: int = 500  # Limit for performance
    cluster_by: Optional[str] = None  # Group nodes by attribute
    highlight_circular: bool = True
    
    # Output options
    include_external: bool = False
    simplify: bool = True  # Remove intermediate nodes


class GraphGenerator:
    """
    Generates visual graphs from analysis results.
    
    Creates dependency graphs, call graphs, inheritance trees,
    and other visualizations from codebase analysis.
    """
    
    def __init__(self, config: Optional[GraphConfig] = None):
        self.config = config or GraphConfig()
    
    def from_dependency_graph(self, dep_graph: Dict[str, Any]) -> Graph:
        """
        Create graph from dependency analysis results.
        
        Args:
            dep_graph: Output from DependencyMapper
            
        Returns:
            Graph object ready for rendering
        """
        graph = Graph(title="Dependency Graph")
        
        nodes_data = dep_graph.get("nodes", {})
        edges_data = dep_graph.get("edges", [])
        
        # Create nodes
        for node_id, node_meta in nodes_data.items():
            # Determine node type from extension or metadata
            ext = Path(node_id).suffix.lower()
            node_type = "file"
            
            if ext in [".py"]:
                node_type = "python"
            elif ext in [".js", ".jsx", ".ts", ".tsx"]:
                node_type = "javascript"
            elif ext in [".go"]:
                node_type = "go"
            
            graph.add_node(GraphNode(
                id=node_id,
                label=Path(node_id).name,
                type=node_type,
                metadata=node_meta,
                color=self.config.node_colors.get(node_type, "#666666"),
            ))
        
        # Create edges
        for edge in edges_data:
            source = edge.get("source_file", "")
            target = edge.get("target_file", "")
            edge_type = edge.get("dependency_type", "import")
            is_external = edge.get("is_external", False)
            
            # Skip external if configured
            if is_external and not self.config.include_external:
                continue
            
            graph.add_edge(GraphEdge(
                source=source,
                target=target,
                type=edge_type,
                color=self.config.edge_colors.get(edge_type, "#666666"),
                style="dashed" if is_external else "solid",
            ))
        
        return graph
    
    def from_ast_results(self, ast_results: List[Dict[str, Any]], graph_type: str = "structure") -> Graph:
        """
        Create graph from AST analysis results.
        
        Args:
            ast_results: List of AST analysis outputs
            graph_type: Type of graph (structure, calls, inheritance)
            
        Returns:
            Graph object
        """
        graph = Graph(title=f"Code Structure - {graph_type}")
        
        for result in ast_results:
            file_path = result.get("file_path", "")
            code_units = result.get("code_units", [])
            
            # Add file node
            file_node = GraphNode(
                id=file_path,
                label=Path(file_path).name,
                type="file",
                color=self.config.node_colors.get("file"),
            )
            graph.add_node(file_node)
            
            # Add code unit nodes
            for unit in code_units:
                unit_id = f"{file_path}::{unit.get('name', 'unknown')}"
                unit_type = unit.get("type", "function")
                
                graph.add_node(GraphNode(
                    id=unit_id,
                    label=unit.get("name", "unknown"),
                    type=unit_type,
                    metadata={
                        "line_start": unit.get("line_start"),
                        "line_end": unit.get("line_end"),
                        "complexity": unit.get("complexity"),
                    },
                    color=self.config.node_colors.get(unit_type, "#666666"),
                ))
                
                # Connect to file
                graph.add_edge(GraphEdge(
                    source=file_path,
                    target=unit_id,
                    type="contains",
                ))
                
                # Connect to parent if nested
                parent = unit.get("parent")
                if parent:
                    parent_id = f"{file_path}::{parent}"
                    graph.add_edge(GraphEdge(
                        source=parent_id,
                        target=unit_id,
                        type="contains",
                    ))
        
        return graph
    
    def render(self, graph: Graph, output_path: Optional[str] = None) -> str:
        """
        Render graph to specified format.
        
        Args:
            graph: Graph to render
            output_path: Optional file path to save output
            
        Returns:
            Rendered graph as string
        """
        if self.config.format == GraphFormat.DOT:
            output = self._render_dot(graph)
        elif self.config.format == GraphFormat.JSON:
            output = self._render_json(graph)
        elif self.config.format == GraphFormat.MERMAID:
            output = self._render_mermaid(graph)
        elif self.config.format == GraphFormat.HTML:
            output = self._render_html(graph)
        else:
            output = self._render_json(graph)
        
        if output_path:
            Path(output_path).write_text(output)
            logger.info(f"Graph saved to: {output_path}")
        
        return output
    
    def _render_dot(self, graph: Graph) -> str:
        """Render as Graphviz DOT format."""
        lines = [
            f'digraph "{graph.title}" {{',
            "  rankdir=LR;",
            "  node [shape=box, style=filled];",
            "",
        ]
        
        # Add nodes
        for node in graph.nodes:
            color = node.color or "#ffffff"
            label = node.label.replace('"', '\\"')
            lines.append(f'  "{node.id}" [label="{label}", fillcolor="{color}"];')
        
        lines.append("")
        
        # Add edges
        for edge in graph.edges:
            style = f'style={edge.style}' if edge.style != "solid" else ""
            color = f'color="{edge.color}"' if edge.color else ""
            attrs = ", ".join(filter(None, [style, color]))
            if attrs:
                attrs = f" [{attrs}]"
            lines.append(f'  "{edge.source}" -> "{edge.target}"{attrs};')
        
        lines.append("}")
        return "\n".join(lines)
    
    def _render_json(self, graph: Graph) -> str:
        """Render as JSON for D3.js/Cytoscape."""
        return json.dumps(graph.to_dict(), indent=2)
    
    def _render_mermaid(self, graph: Graph) -> str:
        """Render as Mermaid diagram syntax."""
        lines = [
            "```mermaid",
            "graph LR",
        ]
        
        # Add nodes with styling
        for node in graph.nodes:
            node_id = node.id.replace("/", "_").replace(".", "_").replace("::", "_")
            label = node.label
            lines.append(f"    {node_id}[{label}]")
        
        # Add edges
        for edge in graph.edges:
            source_id = edge.source.replace("/", "_").replace(".", "_").replace("::", "_")
            target_id = edge.target.replace("/", "_").replace(".", "_").replace("::", "_")
            
            arrow = "-->" if edge.style == "solid" else "-..->"
            lines.append(f"    {source_id} {arrow} {target_id}")
        
        lines.append("```")
        return "\n".join(lines)
    
    def _render_html(self, graph: Graph) -> str:
        """Render as interactive HTML with D3.js."""
        graph_json = json.dumps(graph.to_dict())
        
        return f'''<!DOCTYPE html>
<html>
<head>
    <title>{graph.title}</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {{ margin: 0; font-family: Arial, sans-serif; }}
        #graph {{ width: 100vw; height: 100vh; }}
        .node {{ cursor: pointer; }}
        .node text {{ font-size: 12px; }}
        .link {{ fill: none; stroke-width: 1.5px; }}
        .tooltip {{ position: absolute; background: white; padding: 10px; border: 1px solid #ccc; border-radius: 4px; }}
    </style>
</head>
<body>
    <div id="graph"></div>
    <script>
        const data = {graph_json};
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        const svg = d3.select("#graph")
            .append("svg")
            .attr("width", width)
            .attr("height", height);
        
        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.edges).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));
        
        const link = svg.append("g")
            .selectAll("line")
            .data(data.edges)
            .join("line")
            .attr("class", "link")
            .attr("stroke", d => d.color || "#999")
            .attr("stroke-dasharray", d => d.style === "dashed" ? "5,5" : "");
        
        const node = svg.append("g")
            .selectAll("g")
            .data(data.nodes)
            .join("g")
            .attr("class", "node")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));
        
        node.append("circle")
            .attr("r", 8)
            .attr("fill", d => d.color || "#666");
        
        node.append("text")
            .attr("dx", 12)
            .attr("dy", 4)
            .text(d => d.label);
        
        simulation.on("tick", () => {{
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            
            node.attr("transform", d => `translate(${{d.x}},${{d.y}})`);
        }});
        
        function dragstarted(event) {{
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }}
        
        function dragged(event) {{
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }}
        
        function dragended(event) {{
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }}
    </script>
</body>
</html>'''
    
    def highlight_path(self, graph: Graph, start: str, end: str) -> Graph:
        """Highlight a path between two nodes."""
        # Find path using BFS
        visited = {start}
        queue = [(start, [start])]
        
        adjacency = {}
        for edge in graph.edges:
            if edge.source not in adjacency:
                adjacency[edge.source] = []
            adjacency[edge.source].append(edge.target)
        
        path = []
        while queue:
            current, current_path = queue.pop(0)
            if current == end:
                path = current_path
                break
            
            for neighbor in adjacency.get(current, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, current_path + [neighbor]))
        
        # Highlight nodes and edges in path
        path_set = set(path)
        for node in graph.nodes:
            if node.id in path_set:
                node.color = "#FF5722"
                node.size = 1.5
        
        for edge in graph.edges:
            if edge.source in path_set and edge.target in path_set:
                idx1 = path.index(edge.source) if edge.source in path else -1
                idx2 = path.index(edge.target) if edge.target in path else -1
                if idx2 == idx1 + 1:  # Consecutive in path
                    edge.color = "#FF5722"
                    edge.weight = 2.0
        
        return graph
