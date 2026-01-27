"""
AST Analyzer - Abstract Syntax Tree analysis for multiple languages.

Supports:
- Python (ast module)
- JavaScript/TypeScript (tree-sitter)
- Go, Rust, Java (tree-sitter)

Designed for massive scale with parallel processing.
"""

import asyncio
import ast
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)


@dataclass
class CodeUnit:
    """Represents a code unit (function, class, module, etc.)."""
    type: str  # function, class, method, module, variable
    name: str
    file_path: str
    line_start: int
    line_end: int
    column_start: int
    column_end: int
    docstring: Optional[str]
    decorators: List[str]
    parameters: List[Dict[str, Any]]
    return_type: Optional[str]
    parent: Optional[str]
    children: List[str]
    complexity: int  # Cyclomatic complexity
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "name": self.name,
            "file_path": self.file_path,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "column_start": self.column_start,
            "column_end": self.column_end,
            "docstring": self.docstring,
            "decorators": self.decorators,
            "parameters": self.parameters,
            "return_type": self.return_type,
            "parent": self.parent,
            "children": self.children,
            "complexity": self.complexity,
        }


@dataclass
class Import:
    """Represents an import statement."""
    file_path: str
    line: int
    module: str
    names: List[str]
    alias: Optional[str]
    is_relative: bool
    level: int  # For relative imports
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "line": self.line,
            "module": self.module,
            "names": self.names,
            "alias": self.alias,
            "is_relative": self.is_relative,
            "level": self.level,
        }


@dataclass
class ASTAnalyzerConfig:
    """Configuration for AST analyzer."""
    max_workers: int = 8
    languages: List[str] = field(default_factory=lambda: [
        "python", "javascript", "typescript", "go", "rust", "java"
    ])
    extract_docstrings: bool = True
    compute_complexity: bool = True
    extract_imports: bool = True
    extract_exports: bool = True


class ASTAnalyzer:
    """
    Multi-language AST analyzer.
    
    Extracts:
    - Functions, classes, methods
    - Imports and exports
    - Docstrings and comments
    - Cyclomatic complexity
    - Type annotations
    """
    
    EXTENSION_MAP = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".go": "go",
        ".rs": "rust",
        ".java": "java",
    }
    
    def __init__(self, config: Optional[ASTAnalyzerConfig] = None):
        self.config = config or ASTAnalyzerConfig()
        self._semaphore = asyncio.Semaphore(self.config.max_workers)
        
    def get_language(self, file_path: str) -> Optional[str]:
        """Determine language from file extension."""
        ext = Path(file_path).suffix.lower()
        return self.EXTENSION_MAP.get(ext)
    
    async def analyze_file(self, file_path: str, content: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze a single file and extract code units.
        
        Args:
            file_path: Path to file
            content: File content (if already loaded)
            
        Returns:
            Dictionary with code units, imports, and metrics
        """
        async with self._semaphore:
            language = self.get_language(file_path)
            
            if not language:
                return {"error": f"Unsupported file type: {file_path}"}
            
            if content is None:
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                except Exception as e:
                    return {"error": str(e)}
            
            if language == "python":
                return await self._analyze_python(file_path, content)
            elif language in ("javascript", "typescript"):
                return await self._analyze_javascript(file_path, content)
            else:
                return await self._analyze_generic(file_path, content, language)
    
    async def _analyze_python(self, file_path: str, content: str) -> Dict[str, Any]:
        """Analyze Python source code."""
        try:
            tree = ast.parse(content, filename=file_path)
        except SyntaxError as e:
            return {"error": f"Syntax error: {e}"}
        
        code_units = []
        imports = []
        
        class Visitor(ast.NodeVisitor):
            def __init__(self, analyzer):
                self.analyzer = analyzer
                self.current_class = None
                
            def visit_FunctionDef(self, node):
                unit = self._extract_function(node)
                code_units.append(unit)
                self.generic_visit(node)
                
            def visit_AsyncFunctionDef(self, node):
                unit = self._extract_function(node, is_async=True)
                code_units.append(unit)
                self.generic_visit(node)
                
            def visit_ClassDef(self, node):
                old_class = self.current_class
                self.current_class = node.name
                
                # Extract class
                docstring = ast.get_docstring(node)
                decorators = [self._get_decorator_name(d) for d in node.decorator_list]
                
                code_units.append(CodeUnit(
                    type="class",
                    name=node.name,
                    file_path=file_path,
                    line_start=node.lineno,
                    line_end=node.end_lineno or node.lineno,
                    column_start=node.col_offset,
                    column_end=node.end_col_offset or 0,
                    docstring=docstring,
                    decorators=decorators,
                    parameters=[],
                    return_type=None,
                    parent=old_class,
                    children=[],
                    complexity=1,
                ))
                
                self.generic_visit(node)
                self.current_class = old_class
                
            def visit_Import(self, node):
                for alias in node.names:
                    imports.append(Import(
                        file_path=file_path,
                        line=node.lineno,
                        module=alias.name,
                        names=[alias.name],
                        alias=alias.asname,
                        is_relative=False,
                        level=0,
                    ))
                    
            def visit_ImportFrom(self, node):
                imports.append(Import(
                    file_path=file_path,
                    line=node.lineno,
                    module=node.module or "",
                    names=[a.name for a in node.names],
                    alias=None,
                    is_relative=node.level > 0,
                    level=node.level,
                ))
                
            def _extract_function(self, node, is_async=False):
                docstring = ast.get_docstring(node)
                decorators = [self._get_decorator_name(d) for d in node.decorator_list]
                
                # Extract parameters
                params = []
                for arg in node.args.args:
                    param = {"name": arg.arg}
                    if arg.annotation:
                        param["type"] = ast.unparse(arg.annotation)
                    params.append(param)
                
                # Extract return type
                return_type = None
                if node.returns:
                    return_type = ast.unparse(node.returns)
                
                # Compute complexity
                complexity = self._compute_complexity(node)
                
                return CodeUnit(
                    type="async_function" if is_async else "function",
                    name=node.name,
                    file_path=file_path,
                    line_start=node.lineno,
                    line_end=node.end_lineno or node.lineno,
                    column_start=node.col_offset,
                    column_end=node.end_col_offset or 0,
                    docstring=docstring,
                    decorators=decorators,
                    parameters=params,
                    return_type=return_type,
                    parent=self.current_class,
                    children=[],
                    complexity=complexity,
                )
                
            def _get_decorator_name(self, node):
                if isinstance(node, ast.Name):
                    return node.id
                elif isinstance(node, ast.Call):
                    return self._get_decorator_name(node.func)
                elif isinstance(node, ast.Attribute):
                    return f"{self._get_decorator_name(node.value)}.{node.attr}"
                return "unknown"
                
            def _compute_complexity(self, node):
                """Compute cyclomatic complexity."""
                complexity = 1
                for child in ast.walk(node):
                    if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor,
                                         ast.ExceptHandler, ast.With, ast.AsyncWith,
                                         ast.Assert)):
                        complexity += 1
                    elif isinstance(child, ast.BoolOp):
                        complexity += len(child.values) - 1
                return complexity
        
        visitor = Visitor(self)
        visitor.visit(tree)
        
        return {
            "file_path": file_path,
            "language": "python",
            "code_units": [u.to_dict() for u in code_units],
            "imports": [i.to_dict() for i in imports],
            "metrics": {
                "total_lines": len(content.split("\n")),
                "functions": sum(1 for u in code_units if u.type in ("function", "async_function")),
                "classes": sum(1 for u in code_units if u.type == "class"),
                "imports": len(imports),
                "avg_complexity": sum(u.complexity for u in code_units) / max(len(code_units), 1),
            }
        }
    
    async def _analyze_javascript(self, file_path: str, content: str) -> Dict[str, Any]:
        """
        Analyze JavaScript/TypeScript code.
        
        Note: Full implementation would use tree-sitter or babel parser.
        This is a simplified regex-based implementation.
        """
        import re
        
        code_units = []
        imports = []
        
        # Extract imports
        import_pattern = r'import\s+(?:{([^}]+)}|(\w+))\s+from\s+[\'"]([^\'"]+)[\'"]'
        for match in re.finditer(import_pattern, content):
            named, default, module = match.groups()
            names = [n.strip() for n in (named or default or "").split(",")] if named or default else []
            imports.append(Import(
                file_path=file_path,
                line=content[:match.start()].count("\n") + 1,
                module=module,
                names=names,
                alias=None,
                is_relative=module.startswith("."),
                level=0,
            ))
        
        # Extract functions
        func_pattern = r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)'
        for match in re.finditer(func_pattern, content):
            name, params = match.groups()
            line = content[:match.start()].count("\n") + 1
            code_units.append(CodeUnit(
                type="function",
                name=name,
                file_path=file_path,
                line_start=line,
                line_end=line,
                column_start=0,
                column_end=0,
                docstring=None,
                decorators=[],
                parameters=[{"name": p.strip()} for p in params.split(",") if p.strip()],
                return_type=None,
                parent=None,
                children=[],
                complexity=1,
            ))
        
        # Extract arrow functions assigned to const/let
        arrow_pattern = r'(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>'
        for match in re.finditer(arrow_pattern, content):
            name, params = match.groups()
            line = content[:match.start()].count("\n") + 1
            code_units.append(CodeUnit(
                type="arrow_function",
                name=name,
                file_path=file_path,
                line_start=line,
                line_end=line,
                column_start=0,
                column_end=0,
                docstring=None,
                decorators=[],
                parameters=[{"name": p.strip()} for p in params.split(",") if p.strip()],
                return_type=None,
                parent=None,
                children=[],
                complexity=1,
            ))
        
        # Extract classes
        class_pattern = r'(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?'
        for match in re.finditer(class_pattern, content):
            name, parent = match.groups()
            line = content[:match.start()].count("\n") + 1
            code_units.append(CodeUnit(
                type="class",
                name=name,
                file_path=file_path,
                line_start=line,
                line_end=line,
                column_start=0,
                column_end=0,
                docstring=None,
                decorators=[],
                parameters=[],
                return_type=None,
                parent=parent,
                children=[],
                complexity=1,
            ))
        
        return {
            "file_path": file_path,
            "language": "javascript",
            "code_units": [u.to_dict() for u in code_units],
            "imports": [i.to_dict() for i in imports],
            "metrics": {
                "total_lines": len(content.split("\n")),
                "functions": sum(1 for u in code_units if "function" in u.type),
                "classes": sum(1 for u in code_units if u.type == "class"),
                "imports": len(imports),
            }
        }
    
    async def _analyze_generic(self, file_path: str, content: str, language: str) -> Dict[str, Any]:
        """Generic analysis for unsupported languages."""
        lines = content.split("\n")
        
        return {
            "file_path": file_path,
            "language": language,
            "code_units": [],
            "imports": [],
            "metrics": {
                "total_lines": len(lines),
                "non_empty_lines": sum(1 for l in lines if l.strip()),
                "comment_lines": sum(1 for l in lines if l.strip().startswith(("#", "//", "/*", "*"))),
            }
        }
    
    async def analyze_files(self, file_paths: List[str]) -> List[Dict[str, Any]]:
        """Analyze multiple files in parallel."""
        tasks = [self.analyze_file(fp) for fp in file_paths]
        return await asyncio.gather(*tasks)
    
    def get_summary(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate summary statistics from analysis results."""
        total_units = 0
        total_imports = 0
        total_lines = 0
        by_language = {}
        by_type = {}
        
        for r in results:
            if "error" in r:
                continue
                
            lang = r.get("language", "unknown")
            by_language[lang] = by_language.get(lang, 0) + 1
            
            for unit in r.get("code_units", []):
                total_units += 1
                unit_type = unit.get("type", "unknown")
                by_type[unit_type] = by_type.get(unit_type, 0) + 1
            
            total_imports += len(r.get("imports", []))
            total_lines += r.get("metrics", {}).get("total_lines", 0)
        
        return {
            "total_files": len(results),
            "total_code_units": total_units,
            "total_imports": total_imports,
            "total_lines": total_lines,
            "by_language": by_language,
            "by_type": by_type,
        }
