"""
PHP language parser and analyzer.
"""

import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class PhpMethod:
    """Represents a PHP method."""
    name: str
    parameters: List[str]
    line: int
    visibility: str = "public"
    is_static: bool = False
    is_abstract: bool = False
    is_final: bool = False
    return_type: Optional[str] = None


@dataclass
class PhpClass:
    """Represents a PHP class."""
    name: str
    line: int
    namespace: str = ""
    parent: Optional[str] = None
    interfaces: List[str] = None
    traits: List[str] = None
    properties: List[str] = None
    methods: List[PhpMethod] = None
    is_abstract: bool = False
    is_final: bool = False
    
    def __post_init__(self):
        if self.interfaces is None:
            self.interfaces = []
        if self.traits is None:
            self.traits = []
        if self.properties is None:
            self.properties = []
        if self.methods is None:
            self.methods = []


class PhpParser:
    """Parser for PHP code analysis."""
    
    def __init__(self):
        self.classes: List[PhpClass] = []
        self.functions: List[PhpMethod] = []
        self.uses: List[str] = []
        self.namespaces: List[str] = []
    
    def parse(self, content: str) -> Dict[str, Any]:
        """Parse PHP code and extract structure."""
        lines = content.split('\n')
        
        self._extract_uses(lines)
        self._extract_classes(lines)
        self._extract_functions(lines)
        
        return {
            'classes': [self._class_to_dict(c) for c in self.classes],
            'functions': [self._method_to_dict(f) for f in self.functions],
            'uses': self.uses,
            'namespaces': self.namespaces,
            'metrics': self._calculate_metrics()
        }
    
    def _extract_uses(self, lines: List[str]):
        """Extract use statements."""
        use_pattern = re.compile(r'use\s+([^;]+);')
        
        for line in lines:
            match = use_pattern.search(line)
            if match:
                self.uses.append(match.group(1).strip())
    
    def _extract_classes(self, lines: List[str]):
        """Extract class definitions."""
        class_pattern = re.compile(
            r'(abstract\s+)?(final\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(.+?))?(?:\s*{)?'
        )
        
        current_namespace = ""
        namespace_pattern = re.compile(r'namespace\s+([^;]+);')
        
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
                is_abstract = match.group(1) is not None
                is_final = match.group(2) is not None
                class_name = match.group(3)
                parent = match.group(4)
                interfaces_str = match.group(5)
                
                interfaces = []
                if interfaces_str:
                    interfaces = [i.strip() for i in interfaces_str.split(',')]
                
                php_class = PhpClass(
                    name=class_name,
                    line=i + 1,
                    namespace=current_namespace,
                    parent=parent,
                    interfaces=interfaces,
                    is_abstract=is_abstract,
                    is_final=is_final
                )
                
                # Find class end
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
                
                # Extract traits, properties, and methods
                for k in range(i, min(j + 1, len(lines))):
                    class_line = lines[k].strip()
                    
                    # Extract traits
                    trait_match = re.search(r'use\s+([^;]+);', class_line)
                    if trait_match and 'class' not in lines[k-1] if k > 0 else True:
                        traits = [t.strip() for t in trait_match.group(1).split(',')]
                        php_class.traits.extend(traits)
                    
                    # Extract properties
                    prop_match = re.search(
                        r'(public|private|protected)\s+(static\s+)?(\$\w+)',
                        class_line
                    )
                    if prop_match and '(' not in class_line:
                        php_class.properties.append(prop_match.group(3))
                    
                    # Extract methods
                    method_match = re.search(
                        r'(public|private|protected)\s+(static\s+)?(abstract\s+)?(final\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?',
                        class_line
                    )
                    
                    if method_match:
                        php_class.methods.append(PhpMethod(
                            name=method_match.group(5),
                            parameters=[p.strip() for p in method_match.group(6).split(',') if p.strip()],
                            line=k + 1,
                            visibility=method_match.group(1),
                            is_static=method_match.group(2) is not None,
                            is_abstract=method_match.group(3) is not None,
                            is_final=method_match.group(4) is not None,
                            return_type=method_match.group(7)
                        ))
                
                self.classes.append(php_class)
                i = j
            
            i += 1
    
    def _extract_functions(self, lines: List[str]):
        """Extract standalone function definitions."""
        func_pattern = re.compile(r'function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?')
        
        for i, line in enumerate(lines):
            # Skip class methods
            if any(i >= c.line - 1 and i <= c.line + 100 for c in self.classes):
                continue
            
            match = func_pattern.search(line)
            if match and 'class' not in line:
                self.functions.append(PhpMethod(
                    name=match.group(1),
                    parameters=[p.strip() for p in match.group(2).split(',') if p.strip()],
                    line=i + 1,
                    return_type=match.group(3)
                ))
    
    def _calculate_metrics(self) -> Dict[str, Any]:
        """Calculate code metrics."""
        return {
            'total_classes': len(self.classes),
            'total_methods': sum(len(c.methods) for c in self.classes),
            'total_functions': len(self.functions),
            'abstract_classes': sum(1 for c in self.classes if c.is_abstract),
            'final_classes': sum(1 for c in self.classes if c.is_final),
            'classes_with_traits': sum(1 for c in self.classes if c.traits)
        }
    
    def _class_to_dict(self, php_class: PhpClass) -> Dict[str, Any]:
        """Convert PhpClass to dictionary."""
        return {
            'name': php_class.name,
            'line': php_class.line,
            'namespace': php_class.namespace,
            'parent': php_class.parent,
            'interfaces': php_class.interfaces,
            'traits': php_class.traits,
            'properties': php_class.properties,
            'methods': [self._method_to_dict(m) for m in php_class.methods],
            'is_abstract': php_class.is_abstract,
            'is_final': php_class.is_final
        }
    
    def _method_to_dict(self, method: PhpMethod) -> Dict[str, Any]:
        """Convert PhpMethod to dictionary."""
        return {
            'name': method.name,
            'parameters': method.parameters,
            'line': method.line,
            'visibility': method.visibility,
            'is_static': method.is_static,
            'is_abstract': method.is_abstract,
            'is_final': method.is_final,
            'return_type': method.return_type
        }
