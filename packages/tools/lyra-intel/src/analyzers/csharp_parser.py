"""
C# language parser and analyzer.
"""

import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class CSharpProperty:
    """Represents a C# property."""
    name: str
    type: str
    line: int
    has_getter: bool = True
    has_setter: bool = True
    visibility: str = "public"


@dataclass
class CSharpMethod:
    """Represents a C# method."""
    name: str
    return_type: str
    parameters: List[str]
    line: int
    is_async: bool = False
    is_static: bool = False
    visibility: str = "public"


@dataclass
class CSharpClass:
    """Represents a C# class."""
    name: str
    line: int
    namespace: str
    base_class: Optional[str] = None
    interfaces: List[str] = None
    properties: List[CSharpProperty] = None
    methods: List[CSharpMethod] = None
    is_abstract: bool = False
    is_sealed: bool = False
    is_static: bool = False
    
    def __post_init__(self):
        if self.interfaces is None:
            self.interfaces = []
        if self.properties is None:
            self.properties = []
        if self.methods is None:
            self.methods = []


class CSharpParser:
    """Parser for C# code analysis."""
    
    def __init__(self):
        self.classes: List[CSharpClass] = []
        self.usings: List[str] = []
        self.namespaces: List[str] = []
    
    def parse(self, content: str) -> Dict[str, Any]:
        """Parse C# code and extract structure."""
        lines = content.split('\n')
        
        self._extract_usings(lines)
        self._extract_classes(lines)
        
        return {
            'classes': [self._class_to_dict(c) for c in self.classes],
            'usings': self.usings,
            'namespaces': self.namespaces,
            'metrics': self._calculate_metrics()
        }
    
    def _extract_usings(self, lines: List[str]):
        """Extract using statements."""
        using_pattern = re.compile(r'using\s+([^;]+);')
        
        for line in lines:
            match = using_pattern.search(line)
            if match:
                self.usings.append(match.group(1).strip())
    
    def _extract_classes(self, lines: List[str]):
        """Extract class definitions."""
        class_pattern = re.compile(
            r'(public|private|internal|protected)?\s*(abstract|sealed|static)?\s*class\s+(\w+)(?:\s*:\s*(.+?))?(?:\s*{)?'
        )
        
        current_namespace = ""
        namespace_pattern = re.compile(r'namespace\s+([^\s{]+)')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Track namespace
            ns_match = namespace_pattern.search(line)
            if ns_match:
                current_namespace = ns_match.group(1)
                if current_namespace not in self.namespaces:
                    self.namespaces.append(current_namespace)
            
            # Match class
            match = class_pattern.search(line)
            if match:
                visibility = match.group(1) or "internal"
                modifiers = match.group(2) or ""
                class_name = match.group(3)
                inheritance = match.group(4)
                
                base_class = None
                interfaces = []
                
                if inheritance:
                    parts = [p.strip() for p in inheritance.split(',')]
                    # First part could be base class or interface
                    if parts:
                        # Simple heuristic: interfaces usually start with 'I'
                        if parts[0].startswith('I') and len(parts[0]) > 1 and parts[0][1].isupper():
                            interfaces.append(parts[0])
                        else:
                            base_class = parts[0]
                        
                        interfaces.extend(parts[1:])
                
                csharp_class = CSharpClass(
                    name=class_name,
                    line=i + 1,
                    namespace=current_namespace,
                    base_class=base_class,
                    interfaces=interfaces,
                    is_abstract='abstract' in modifiers,
                    is_sealed='sealed' in modifiers,
                    is_static='static' in modifiers
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
                
                # Parse properties and methods
                for k in range(i, min(j + 1, len(lines))):
                    class_line = lines[k].strip()
                    
                    # Extract properties
                    prop_match = re.search(
                        r'(public|private|protected|internal)\s+(static\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*{\s*get;?\s*(?:set;?)?\s*}',
                        class_line
                    )
                    
                    if prop_match:
                        csharp_class.properties.append(CSharpProperty(
                            name=prop_match.group(4),
                            type=prop_match.group(3),
                            line=k + 1,
                            visibility=prop_match.group(1),
                            has_getter=True,
                            has_setter='set' in class_line
                        ))
                    
                    # Extract methods
                    method_match = re.search(
                        r'(public|private|protected|internal)\s+(static\s+)?(async\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)',
                        class_line
                    )
                    
                    if method_match and not prop_match:
                        csharp_class.methods.append(CSharpMethod(
                            name=method_match.group(5),
                            return_type=method_match.group(4),
                            parameters=[p.strip() for p in method_match.group(6).split(',') if p.strip()],
                            line=k + 1,
                            visibility=method_match.group(1),
                            is_static=method_match.group(2) is not None,
                            is_async=method_match.group(3) is not None
                        ))
                
                self.classes.append(csharp_class)
                i = j
            
            i += 1
    
    def _calculate_metrics(self) -> Dict[str, Any]:
        """Calculate code metrics."""
        return {
            'total_classes': len(self.classes),
            'total_properties': sum(len(c.properties) for c in self.classes),
            'total_methods': sum(len(c.methods) for c in self.classes),
            'async_methods': sum(sum(1 for m in c.methods if m.is_async) for c in self.classes),
            'abstract_classes': sum(1 for c in self.classes if c.is_abstract),
            'sealed_classes': sum(1 for c in self.classes if c.is_sealed)
        }
    
    def _class_to_dict(self, csharp_class: CSharpClass) -> Dict[str, Any]:
        """Convert CSharpClass to dictionary."""
        return {
            'name': csharp_class.name,
            'line': csharp_class.line,
            'namespace': csharp_class.namespace,
            'base_class': csharp_class.base_class,
            'interfaces': csharp_class.interfaces,
            'properties': [self._property_to_dict(p) for p in csharp_class.properties],
            'methods': [self._method_to_dict(m) for m in csharp_class.methods],
            'is_abstract': csharp_class.is_abstract,
            'is_sealed': csharp_class.is_sealed,
            'is_static': csharp_class.is_static
        }
    
    def _property_to_dict(self, prop: CSharpProperty) -> Dict[str, Any]:
        """Convert CSharpProperty to dictionary."""
        return {
            'name': prop.name,
            'type': prop.type,
            'line': prop.line,
            'has_getter': prop.has_getter,
            'has_setter': prop.has_setter,
            'visibility': prop.visibility
        }
    
    def _method_to_dict(self, method: CSharpMethod) -> Dict[str, Any]:
        """Convert CSharpMethod to dictionary."""
        return {
            'name': method.name,
            'return_type': method.return_type,
            'parameters': method.parameters,
            'line': method.line,
            'is_async': method.is_async,
            'is_static': method.is_static,
            'visibility': method.visibility
        }
