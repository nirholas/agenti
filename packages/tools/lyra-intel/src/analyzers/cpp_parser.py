"""
C++ language parser and analyzer.
"""

import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class CppFunction:
    """Represents a C++ function."""
    name: str
    return_type: str
    parameters: List[str]
    line: int
    is_method: bool = False
    is_virtual: bool = False
    is_const: bool = False
    visibility: str = "public"


@dataclass
class CppClass:
    """Represents a C++ class."""
    name: str
    line: int
    bases: List[str]
    methods: List[CppFunction]
    members: List[str]
    is_template: bool = False


class CppParser:
    """Parser for C++ code analysis."""
    
    def __init__(self):
        self.classes: List[CppClass] = []
        self.functions: List[CppFunction] = []
        self.includes: List[str] = []
        self.namespaces: List[str] = []
    
    def parse(self, content: str) -> Dict[str, Any]:
        """Parse C++ code and extract structure."""
        lines = content.split('\n')
        
        self._extract_includes(lines)
        self._extract_namespaces(lines)
        self._extract_classes(lines)
        self._extract_functions(lines)
        
        return {
            'classes': [self._class_to_dict(c) for c in self.classes],
            'functions': [self._function_to_dict(f) for f in self.functions],
            'includes': self.includes,
            'namespaces': self.namespaces,
            'metrics': self._calculate_metrics()
        }
    
    def _extract_includes(self, lines: List[str]):
        """Extract #include statements."""
        include_pattern = re.compile(r'#include\s+[<"]([^>"]+)[>"]')
        
        for line in lines:
            match = include_pattern.search(line)
            if match:
                self.includes.append(match.group(1))
    
    def _extract_namespaces(self, lines: List[str]):
        """Extract namespace declarations."""
        namespace_pattern = re.compile(r'namespace\s+(\w+)')
        
        for line in lines:
            match = namespace_pattern.search(line)
            if match:
                self.namespaces.append(match.group(1))
    
    def _extract_classes(self, lines: List[str]):
        """Extract class definitions."""
        class_pattern = re.compile(r'(?:template\s*<[^>]+>\s*)?class\s+(\w+)(?:\s*:\s*(.+?))?(?:\s*{)?')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            match = class_pattern.search(line)
            
            if match:
                class_name = match.group(1)
                bases = []
                
                if match.group(2):
                    bases = [b.strip() for b in match.group(2).split(',')]
                    bases = [re.sub(r'^(public|private|protected)\s+', '', b) for b in bases]
                
                is_template = 'template' in lines[i - 1] if i > 0 else False
                
                cpp_class = CppClass(
                    name=class_name,
                    line=i + 1,
                    bases=bases,
                    methods=[],
                    members=[],
                    is_template=is_template
                )
                
                # Extract class body
                brace_count = 0
                j = i
                started = False
                
                while j < len(lines):
                    if '{' in lines[j]:
                        started = True
                        brace_count += lines[j].count('{')
                    if '}' in lines[j]:
                        brace_count -= lines[j].count('}')
                    
                    if started and brace_count == 0:
                        break
                    j += 1
                
                # Parse methods and members
                current_visibility = "private"  # default for class
                for k in range(i, min(j + 1, len(lines))):
                    method_line = lines[k].strip()
                    
                    # Check visibility
                    if method_line.startswith('public:'):
                        current_visibility = "public"
                    elif method_line.startswith('private:'):
                        current_visibility = "private"
                    elif method_line.startswith('protected:'):
                        current_visibility = "protected"
                    
                    # Extract methods
                    method_match = re.search(
                        r'(virtual\s+)?(\w+(?:\s*<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*(const)?\s*(override)?',
                        method_line
                    )
                    
                    if method_match and '{' in method_line or ';' in method_line:
                        is_virtual = method_match.group(1) is not None
                        return_type = method_match.group(2)
                        method_name = method_match.group(3)
                        params = [p.strip() for p in method_match.group(4).split(',') if p.strip()]
                        is_const = method_match.group(5) is not None
                        
                        cpp_class.methods.append(CppFunction(
                            name=method_name,
                            return_type=return_type,
                            parameters=params,
                            line=k + 1,
                            is_method=True,
                            is_virtual=is_virtual,
                            is_const=is_const,
                            visibility=current_visibility
                        ))
                
                self.classes.append(cpp_class)
                i = j
            
            i += 1
    
    def _extract_functions(self, lines: List[str]):
        """Extract standalone function definitions."""
        func_pattern = re.compile(r'(\w+(?:\s*<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*{')
        
        for i, line in enumerate(lines):
            # Skip class methods
            if any(i >= c.line - 1 and i <= c.line + 50 for c in self.classes):
                continue
            
            match = func_pattern.search(line)
            if match:
                self.functions.append(CppFunction(
                    name=match.group(2),
                    return_type=match.group(1),
                    parameters=[p.strip() for p in match.group(3).split(',') if p.strip()],
                    line=i + 1,
                    is_method=False
                ))
    
    def _calculate_metrics(self) -> Dict[str, Any]:
        """Calculate code metrics."""
        return {
            'total_classes': len(self.classes),
            'total_functions': len(self.functions),
            'total_methods': sum(len(c.methods) for c in self.classes),
            'total_includes': len(self.includes),
            'inheritance_depth': self._max_inheritance_depth(),
            'template_classes': sum(1 for c in self.classes if c.is_template)
        }
    
    def _max_inheritance_depth(self) -> int:
        """Calculate maximum inheritance depth."""
        if not self.classes:
            return 0
        
        class_map = {c.name: c for c in self.classes}
        
        def get_depth(class_name: str, visited: set) -> int:
            if class_name in visited or class_name not in class_map:
                return 0
            
            visited.add(class_name)
            cpp_class = class_map[class_name]
            
            if not cpp_class.bases:
                return 1
            
            return 1 + max((get_depth(base, visited.copy()) for base in cpp_class.bases), default=0)
        
        return max((get_depth(c.name, set()) for c in self.classes), default=0)
    
    def _class_to_dict(self, cpp_class: CppClass) -> Dict[str, Any]:
        """Convert CppClass to dictionary."""
        return {
            'name': cpp_class.name,
            'line': cpp_class.line,
            'bases': cpp_class.bases,
            'methods': [self._function_to_dict(m) for m in cpp_class.methods],
            'method_count': len(cpp_class.methods),
            'is_template': cpp_class.is_template
        }
    
    def _function_to_dict(self, func: CppFunction) -> Dict[str, Any]:
        """Convert CppFunction to dictionary."""
        return {
            'name': func.name,
            'return_type': func.return_type,
            'parameters': func.parameters,
            'line': func.line,
            'is_method': func.is_method,
            'is_virtual': func.is_virtual,
            'is_const': func.is_const,
            'visibility': func.visibility
        }
