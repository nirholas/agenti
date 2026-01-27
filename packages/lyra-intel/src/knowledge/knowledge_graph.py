"""
Knowledge Graph - Build semantic relationships between code elements.

This module creates a graph of interconnected knowledge from code,
enabling semantic queries and understanding of relationships.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
import hashlib


class NodeType(Enum):
    """Types of nodes in the knowledge graph."""
    FILE = "file"
    MODULE = "module"
    PACKAGE = "package"
    CLASS = "class"
    FUNCTION = "function"
    METHOD = "method"
    VARIABLE = "variable"
    CONSTANT = "constant"
    INTERFACE = "interface"
    TYPE = "type"
    ENUM = "enum"
    IMPORT = "import"
    EXPORT = "export"
    COMMENT = "comment"
    DOCSTRING = "docstring"
    TEST = "test"
    CONFIG = "config"
    ROUTE = "route"
    COMPONENT = "component"
    HOOK = "hook"
    CONCEPT = "concept"
    PATTERN = "pattern"
    DEPENDENCY = "dependency"


class EdgeType(Enum):
    """Types of edges/relationships in the knowledge graph."""
    DEFINES = "defines"
    IMPORTS = "imports"
    EXPORTS = "exports"
    EXTENDS = "extends"
    IMPLEMENTS = "implements"
    CONTAINS = "contains"
    CALLS = "calls"
    REFERENCES = "references"
    DEPENDS_ON = "depends_on"
    RETURNS = "returns"
    ACCEPTS = "accepts"
    THROWS = "throws"
    OVERRIDES = "overrides"
    TESTS = "tests"
    DOCUMENTS = "documents"
    CONFIGURES = "configures"
    ROUTES_TO = "routes_to"
    RENDERS = "renders"
    USES_HOOK = "uses_hook"
    RELATED_TO = "related_to"
    SIMILAR_TO = "similar_to"
    DERIVED_FROM = "derived_from"
    PRECEDES = "precedes"
    FOLLOWS = "follows"


@dataclass
class KnowledgeNode:
    """A node in the knowledge graph representing a code element or concept."""
    id: str
    name: str
    node_type: NodeType
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    end_line: Optional[int] = None
    properties: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert node to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "type": self.node_type.value,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "end_line": self.end_line,
            "properties": self.properties,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeNode":
        """Create node from dictionary."""
        return cls(
            id=data["id"],
            name=data["name"],
            node_type=NodeType(data["type"]),
            file_path=data.get("file_path"),
            line_number=data.get("line_number"),
            end_line=data.get("end_line"),
            properties=data.get("properties", {}),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.now(),
        )


@dataclass
class KnowledgeEdge:
    """An edge/relationship between two nodes in the knowledge graph."""
    id: str
    source_id: str
    target_id: str
    edge_type: EdgeType
    weight: float = 1.0
    properties: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert edge to dictionary."""
        return {
            "id": self.id,
            "source_id": self.source_id,
            "target_id": self.target_id,
            "type": self.edge_type.value,
            "weight": self.weight,
            "properties": self.properties,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeEdge":
        """Create edge from dictionary."""
        return cls(
            id=data["id"],
            source_id=data["source_id"],
            target_id=data["target_id"],
            edge_type=EdgeType(data["type"]),
            weight=data.get("weight", 1.0),
            properties=data.get("properties", {}),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.now(),
        )


class KnowledgeGraph:
    """
    Main knowledge graph class for storing and querying code relationships.
    
    Features:
    - Node and edge management
    - Traversal algorithms
    - Subgraph extraction
    - Export/import capabilities
    - Query interface
    """
    
    def __init__(self, name: str = "default"):
        """Initialize knowledge graph."""
        self.name = name
        self.nodes: Dict[str, KnowledgeNode] = {}
        self.edges: Dict[str, KnowledgeEdge] = {}
        self._adjacency: Dict[str, Set[str]] = {}  # node_id -> set of edge_ids
        self._reverse_adjacency: Dict[str, Set[str]] = {}  # node_id -> set of incoming edge_ids
        self._type_index: Dict[NodeType, Set[str]] = {}  # type -> set of node_ids
        self._edge_type_index: Dict[EdgeType, Set[str]] = {}  # type -> set of edge_ids
        self.metadata: Dict[str, Any] = {
            "created_at": datetime.now().isoformat(),
            "version": "1.0.0",
        }
    
    def _generate_node_id(self, name: str, node_type: NodeType, file_path: Optional[str] = None) -> str:
        """Generate unique node ID."""
        components = [name, node_type.value]
        if file_path:
            components.append(file_path)
        content = ":".join(components)
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def _generate_edge_id(self, source_id: str, target_id: str, edge_type: EdgeType) -> str:
        """Generate unique edge ID."""
        content = f"{source_id}:{target_id}:{edge_type.value}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def add_node(
        self,
        name: str,
        node_type: NodeType,
        file_path: Optional[str] = None,
        line_number: Optional[int] = None,
        end_line: Optional[int] = None,
        properties: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> KnowledgeNode:
        """Add a node to the graph."""
        node_id = self._generate_node_id(name, node_type, file_path)
        
        # Check if node exists
        if node_id in self.nodes:
            return self.nodes[node_id]
        
        node = KnowledgeNode(
            id=node_id,
            name=name,
            node_type=node_type,
            file_path=file_path,
            line_number=line_number,
            end_line=end_line,
            properties=properties or {},
            metadata=metadata or {},
        )
        
        self.nodes[node_id] = node
        self._adjacency[node_id] = set()
        self._reverse_adjacency[node_id] = set()
        
        # Update type index
        if node_type not in self._type_index:
            self._type_index[node_type] = set()
        self._type_index[node_type].add(node_id)
        
        return node
    
    def add_edge(
        self,
        source_id: str,
        target_id: str,
        edge_type: EdgeType,
        weight: float = 1.0,
        properties: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[KnowledgeEdge]:
        """Add an edge between two nodes."""
        if source_id not in self.nodes or target_id not in self.nodes:
            return None
        
        edge_id = self._generate_edge_id(source_id, target_id, edge_type)
        
        # Check if edge exists
        if edge_id in self.edges:
            return self.edges[edge_id]
        
        edge = KnowledgeEdge(
            id=edge_id,
            source_id=source_id,
            target_id=target_id,
            edge_type=edge_type,
            weight=weight,
            properties=properties or {},
            metadata=metadata or {},
        )
        
        self.edges[edge_id] = edge
        self._adjacency[source_id].add(edge_id)
        self._reverse_adjacency[target_id].add(edge_id)
        
        # Update edge type index
        if edge_type not in self._edge_type_index:
            self._edge_type_index[edge_type] = set()
        self._edge_type_index[edge_type].add(edge_id)
        
        return edge
    
    def get_node(self, node_id: str) -> Optional[KnowledgeNode]:
        """Get a node by ID."""
        return self.nodes.get(node_id)
    
    def get_edge(self, edge_id: str) -> Optional[KnowledgeEdge]:
        """Get an edge by ID."""
        return self.edges.get(edge_id)
    
    def get_nodes_by_type(self, node_type: NodeType) -> List[KnowledgeNode]:
        """Get all nodes of a specific type."""
        node_ids = self._type_index.get(node_type, set())
        return [self.nodes[nid] for nid in node_ids]
    
    def get_edges_by_type(self, edge_type: EdgeType) -> List[KnowledgeEdge]:
        """Get all edges of a specific type."""
        edge_ids = self._edge_type_index.get(edge_type, set())
        return [self.edges[eid] for eid in edge_ids]
    
    def get_outgoing_edges(self, node_id: str) -> List[KnowledgeEdge]:
        """Get all outgoing edges from a node."""
        edge_ids = self._adjacency.get(node_id, set())
        return [self.edges[eid] for eid in edge_ids]
    
    def get_incoming_edges(self, node_id: str) -> List[KnowledgeEdge]:
        """Get all incoming edges to a node."""
        edge_ids = self._reverse_adjacency.get(node_id, set())
        return [self.edges[eid] for eid in edge_ids]
    
    def get_neighbors(self, node_id: str, direction: str = "outgoing") -> List[KnowledgeNode]:
        """Get neighboring nodes."""
        if direction == "outgoing":
            edges = self.get_outgoing_edges(node_id)
            return [self.nodes[e.target_id] for e in edges if e.target_id in self.nodes]
        elif direction == "incoming":
            edges = self.get_incoming_edges(node_id)
            return [self.nodes[e.source_id] for e in edges if e.source_id in self.nodes]
        else:  # both
            outgoing = self.get_neighbors(node_id, "outgoing")
            incoming = self.get_neighbors(node_id, "incoming")
            seen = set()
            result = []
            for n in outgoing + incoming:
                if n.id not in seen:
                    seen.add(n.id)
                    result.append(n)
            return result
    
    def find_path(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 10
    ) -> Optional[List[KnowledgeNode]]:
        """Find a path between two nodes using BFS."""
        if source_id not in self.nodes or target_id not in self.nodes:
            return None
        
        if source_id == target_id:
            return [self.nodes[source_id]]
        
        visited = {source_id}
        queue = [(source_id, [source_id])]
        
        while queue:
            current_id, path = queue.pop(0)
            
            if len(path) > max_depth:
                continue
            
            for neighbor in self.get_neighbors(current_id, "outgoing"):
                if neighbor.id == target_id:
                    return [self.nodes[nid] for nid in path + [neighbor.id]]
                
                if neighbor.id not in visited:
                    visited.add(neighbor.id)
                    queue.append((neighbor.id, path + [neighbor.id]))
        
        return None
    
    def find_all_paths(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 5
    ) -> List[List[KnowledgeNode]]:
        """Find all paths between two nodes."""
        if source_id not in self.nodes or target_id not in self.nodes:
            return []
        
        paths = []
        stack = [(source_id, [source_id])]
        
        while stack:
            current_id, path = stack.pop()
            
            if len(path) > max_depth:
                continue
            
            if current_id == target_id:
                paths.append([self.nodes[nid] for nid in path])
                continue
            
            for neighbor in self.get_neighbors(current_id, "outgoing"):
                if neighbor.id not in path:
                    stack.append((neighbor.id, path + [neighbor.id]))
        
        return paths
    
    def get_subgraph(
        self,
        center_id: str,
        depth: int = 2,
        direction: str = "both"
    ) -> "KnowledgeGraph":
        """Extract a subgraph around a node."""
        subgraph = KnowledgeGraph(f"{self.name}_subgraph")
        
        if center_id not in self.nodes:
            return subgraph
        
        visited = set()
        queue = [(center_id, 0)]
        
        while queue:
            node_id, current_depth = queue.pop(0)
            
            if node_id in visited or current_depth > depth:
                continue
            
            visited.add(node_id)
            node = self.nodes[node_id]
            
            # Add node to subgraph
            subgraph.add_node(
                name=node.name,
                node_type=node.node_type,
                file_path=node.file_path,
                line_number=node.line_number,
                properties=node.properties,
                metadata=node.metadata,
            )
            
            # Add edges and queue neighbors
            if current_depth < depth:
                neighbors = self.get_neighbors(node_id, direction)
                for neighbor in neighbors:
                    if neighbor.id not in visited:
                        queue.append((neighbor.id, current_depth + 1))
        
        # Add edges between visited nodes
        for edge in self.edges.values():
            if edge.source_id in visited and edge.target_id in visited:
                subgraph.add_edge(
                    source_id=edge.source_id,
                    target_id=edge.target_id,
                    edge_type=edge.edge_type,
                    weight=edge.weight,
                    properties=edge.properties,
                    metadata=edge.metadata,
                )
        
        return subgraph
    
    def find_cycles(self) -> List[List[str]]:
        """Find all cycles in the graph."""
        cycles = []
        visited = set()
        rec_stack = set()
        
        def dfs(node_id: str, path: List[str]) -> None:
            visited.add(node_id)
            rec_stack.add(node_id)
            
            for neighbor in self.get_neighbors(node_id, "outgoing"):
                if neighbor.id not in visited:
                    dfs(neighbor.id, path + [neighbor.id])
                elif neighbor.id in rec_stack:
                    # Found cycle
                    cycle_start = path.index(neighbor.id) if neighbor.id in path else 0
                    cycle = path[cycle_start:] + [neighbor.id]
                    if len(cycle) > 1:
                        cycles.append(cycle)
            
            rec_stack.remove(node_id)
        
        for node_id in self.nodes:
            if node_id not in visited:
                dfs(node_id, [node_id])
        
        return cycles
    
    def compute_centrality(self) -> Dict[str, float]:
        """Compute degree centrality for all nodes."""
        centrality = {}
        total_nodes = len(self.nodes)
        
        if total_nodes <= 1:
            return {nid: 0.0 for nid in self.nodes}
        
        for node_id in self.nodes:
            in_degree = len(self._reverse_adjacency.get(node_id, set()))
            out_degree = len(self._adjacency.get(node_id, set()))
            centrality[node_id] = (in_degree + out_degree) / (2 * (total_nodes - 1))
        
        return centrality
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get graph statistics."""
        return {
            "name": self.name,
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
            "nodes_by_type": {
                t.value: len(ids) for t, ids in self._type_index.items()
            },
            "edges_by_type": {
                t.value: len(ids) for t, ids in self._edge_type_index.items()
            },
            "avg_degree": sum(len(e) for e in self._adjacency.values()) / max(len(self.nodes), 1),
            "density": (2 * len(self.edges)) / (len(self.nodes) * max(len(self.nodes) - 1, 1)) if self.nodes else 0,
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Export graph to dictionary."""
        return {
            "name": self.name,
            "metadata": self.metadata,
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "edges": [e.to_dict() for e in self.edges.values()],
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeGraph":
        """Import graph from dictionary."""
        graph = cls(data.get("name", "imported"))
        graph.metadata = data.get("metadata", {})
        
        for node_data in data.get("nodes", []):
            node = KnowledgeNode.from_dict(node_data)
            graph.nodes[node.id] = node
            graph._adjacency[node.id] = set()
            graph._reverse_adjacency[node.id] = set()
            
            if node.node_type not in graph._type_index:
                graph._type_index[node.node_type] = set()
            graph._type_index[node.node_type].add(node.id)
        
        for edge_data in data.get("edges", []):
            edge = KnowledgeEdge.from_dict(edge_data)
            graph.edges[edge.id] = edge
            
            if edge.source_id in graph._adjacency:
                graph._adjacency[edge.source_id].add(edge.id)
            if edge.target_id in graph._reverse_adjacency:
                graph._reverse_adjacency[edge.target_id].add(edge.id)
            
            if edge.edge_type not in graph._edge_type_index:
                graph._edge_type_index[edge.edge_type] = set()
            graph._edge_type_index[edge.edge_type].add(edge.id)
        
        return graph
    
    def export_json(self, file_path: str) -> None:
        """Export graph to JSON file."""
        with open(file_path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)
    
    @classmethod
    def import_json(cls, file_path: str) -> "KnowledgeGraph":
        """Import graph from JSON file."""
        with open(file_path, "r") as f:
            data = json.load(f)
        return cls.from_dict(data)
    
    def export_graphml(self, file_path: str) -> None:
        """Export graph to GraphML format."""
        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
            '  <key id="d0" for="node" attr.name="name" attr.type="string"/>',
            '  <key id="d1" for="node" attr.name="type" attr.type="string"/>',
            '  <key id="d2" for="edge" attr.name="type" attr.type="string"/>',
            f'  <graph id="{self.name}" edgedefault="directed">',
        ]
        
        for node in self.nodes.values():
            lines.append(f'    <node id="{node.id}">')
            lines.append(f'      <data key="d0">{node.name}</data>')
            lines.append(f'      <data key="d1">{node.node_type.value}</data>')
            lines.append('    </node>')
        
        for edge in self.edges.values():
            lines.append(f'    <edge id="{edge.id}" source="{edge.source_id}" target="{edge.target_id}">')
            lines.append(f'      <data key="d2">{edge.edge_type.value}</data>')
            lines.append('    </edge>')
        
        lines.append('  </graph>')
        lines.append('</graphml>')
        
        with open(file_path, "w") as f:
            f.write("\n".join(lines))
    
    def export_dot(self, file_path: str) -> None:
        """Export graph to DOT format for Graphviz."""
        lines = [f'digraph "{self.name}" {{']
        lines.append('  rankdir=LR;')
        lines.append('  node [shape=box];')
        
        # Color mapping for node types
        colors = {
            NodeType.FILE: "lightblue",
            NodeType.CLASS: "lightgreen",
            NodeType.FUNCTION: "lightyellow",
            NodeType.METHOD: "lightyellow",
            NodeType.MODULE: "lightgray",
            NodeType.INTERFACE: "lightpink",
        }
        
        for node in self.nodes.values():
            color = colors.get(node.node_type, "white")
            label = f"{node.name}\\n({node.node_type.value})"
            lines.append(f'  "{node.id}" [label="{label}" fillcolor="{color}" style="filled"];')
        
        for edge in self.edges.values():
            lines.append(f'  "{edge.source_id}" -> "{edge.target_id}" [label="{edge.edge_type.value}"];')
        
        lines.append('}')
        
        with open(file_path, "w") as f:
            f.write("\n".join(lines))
