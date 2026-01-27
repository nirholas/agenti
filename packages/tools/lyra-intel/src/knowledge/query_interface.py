"""
Graph Query Interface - Query knowledge graphs with natural language.

This module provides a high-level interface for querying knowledge
graphs using both structured queries and natural language.
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from .knowledge_graph import (
    KnowledgeGraph,
    KnowledgeNode,
    KnowledgeEdge,
    NodeType,
    EdgeType,
)


class QueryType(Enum):
    """Types of queries."""
    FIND_NODE = "find_node"
    FIND_EDGE = "find_edge"
    FIND_PATH = "find_path"
    FIND_PATTERN = "find_pattern"
    FIND_RELATED = "find_related"
    FIND_DEPENDENCIES = "find_dependencies"
    FIND_DEPENDENTS = "find_dependents"
    STATISTICS = "statistics"
    SUBGRAPH = "subgraph"
    CUSTOM = "custom"


@dataclass
class QueryResult:
    """Result of a graph query."""
    query_type: QueryType
    success: bool
    nodes: List[KnowledgeNode] = field(default_factory=list)
    edges: List[KnowledgeEdge] = field(default_factory=list)
    paths: List[List[KnowledgeNode]] = field(default_factory=list)
    statistics: Dict[str, Any] = field(default_factory=dict)
    message: str = ""
    execution_time_ms: float = 0.0


class GraphQueryInterface:
    """
    High-level query interface for knowledge graphs.
    
    Supports both structured queries and natural language queries.
    """
    
    def __init__(self, graph: KnowledgeGraph):
        """Initialize query interface."""
        self.graph = graph
        
        # Natural language query patterns
        self._query_patterns = [
            # Find nodes
            (r"find (?:all )?(\w+)s?(?:\s+named?\s+(\w+))?", self._find_nodes),
            (r"list (?:all )?(\w+)s?", self._find_nodes),
            (r"show (?:all )?(\w+)s?", self._find_nodes),
            (r"what (\w+)s? (?:are|exist)", self._find_nodes),
            
            # Find dependencies
            (r"what (?:does|do) (\w+) (?:depend on|import|use)", self._find_dependencies),
            (r"dependencies of (\w+)", self._find_dependencies),
            (r"imports of (\w+)", self._find_dependencies),
            
            # Find dependents
            (r"what (?:uses|imports|depends on) (\w+)", self._find_dependents),
            (r"dependents of (\w+)", self._find_dependents),
            (r"what is (\w+) used by", self._find_dependents),
            
            # Find path
            (r"path (?:from|between) (\w+) (?:to|and) (\w+)", self._find_path),
            (r"how (?:does|is) (\w+) connected to (\w+)", self._find_path),
            
            # Find related
            (r"(?:what is )?related to (\w+)", self._find_related),
            (r"neighbors of (\w+)", self._find_related),
            
            # Statistics
            (r"statistics|stats|summary|overview", self._get_statistics),
            (r"how (?:many|much)", self._get_statistics),
        ]
    
    def query(self, query_string: str) -> QueryResult:
        """
        Execute a natural language query.
        
        Args:
            query_string: Natural language query
            
        Returns:
            Query result
        """
        import time
        start_time = time.time()
        
        query_lower = query_string.lower().strip()
        
        # Try each pattern
        for pattern, handler in self._query_patterns:
            match = re.search(pattern, query_lower)
            if match:
                result = handler(match)
                result.execution_time_ms = (time.time() - start_time) * 1000
                return result
        
        # Default: search for the query string as a name
        result = self._search_by_name(query_string)
        result.execution_time_ms = (time.time() - start_time) * 1000
        return result
    
    def find_nodes(
        self,
        node_type: Optional[NodeType] = None,
        name_pattern: Optional[str] = None,
        file_pattern: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None,
        limit: int = 100,
    ) -> List[KnowledgeNode]:
        """
        Find nodes matching criteria.
        
        Args:
            node_type: Filter by node type
            name_pattern: Filter by name (regex)
            file_pattern: Filter by file path (regex)
            properties: Filter by properties
            limit: Maximum results
            
        Returns:
            List of matching nodes
        """
        results = []
        
        for node in self.graph.nodes.values():
            # Type filter
            if node_type and node.node_type != node_type:
                continue
            
            # Name filter
            if name_pattern:
                if not re.search(name_pattern, node.name, re.IGNORECASE):
                    continue
            
            # File filter
            if file_pattern and node.file_path:
                if not re.search(file_pattern, node.file_path, re.IGNORECASE):
                    continue
            
            # Properties filter
            if properties:
                match = True
                for key, value in properties.items():
                    if node.properties.get(key) != value:
                        match = False
                        break
                if not match:
                    continue
            
            results.append(node)
            
            if len(results) >= limit:
                break
        
        return results
    
    def find_edges(
        self,
        edge_type: Optional[EdgeType] = None,
        source_id: Optional[str] = None,
        target_id: Optional[str] = None,
        min_weight: float = 0.0,
        limit: int = 100,
    ) -> List[KnowledgeEdge]:
        """
        Find edges matching criteria.
        
        Args:
            edge_type: Filter by edge type
            source_id: Filter by source node
            target_id: Filter by target node
            min_weight: Minimum edge weight
            limit: Maximum results
            
        Returns:
            List of matching edges
        """
        results = []
        
        for edge in self.graph.edges.values():
            # Type filter
            if edge_type and edge.edge_type != edge_type:
                continue
            
            # Source filter
            if source_id and edge.source_id != source_id:
                continue
            
            # Target filter
            if target_id and edge.target_id != target_id:
                continue
            
            # Weight filter
            if edge.weight < min_weight:
                continue
            
            results.append(edge)
            
            if len(results) >= limit:
                break
        
        return results
    
    def find_dependencies(self, node_id: str, depth: int = 1) -> List[KnowledgeNode]:
        """
        Find all dependencies of a node.
        
        Args:
            node_id: Node to find dependencies for
            depth: How many levels to traverse
            
        Returns:
            List of dependency nodes
        """
        dependencies = set()
        to_visit = [(node_id, 0)]
        
        while to_visit:
            current_id, current_depth = to_visit.pop(0)
            
            if current_depth >= depth:
                continue
            
            for edge in self.graph.get_outgoing_edges(current_id):
                if edge.edge_type in [EdgeType.DEPENDS_ON, EdgeType.IMPORTS, EdgeType.USES_HOOK]:
                    if edge.target_id not in dependencies:
                        dependencies.add(edge.target_id)
                        to_visit.append((edge.target_id, current_depth + 1))
        
        return [self.graph.nodes[nid] for nid in dependencies if nid in self.graph.nodes]
    
    def find_dependents(self, node_id: str, depth: int = 1) -> List[KnowledgeNode]:
        """
        Find all dependents of a node.
        
        Args:
            node_id: Node to find dependents for
            depth: How many levels to traverse
            
        Returns:
            List of dependent nodes
        """
        dependents = set()
        to_visit = [(node_id, 0)]
        
        while to_visit:
            current_id, current_depth = to_visit.pop(0)
            
            if current_depth >= depth:
                continue
            
            for edge in self.graph.get_incoming_edges(current_id):
                if edge.edge_type in [EdgeType.DEPENDS_ON, EdgeType.IMPORTS, EdgeType.USES_HOOK]:
                    if edge.source_id not in dependents:
                        dependents.add(edge.source_id)
                        to_visit.append((edge.source_id, current_depth + 1))
        
        return [self.graph.nodes[nid] for nid in dependents if nid in self.graph.nodes]
    
    def find_impact(self, node_id: str, max_depth: int = 3) -> Dict[str, Any]:
        """
        Analyze the impact of changing a node.
        
        Args:
            node_id: Node to analyze
            max_depth: Maximum depth to traverse
            
        Returns:
            Impact analysis results
        """
        # Find all dependents (what would be affected)
        affected_nodes = set()
        affected_by_depth: Dict[int, Set[str]] = {}
        
        to_visit = [(node_id, 0)]
        
        while to_visit:
            current_id, current_depth = to_visit.pop(0)
            
            if current_depth > max_depth:
                continue
            
            if current_depth not in affected_by_depth:
                affected_by_depth[current_depth] = set()
            
            for edge in self.graph.get_incoming_edges(current_id):
                if edge.source_id not in affected_nodes:
                    affected_nodes.add(edge.source_id)
                    affected_by_depth[current_depth].add(edge.source_id)
                    to_visit.append((edge.source_id, current_depth + 1))
        
        return {
            "target_node": node_id,
            "total_affected": len(affected_nodes),
            "affected_by_depth": {
                d: list(nodes) for d, nodes in affected_by_depth.items()
            },
            "affected_files": list(set(
                self.graph.nodes[nid].file_path
                for nid in affected_nodes
                if nid in self.graph.nodes and self.graph.nodes[nid].file_path
            )),
            "critical_paths": len(affected_by_depth.get(1, set())),
        }
    
    def find_similar(self, node_id: str, limit: int = 10) -> List[KnowledgeNode]:
        """
        Find nodes similar to the given node.
        
        Similarity is based on:
        - Same type
        - Similar properties
        - Similar connections
        
        Args:
            node_id: Node to find similar to
            limit: Maximum results
            
        Returns:
            List of similar nodes
        """
        if node_id not in self.graph.nodes:
            return []
        
        target = self.graph.nodes[node_id]
        scores: Dict[str, float] = {}
        
        for node in self.graph.nodes.values():
            if node.id == node_id:
                continue
            
            score = 0.0
            
            # Same type bonus
            if node.node_type == target.node_type:
                score += 5.0
            
            # Same file bonus
            if node.file_path == target.file_path:
                score += 2.0
            
            # Similar properties
            common_props = set(node.properties.keys()) & set(target.properties.keys())
            for prop in common_props:
                if node.properties[prop] == target.properties[prop]:
                    score += 1.0
            
            # Similar connections
            target_neighbors = set(n.id for n in self.graph.get_neighbors(node_id, "both"))
            node_neighbors = set(n.id for n in self.graph.get_neighbors(node.id, "both"))
            common_neighbors = target_neighbors & node_neighbors
            score += len(common_neighbors) * 0.5
            
            if score > 0:
                scores[node.id] = score
        
        # Sort by score and return top results
        sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)[:limit]
        return [self.graph.nodes[nid] for nid in sorted_ids]
    
    # Natural language query handlers
    
    def _find_nodes(self, match: re.Match) -> QueryResult:
        """Handle find nodes query."""
        groups = match.groups()
        type_str = groups[0] if groups else None
        name = groups[1] if len(groups) > 1 else None
        
        # Map common words to node types
        type_map = {
            "function": NodeType.FUNCTION,
            "class": NodeType.CLASS,
            "method": NodeType.METHOD,
            "file": NodeType.FILE,
            "module": NodeType.MODULE,
            "interface": NodeType.INTERFACE,
            "variable": NodeType.VARIABLE,
            "constant": NodeType.CONSTANT,
            "import": NodeType.IMPORT,
            "test": NodeType.TEST,
            "component": NodeType.COMPONENT,
            "hook": NodeType.HOOK,
            "pattern": NodeType.PATTERN,
        }
        
        node_type = type_map.get(type_str)
        nodes = self.find_nodes(node_type=node_type, name_pattern=name)
        
        return QueryResult(
            query_type=QueryType.FIND_NODE,
            success=len(nodes) > 0,
            nodes=nodes,
            message=f"Found {len(nodes)} {type_str}(s)" if type_str else f"Found {len(nodes)} nodes",
        )
    
    def _find_dependencies(self, match: re.Match) -> QueryResult:
        """Handle find dependencies query."""
        name = match.group(1)
        
        # Find node by name
        nodes = self.find_nodes(name_pattern=f"^{name}$")
        if not nodes:
            nodes = self.find_nodes(name_pattern=name)
        
        if not nodes:
            return QueryResult(
                query_type=QueryType.FIND_DEPENDENCIES,
                success=False,
                message=f"Node '{name}' not found",
            )
        
        deps = self.find_dependencies(nodes[0].id)
        
        return QueryResult(
            query_type=QueryType.FIND_DEPENDENCIES,
            success=True,
            nodes=deps,
            message=f"Found {len(deps)} dependencies of {name}",
        )
    
    def _find_dependents(self, match: re.Match) -> QueryResult:
        """Handle find dependents query."""
        name = match.group(1)
        
        # Find node by name
        nodes = self.find_nodes(name_pattern=f"^{name}$")
        if not nodes:
            nodes = self.find_nodes(name_pattern=name)
        
        if not nodes:
            return QueryResult(
                query_type=QueryType.FIND_DEPENDENTS,
                success=False,
                message=f"Node '{name}' not found",
            )
        
        deps = self.find_dependents(nodes[0].id)
        
        return QueryResult(
            query_type=QueryType.FIND_DEPENDENTS,
            success=True,
            nodes=deps,
            message=f"Found {len(deps)} dependents of {name}",
        )
    
    def _find_path(self, match: re.Match) -> QueryResult:
        """Handle find path query."""
        source_name = match.group(1)
        target_name = match.group(2)
        
        # Find source node
        source_nodes = self.find_nodes(name_pattern=f"^{source_name}$")
        if not source_nodes:
            source_nodes = self.find_nodes(name_pattern=source_name)
        
        # Find target node
        target_nodes = self.find_nodes(name_pattern=f"^{target_name}$")
        if not target_nodes:
            target_nodes = self.find_nodes(name_pattern=target_name)
        
        if not source_nodes or not target_nodes:
            return QueryResult(
                query_type=QueryType.FIND_PATH,
                success=False,
                message="Source or target node not found",
            )
        
        path = self.graph.find_path(source_nodes[0].id, target_nodes[0].id)
        
        return QueryResult(
            query_type=QueryType.FIND_PATH,
            success=path is not None,
            paths=[path] if path else [],
            message=f"Path found with {len(path)} nodes" if path else "No path found",
        )
    
    def _find_related(self, match: re.Match) -> QueryResult:
        """Handle find related query."""
        name = match.group(1)
        
        # Find node by name
        nodes = self.find_nodes(name_pattern=f"^{name}$")
        if not nodes:
            nodes = self.find_nodes(name_pattern=name)
        
        if not nodes:
            return QueryResult(
                query_type=QueryType.FIND_RELATED,
                success=False,
                message=f"Node '{name}' not found",
            )
        
        related = self.graph.get_neighbors(nodes[0].id, "both")
        
        return QueryResult(
            query_type=QueryType.FIND_RELATED,
            success=True,
            nodes=related,
            message=f"Found {len(related)} related nodes to {name}",
        )
    
    def _get_statistics(self, match: re.Match) -> QueryResult:
        """Handle statistics query."""
        stats = self.graph.get_statistics()
        
        return QueryResult(
            query_type=QueryType.STATISTICS,
            success=True,
            statistics=stats,
            message=f"Graph has {stats['total_nodes']} nodes and {stats['total_edges']} edges",
        )
    
    def _search_by_name(self, name: str) -> QueryResult:
        """Search for nodes by name."""
        nodes = self.find_nodes(name_pattern=name)
        
        return QueryResult(
            query_type=QueryType.FIND_NODE,
            success=len(nodes) > 0,
            nodes=nodes,
            message=f"Found {len(nodes)} nodes matching '{name}'",
        )
