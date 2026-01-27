"""
Dependency Mapper - Maps relationships between code units.

Creates a comprehensive dependency graph including:
- Import/export relationships
- Function calls
- Class inheritance
- Module dependencies
"""

import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
import logging
import json

logger = logging.getLogger(__name__)


@dataclass
class Dependency:
    """Represents a dependency between two code entities."""
    source_file: str
    source_unit: Optional[str]  # Function/class name, None for file-level
    target_file: str
    target_unit: Optional[str]
    dependency_type: str  # import, call, inherit, implement
    line: int
    is_external: bool  # True if target is external package
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_file": self.source_file,
            "source_unit": self.source_unit,
            "target_file": self.target_file,
            "target_unit": self.target_unit,
            "dependency_type": self.dependency_type,
            "line": self.line,
            "is_external": self.is_external,
        }


@dataclass
class DependencyGraph:
    """Complete dependency graph for a codebase."""
    nodes: Dict[str, Dict[str, Any]]  # file_path -> metadata
    edges: List[Dependency]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": self.nodes,
            "edges": [e.to_dict() for e in self.edges],
            "stats": {
                "total_nodes": len(self.nodes),
                "total_edges": len(self.edges),
                "internal_deps": sum(1 for e in self.edges if not e.is_external),
                "external_deps": sum(1 for e in self.edges if e.is_external),
            }
        }
    
    def get_dependencies(self, file_path: str) -> List[Dependency]:
        """Get all dependencies for a file."""
        return [e for e in self.edges if e.source_file == file_path]
    
    def get_dependents(self, file_path: str) -> List[Dependency]:
        """Get all files that depend on a file."""
        return [e for e in self.edges if e.target_file == file_path]
    
    def get_circular_dependencies(self) -> List[List[str]]:
        """Find circular dependencies in the graph."""
        # Build adjacency list
        adj: Dict[str, Set[str]] = {}
        for node in self.nodes:
            adj[node] = set()
        for edge in self.edges:
            if not edge.is_external and edge.target_file in self.nodes:
                adj[edge.source_file].add(edge.target_file)
        
        # Find cycles using DFS
        cycles = []
        visited = set()
        rec_stack = set()
        path = []
        
        def dfs(node):
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in adj.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor)
                elif neighbor in rec_stack:
                    # Found cycle
                    cycle_start = path.index(neighbor)
                    cycles.append(path[cycle_start:] + [neighbor])
            
            path.pop()
            rec_stack.remove(node)
        
        for node in self.nodes:
            if node not in visited:
                dfs(node)
        
        return cycles


@dataclass
class DependencyMapperConfig:
    """Configuration for dependency mapper."""
    max_workers: int = 8
    resolve_relative_imports: bool = True
    include_external: bool = True
    external_packages: List[str] = field(default_factory=list)  # Known external packages


class DependencyMapper:
    """
    Maps dependencies between files and code units.
    
    Creates a complete graph of:
    - File-to-file imports
    - Function calls
    - Class inheritance
    - Interface implementations
    """
    
    def __init__(self, config: Optional[DependencyMapperConfig] = None):
        self.config = config or DependencyMapperConfig()
        self._semaphore = asyncio.Semaphore(self.config.max_workers)
        
    async def map_dependencies(
        self,
        ast_results: List[Dict[str, Any]],
        root_path: str
    ) -> DependencyGraph:
        """
        Build dependency graph from AST analysis results.
        
        Args:
            ast_results: Results from ASTAnalyzer
            root_path: Root path of the repository
            
        Returns:
            Complete dependency graph
        """
        root = Path(root_path).resolve()
        
        # Build node map
        nodes = {}
        for result in ast_results:
            if "error" in result:
                continue
            
            file_path = result.get("file_path", "")
            nodes[file_path] = {
                "language": result.get("language"),
                "metrics": result.get("metrics", {}),
                "code_units": [u.get("name") for u in result.get("code_units", [])],
            }
        
        # Extract edges from imports
        edges = []
        
        for result in ast_results:
            if "error" in result:
                continue
                
            source_file = result.get("file_path", "")
            
            for imp in result.get("imports", []):
                target = self._resolve_import(
                    imp.get("module", ""),
                    source_file,
                    root,
                    imp.get("is_relative", False),
                    imp.get("level", 0),
                )
                
                is_external = target is None or not (root / target).exists() if target else True
                
                for name in imp.get("names", []):
                    edges.append(Dependency(
                        source_file=source_file,
                        source_unit=None,
                        target_file=target or imp.get("module", ""),
                        target_unit=name if name != "*" else None,
                        dependency_type="import",
                        line=imp.get("line", 0),
                        is_external=is_external,
                    ))
        
        return DependencyGraph(nodes=nodes, edges=edges)
    
    def _resolve_import(
        self,
        module: str,
        source_file: str,
        root: Path,
        is_relative: bool,
        level: int
    ) -> Optional[str]:
        """Resolve import to file path."""
        if not module:
            return None
            
        source_path = Path(source_file)
        
        if is_relative:
            # Relative import
            base = source_path.parent
            # Handle level > 1 (go up directories)
            if level > 1:
                for _ in range(level - 1):
                    base = base.parent
            
            parts = module.split(".") if module else []
            target = base / "/".join(parts)
            
            # Try different extensions
            for ext in [".py", ".js", ".ts", ".tsx", "/index.py", "/index.js", "/index.ts"]:
                candidate = Path(str(target) + ext)
                if candidate.exists():
                    return str(candidate.relative_to(root))
        else:
            # Absolute import - try as local module first
            parts = module.split(".")
            
            # Try from root
            for ext in [".py", ".js", ".ts", ".tsx"]:
                candidate = root / "/".join(parts)
                candidate = Path(str(candidate) + ext)
                if candidate.exists():
                    return str(candidate.relative_to(root))
            
            # Try as package
            candidate = root / "/".join(parts) / "__init__.py"
            if candidate.exists():
                return str(candidate.relative_to(root))
        
        return None
    
    def analyze_impact(
        self,
        graph: DependencyGraph,
        changed_files: List[str]
    ) -> Dict[str, Any]:
        """
        Analyze impact of changes to files.
        
        Args:
            graph: Dependency graph
            changed_files: List of changed file paths
            
        Returns:
            Impact analysis including all affected files
        """
        affected = set(changed_files)
        direct_dependents = set()
        indirect_dependents = set()
        
        # Find direct dependents
        for changed in changed_files:
            dependents = graph.get_dependents(changed)
            for dep in dependents:
                if dep.source_file not in changed_files:
                    direct_dependents.add(dep.source_file)
        
        # Find indirect dependents (transitive)
        to_process = list(direct_dependents)
        processed = set(changed_files) | direct_dependents
        
        while to_process:
            current = to_process.pop()
            dependents = graph.get_dependents(current)
            for dep in dependents:
                if dep.source_file not in processed:
                    indirect_dependents.add(dep.source_file)
                    to_process.append(dep.source_file)
                    processed.add(dep.source_file)
        
        return {
            "changed_files": changed_files,
            "direct_dependents": list(direct_dependents),
            "indirect_dependents": list(indirect_dependents),
            "total_affected": len(affected | direct_dependents | indirect_dependents),
            "impact_score": len(direct_dependents) + 0.5 * len(indirect_dependents),
        }
    
    def export_graphviz(self, graph: DependencyGraph) -> str:
        """Export graph in Graphviz DOT format."""
        lines = ["digraph dependencies {"]
        lines.append("  rankdir=LR;")
        lines.append("  node [shape=box];")
        
        # Add nodes
        for node in graph.nodes:
            # Shorten path for readability
            label = Path(node).name
            lines.append(f'  "{node}" [label="{label}"];')
        
        # Add edges
        for edge in graph.edges:
            if not edge.is_external:
                style = ""
                if edge.dependency_type == "import":
                    style = ""
                elif edge.dependency_type == "inherit":
                    style = '[style=dashed]'
                lines.append(f'  "{edge.source_file}" -> "{edge.target_file}" {style};')
        
        lines.append("}")
        return "\n".join(lines)
    
    def export_json(self, graph: DependencyGraph) -> str:
        """Export graph as JSON."""
        return json.dumps(graph.to_dict(), indent=2)
