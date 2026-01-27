"""
Ruby language parser and analyzer.
"""

import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class RubyMethod:
    """Represents a Ruby method."""
    name: str
    parameters: List[str]
    line: int
    is_class_method: bool = False
    visibility: str = "public"


@dataclass
class RubyClass:
    """Represents a Ruby class."""
    name: str
    line: int
    parent: Optional[str] = None
    modules: List[str] = None
    methods: List[RubyMethod] = None
    
    def __post_init__(self):
        if self.modules is None:
            self.modules = []
        if self.methods is None:
            self.methods = []


@dataclass
class RubyModule:
    """Represents a Ruby module."""
    name: str
    line: int
    methods: List[RubyMethod] = None
    
    def __post_init__(self):
        if self.methods is None:
            self.methods = []


class RubyParser:
    """Parser for Ruby code analysis."""
    
    def __init__(self):
        self.classes: List[RubyClass] = []
        self.modules: List[RubyModule] = []
        self.requires: List[str] = []
    
    def parse(self, content: str) -> Dict[str, Any]:
        """Parse Ruby code and extract structure."""
        lines = content.split('\n')
        
        self._extract_requires(lines)
        self._extract_modules(lines)
        self._extract_classes(lines)
        
        return {
            'classes': [self._class_to_dict(c) for c in self.classes],
            'modules': [self._module_to_dict(m) for m in self.modules],
            'requires': self.requires,
            'metrics': self._calculate_metrics()
        }
    
    def _extract_requires(self, lines: List[str]):
        """Extract require statements."""
        require_pattern = re.compile(r"require\s+['\"]([^'\"]+)['\"]")
        
        for line in lines:
            match = require_pattern.search(line)
            if match:
                self.requires.append(match.group(1))
    
    def _extract_modules(self, lines: List[str]):
        """Extract module definitions."""
        module_pattern = re.compile(r'module\s+(\w+(?:::\w+)*)')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            match = module_pattern.search(line)
            
            if match:
                module_name = match.group(1)
                ruby_module = RubyModule(name=module_name, line=i + 1)
                
                # Find module end
                j = i + 1
                indent_level = len(lines[i]) - len(lines[i].lstrip())
                
                while j < len(lines):
                    if lines[j].strip() == 'end':
                        current_indent = len(lines[j]) - len(lines[j].lstrip())
                        if current_indent <= indent_level:
                            break
                    j += 1
                
                # Extract methods
                ruby_module.methods = self._extract_methods_from_block(lines, i, j)
                
                self.modules.append(ruby_module)
                i = j
            
            i += 1
    
    def _extract_classes(self, lines: List[str]):
        """Extract class definitions."""
        class_pattern = re.compile(r'class\s+(\w+)(?:\s*<\s*(\w+(?:::\w+)*))?')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            match = class_pattern.search(line)
            
            if match:
                class_name = match.group(1)
                parent = match.group(2)
                
                ruby_class = RubyClass(
                    name=class_name,
                    line=i + 1,
                    parent=parent
                )
                
                # Find class end
                j = i + 1
                indent_level = len(lines[i]) - len(lines[i].lstrip())
                
                while j < len(lines):
                    if lines[j].strip() == 'end':
                        current_indent = len(lines[j]) - len(lines[j].lstrip())
                        if current_indent <= indent_level:
                            break
                    j += 1
                
                # Extract included modules
                for k in range(i, j):
                    include_match = re.search(r'include\s+(\w+(?:::\w+)*)', lines[k])
                    if include_match:
                        ruby_class.modules.append(include_match.group(1))
                
                # Extract methods
                ruby_class.methods = self._extract_methods_from_block(lines, i, j)
                
                self.classes.append(ruby_class)
                i = j
            
            i += 1
    
    def _extract_methods_from_block(self, lines: List[str], start: int, end: int) -> List[RubyMethod]:
        """Extract methods from a code block."""
        methods = []
        method_pattern = re.compile(r'def\s+(self\.)?(\w+[!?]?)(?:\s*\(([^)]*)\))?')
        
        current_visibility = "public"
        
        for i in range(start, min(end, len(lines))):
            line = lines[i].strip()
            
            # Track visibility
            if line in ['private', 'protected', 'public']:
                current_visibility = line
                continue
            
            match = method_pattern.search(line)
            if match:
                is_class_method = match.group(1) is not None
                method_name = match.group(2)
                params_str = match.group(3) or ""
                parameters = [p.strip() for p in params_str.split(',') if p.strip()]
                
                methods.append(RubyMethod(
                    name=method_name,
                    parameters=parameters,
                    line=i + 1,
                    is_class_method=is_class_method,
                    visibility=current_visibility
                ))
        
        return methods
    
    def _calculate_metrics(self) -> Dict[str, Any]:
        """Calculate code metrics."""
        return {
            'total_classes': len(self.classes),
            'total_modules': len(self.modules),
            'total_methods': sum(len(c.methods) for c in self.classes) + sum(len(m.methods) for m in self.modules),
            'total_requires': len(self.requires),
            'classes_with_inheritance': sum(1 for c in self.classes if c.parent),
            'classes_with_mixins': sum(1 for c in self.classes if c.modules)
        }
    
    def _class_to_dict(self, ruby_class: RubyClass) -> Dict[str, Any]:
        """Convert RubyClass to dictionary."""
        return {
            'name': ruby_class.name,
            'line': ruby_class.line,
            'parent': ruby_class.parent,
            'modules': ruby_class.modules,
            'methods': [self._method_to_dict(m) for m in ruby_class.methods],
            'method_count': len(ruby_class.methods)
        }
    
    def _module_to_dict(self, ruby_module: RubyModule) -> Dict[str, Any]:
        """Convert RubyModule to dictionary."""
        return {
            'name': ruby_module.name,
            'line': ruby_module.line,
            'methods': [self._method_to_dict(m) for m in ruby_module.methods],
            'method_count': len(ruby_module.methods)
        }
    
    def _method_to_dict(self, method: RubyMethod) -> Dict[str, Any]:
        """Convert RubyMethod to dictionary."""
        return {
            'name': method.name,
            'parameters': method.parameters,
            'line': method.line,
            'is_class_method': method.is_class_method,
            'visibility': method.visibility
        }
