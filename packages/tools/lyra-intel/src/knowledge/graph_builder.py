"""
Graph Builder - Build knowledge graphs from code analysis results.

This module takes analysis results and constructs a comprehensive
knowledge graph representing the codebase structure and relationships.
"""

import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from .knowledge_graph import (
    KnowledgeGraph,
    KnowledgeNode,
    NodeType,
    EdgeType,
)


@dataclass
class GraphBuilderConfig:
    """Configuration for graph building."""
    include_imports: bool = True
    include_calls: bool = True
    include_inheritance: bool = True
    include_type_refs: bool = True
    include_comments: bool = False
    include_tests: bool = True
    max_file_depth: int = 10
    languages: List[str] = field(default_factory=lambda: ["python", "javascript", "typescript"])


class GraphBuilder:
    """
    Builds knowledge graphs from code analysis results.
    
    Takes AST analysis, dependency mapping, and pattern detection
    results to create a comprehensive knowledge graph.
    """
    
    def __init__(self, config: Optional[GraphBuilderConfig] = None):
        """Initialize graph builder."""
        self.config = config or GraphBuilderConfig()
        self.graph = KnowledgeGraph("codebase")
    
    def build_from_analysis(
        self,
        files: List[Dict[str, Any]],
        ast_results: List[Dict[str, Any]],
        dependencies: Optional[Dict[str, Any]] = None,
        patterns: Optional[List[Dict[str, Any]]] = None,
    ) -> KnowledgeGraph:
        """
        Build knowledge graph from analysis results.
        
        Args:
            files: List of file metadata
            ast_results: AST analysis results
            dependencies: Dependency analysis results
            patterns: Pattern detection results
            
        Returns:
            Constructed knowledge graph
        """
        self.graph = KnowledgeGraph("codebase")
        
        # Step 1: Add file nodes
        file_nodes = self._add_file_nodes(files)
        
        # Step 2: Add code unit nodes from AST
        code_unit_nodes = self._add_code_units(ast_results)
        
        # Step 3: Add containment relationships (file contains code units)
        self._add_containment_edges(file_nodes, code_unit_nodes, ast_results)
        
        # Step 4: Add import/dependency relationships
        if self.config.include_imports and dependencies:
            self._add_dependency_edges(dependencies)
        
        # Step 5: Add import edges from AST
        if self.config.include_imports:
            self._add_import_edges(ast_results)
        
        # Step 6: Add inheritance/implementation edges
        if self.config.include_inheritance:
            self._add_inheritance_edges(ast_results)
        
        # Step 7: Add call edges
        if self.config.include_calls:
            self._add_call_edges(ast_results)
        
        # Step 8: Add pattern nodes if available
        if patterns:
            self._add_pattern_nodes(patterns)
        
        return self.graph
    
    def _add_file_nodes(self, files: List[Dict[str, Any]]) -> Dict[str, KnowledgeNode]:
        """Add file nodes to the graph."""
        file_nodes = {}
        
        for file_info in files:
            path = file_info.get("path", file_info.get("file_path", ""))
            name = Path(path).name
            extension = file_info.get("extension", Path(path).suffix)
            
            # Determine node type based on file
            node_type = NodeType.FILE
            if extension in [".test.ts", ".test.js", ".spec.ts", ".spec.js", "_test.py", "test_"]:
                node_type = NodeType.TEST
            elif name in ["config.py", "config.ts", "config.js", ".env"]:
                node_type = NodeType.CONFIG
            
            node = self.graph.add_node(
                name=name,
                node_type=node_type,
                file_path=path,
                properties={
                    "extension": extension,
                    "size_bytes": file_info.get("size_bytes", 0),
                    "line_count": file_info.get("line_count", 0),
                    "language": file_info.get("language", self._detect_language(extension)),
                },
            )
            
            file_nodes[path] = node
        
        return file_nodes
    
    def _add_code_units(self, ast_results: List[Dict[str, Any]]) -> Dict[str, KnowledgeNode]:
        """Add code unit nodes from AST analysis."""
        code_unit_nodes = {}
        
        for result in ast_results:
            if "error" in result:
                continue
            
            file_path = result.get("file_path", "")
            
            for unit in result.get("code_units", []):
                unit_type = unit.get("type", "function")
                unit_name = unit.get("name", "unknown")
                
                # Map AST type to NodeType
                node_type_map = {
                    "function": NodeType.FUNCTION,
                    "class": NodeType.CLASS,
                    "method": NodeType.METHOD,
                    "variable": NodeType.VARIABLE,
                    "constant": NodeType.CONSTANT,
                    "interface": NodeType.INTERFACE,
                    "type": NodeType.TYPE,
                    "enum": NodeType.ENUM,
                    "component": NodeType.COMPONENT,
                    "hook": NodeType.HOOK,
                }
                
                node_type = node_type_map.get(unit_type, NodeType.FUNCTION)
                
                node = self.graph.add_node(
                    name=unit_name,
                    node_type=node_type,
                    file_path=file_path,
                    line_number=unit.get("start_line"),
                    end_line=unit.get("end_line"),
                    properties={
                        "parameters": unit.get("parameters", []),
                        "return_type": unit.get("return_type"),
                        "decorators": unit.get("decorators", []),
                        "is_async": unit.get("is_async", False),
                        "visibility": unit.get("visibility", "public"),
                        "docstring": unit.get("docstring"),
                    },
                )
                
                key = f"{file_path}::{unit_name}"
                code_unit_nodes[key] = node
        
        return code_unit_nodes
    
    def _add_containment_edges(
        self,
        file_nodes: Dict[str, KnowledgeNode],
        code_unit_nodes: Dict[str, KnowledgeNode],
        ast_results: List[Dict[str, Any]],
    ) -> None:
        """Add containment edges (file contains code units)."""
        for result in ast_results:
            if "error" in result:
                continue
            
            file_path = result.get("file_path", "")
            file_node = file_nodes.get(file_path)
            
            if not file_node:
                continue
            
            for unit in result.get("code_units", []):
                unit_name = unit.get("name", "unknown")
                key = f"{file_path}::{unit_name}"
                code_unit_node = code_unit_nodes.get(key)
                
                if code_unit_node:
                    self.graph.add_edge(
                        source_id=file_node.id,
                        target_id=code_unit_node.id,
                        edge_type=EdgeType.CONTAINS,
                    )
    
    def _add_dependency_edges(self, dependencies: Dict[str, Any]) -> None:
        """Add dependency edges from dependency analysis."""
        dep_graph = dependencies.get("graph", {})
        
        for source_file, targets in dep_graph.items():
            source_node = self._get_or_create_file_node(source_file)
            
            for target_file in targets:
                target_node = self._get_or_create_file_node(target_file)
                
                self.graph.add_edge(
                    source_id=source_node.id,
                    target_id=target_node.id,
                    edge_type=EdgeType.DEPENDS_ON,
                )
    
    def _add_import_edges(self, ast_results: List[Dict[str, Any]]) -> None:
        """Add import edges from AST analysis."""
        for result in ast_results:
            if "error" in result:
                continue
            
            file_path = result.get("file_path", "")
            file_node = self._get_or_create_file_node(file_path)
            
            for imp in result.get("imports", []):
                module_name = imp.get("module", imp.get("from", ""))
                
                # Create import node
                import_node = self.graph.add_node(
                    name=module_name,
                    node_type=NodeType.IMPORT,
                    file_path=file_path,
                    line_number=imp.get("line"),
                    properties={
                        "names": imp.get("names", []),
                        "alias": imp.get("alias"),
                        "is_relative": imp.get("is_relative", False),
                    },
                )
                
                self.graph.add_edge(
                    source_id=file_node.id,
                    target_id=import_node.id,
                    edge_type=EdgeType.IMPORTS,
                )
    
    def _add_inheritance_edges(self, ast_results: List[Dict[str, Any]]) -> None:
        """Add inheritance/implementation edges."""
        # Build class index
        class_index: Dict[str, KnowledgeNode] = {}
        
        for result in ast_results:
            if "error" in result:
                continue
            
            file_path = result.get("file_path", "")
            
            for unit in result.get("code_units", []):
                if unit.get("type") == "class":
                    class_name = unit.get("name", "")
                    key = f"{file_path}::{class_name}"
                    
                    # Find the node
                    for node in self.graph.get_nodes_by_type(NodeType.CLASS):
                        if node.name == class_name and node.file_path == file_path:
                            class_index[class_name] = node
                            break
        
        # Add inheritance edges
        for result in ast_results:
            if "error" in result:
                continue
            
            file_path = result.get("file_path", "")
            
            for unit in result.get("code_units", []):
                if unit.get("type") != "class":
                    continue
                
                class_name = unit.get("name", "")
                bases = unit.get("bases", [])
                implements = unit.get("implements", [])
                
                child_node = class_index.get(class_name)
                if not child_node:
                    continue
                
                # Add extends edges
                for base in bases:
                    base_name = base if isinstance(base, str) else base.get("name", "")
                    parent_node = class_index.get(base_name)
                    
                    if parent_node:
                        self.graph.add_edge(
                            source_id=child_node.id,
                            target_id=parent_node.id,
                            edge_type=EdgeType.EXTENDS,
                        )
                
                # Add implements edges
                for interface in implements:
                    interface_name = interface if isinstance(interface, str) else interface.get("name", "")
                    
                    # Create interface node if needed
                    interface_node = self.graph.add_node(
                        name=interface_name,
                        node_type=NodeType.INTERFACE,
                    )
                    
                    self.graph.add_edge(
                        source_id=child_node.id,
                        target_id=interface_node.id,
                        edge_type=EdgeType.IMPLEMENTS,
                    )
    
    def _add_call_edges(self, ast_results: List[Dict[str, Any]]) -> None:
        """Add function call edges."""
        # Build function index
        function_index: Dict[str, KnowledgeNode] = {}
        
        for node in self.graph.get_nodes_by_type(NodeType.FUNCTION):
            function_index[node.name] = node
        
        for node in self.graph.get_nodes_by_type(NodeType.METHOD):
            function_index[node.name] = node
        
        # Add call edges from references
        for result in ast_results:
            if "error" in result:
                continue
            
            file_path = result.get("file_path", "")
            
            for unit in result.get("code_units", []):
                unit_name = unit.get("name", "")
                
                # Find caller node
                caller_node = None
                for node in self.graph.nodes.values():
                    if node.name == unit_name and node.file_path == file_path:
                        caller_node = node
                        break
                
                if not caller_node:
                    continue
                
                # Add edges for references/calls
                for ref in unit.get("references", []):
                    ref_name = ref if isinstance(ref, str) else ref.get("name", "")
                    callee_node = function_index.get(ref_name)
                    
                    if callee_node and callee_node.id != caller_node.id:
                        self.graph.add_edge(
                            source_id=caller_node.id,
                            target_id=callee_node.id,
                            edge_type=EdgeType.CALLS,
                        )
    
    def _add_pattern_nodes(self, patterns: List[Dict[str, Any]]) -> None:
        """Add pattern detection nodes."""
        for pattern in patterns:
            pattern_name = pattern.get("pattern", pattern.get("name", "unknown"))
            category = pattern.get("category", "unknown")
            
            pattern_node = self.graph.add_node(
                name=pattern_name,
                node_type=NodeType.PATTERN,
                file_path=pattern.get("file_path"),
                line_number=pattern.get("line_number"),
                properties={
                    "category": category,
                    "severity": pattern.get("severity", "info"),
                    "description": pattern.get("description", ""),
                    "confidence": pattern.get("confidence", 1.0),
                },
            )
            
            # Link pattern to file
            if pattern.get("file_path"):
                file_node = self._get_or_create_file_node(pattern["file_path"])
                self.graph.add_edge(
                    source_id=file_node.id,
                    target_id=pattern_node.id,
                    edge_type=EdgeType.CONTAINS,
                )
    
    def _get_or_create_file_node(self, file_path: str) -> KnowledgeNode:
        """Get existing file node or create new one."""
        # Check existing nodes
        for node in self.graph.get_nodes_by_type(NodeType.FILE):
            if node.file_path == file_path:
                return node
        
        # Create new node
        return self.graph.add_node(
            name=Path(file_path).name,
            node_type=NodeType.FILE,
            file_path=file_path,
        )
    
    def _detect_language(self, extension: str) -> str:
        """Detect language from file extension."""
        language_map = {
            ".py": "python",
            ".js": "javascript",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".jsx": "javascript",
            ".go": "go",
            ".rs": "rust",
            ".java": "java",
            ".rb": "ruby",
            ".php": "php",
            ".c": "c",
            ".cpp": "cpp",
            ".h": "c",
            ".hpp": "cpp",
            ".cs": "csharp",
            ".swift": "swift",
            ".kt": "kotlin",
            ".scala": "scala",
        }
        return language_map.get(extension.lower(), "unknown")
    
    def add_concept(
        self,
        name: str,
        related_nodes: List[str],
        description: str = "",
    ) -> KnowledgeNode:
        """Add a concept node linked to code elements."""
        concept_node = self.graph.add_node(
            name=name,
            node_type=NodeType.CONCEPT,
            properties={
                "description": description,
            },
        )
        
        for node_id in related_nodes:
            if node_id in self.graph.nodes:
                self.graph.add_edge(
                    source_id=concept_node.id,
                    target_id=node_id,
                    edge_type=EdgeType.RELATED_TO,
                )
        
        return concept_node
    
    def merge_graphs(self, other: KnowledgeGraph) -> KnowledgeGraph:
        """Merge another graph into this one."""
        for node in other.nodes.values():
            self.graph.add_node(
                name=node.name,
                node_type=node.node_type,
                file_path=node.file_path,
                line_number=node.line_number,
                end_line=node.end_line,
                properties=node.properties,
                metadata=node.metadata,
            )
        
        for edge in other.edges.values():
            self.graph.add_edge(
                source_id=edge.source_id,
                target_id=edge.target_id,
                edge_type=edge.edge_type,
                weight=edge.weight,
                properties=edge.properties,
                metadata=edge.metadata,
            )
        
        return self.graph
