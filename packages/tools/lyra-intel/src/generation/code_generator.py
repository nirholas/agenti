"""
Code Generator - AI-powered code generation.

This module generates code based on specifications,
context, and templates using AI models.
"""

import asyncio
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
import json


class GenerationType(Enum):
    """Types of code generation."""
    FUNCTION = "function"
    CLASS = "class"
    MODULE = "module"
    TEST = "test"
    DOCUMENTATION = "documentation"
    API_ENDPOINT = "api_endpoint"
    DATA_MODEL = "data_model"
    MIGRATION = "migration"
    CONFIG = "config"
    REFACTOR = "refactor"


@dataclass
class GenerationConfig:
    """Configuration for code generation."""
    language: str = "python"
    style_guide: Optional[str] = None
    max_lines: int = 500
    include_tests: bool = True
    include_docs: bool = True
    use_types: bool = True
    framework: Optional[str] = None


@dataclass
class GenerationResult:
    """Result of code generation."""
    success: bool
    code: str
    language: str
    generation_type: GenerationType
    tests: Optional[str] = None
    documentation: Optional[str] = None
    file_path: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    suggestions: List[str] = field(default_factory=list)


class CodeGenerator:
    """
    AI-powered code generator.
    
    Features:
    - Generate functions, classes, modules
    - Generate tests
    - Generate documentation
    - Context-aware generation
    """
    
    def __init__(self, config: Optional[GenerationConfig] = None):
        """Initialize code generator."""
        self.config = config or GenerationConfig()
        self._context: Dict[str, Any] = {}
        self._templates: Dict[str, str] = {}
        self._load_default_templates()
    
    def _load_default_templates(self) -> None:
        """Load default code templates."""
        self._templates = {
            "python_function": '''
def {name}({parameters}) -> {return_type}:
    """
    {docstring}
    
    Args:
{args_docs}
    
    Returns:
        {return_doc}
    """
    {body}
''',
            "python_class": '''
class {name}{bases}:
    """
    {docstring}
    
    Attributes:
{attrs_docs}
    """
    
    def __init__(self{init_params}):
        """Initialize {name}."""
{init_body}
    
{methods}
''',
            "python_test": '''
import pytest
from {module} import {imports}


class Test{class_name}:
    """Tests for {class_name}."""
    
    def setup_method(self):
        """Set up test fixtures."""
        {setup}
    
{test_methods}
''',
            "typescript_function": '''
/**
 * {docstring}
 * {params_docs}
 * @returns {return_doc}
 */
export function {name}({parameters}): {return_type} {{
    {body}
}}
''',
            "typescript_interface": '''
/**
 * {docstring}
 */
export interface {name}{extends} {{
{properties}
}}
''',
            "api_endpoint": '''
@router.{method}("{path}")
async def {name}({parameters}):
    """
    {docstring}
    
    {params_docs}
    """
    {body}
''',
        }
    
    def set_context(self, context: Dict[str, Any]) -> None:
        """Set generation context (existing code, patterns, etc.)."""
        self._context = context
    
    def generate_function(
        self,
        name: str,
        description: str,
        parameters: Optional[List[Dict[str, str]]] = None,
        return_type: Optional[str] = None,
        examples: Optional[List[str]] = None,
    ) -> GenerationResult:
        """
        Generate a function.
        
        Args:
            name: Function name
            description: What the function should do
            parameters: List of {name, type, description}
            return_type: Return type
            examples: Example usage
            
        Returns:
            Generated function code
        """
        params = parameters or []
        ret_type = return_type or "None" if self.config.language == "python" else "void"
        
        # Build parameter string
        param_strs = []
        args_docs = []
        for p in params:
            p_name = p.get("name", "arg")
            p_type = p.get("type", "Any")
            p_desc = p.get("description", "")
            
            if self.config.use_types:
                param_strs.append(f"{p_name}: {p_type}")
            else:
                param_strs.append(p_name)
            
            args_docs.append(f"        {p_name}: {p_desc}")
        
        param_string = ", ".join(param_strs)
        args_doc_string = "\n".join(args_docs) if args_docs else "        None"
        
        # Generate body based on description
        body = self._generate_body(name, description, params, ret_type)
        
        # Apply template
        if self.config.language == "python":
            template = self._templates["python_function"]
            code = template.format(
                name=name,
                parameters=param_string,
                return_type=ret_type,
                docstring=description,
                args_docs=args_doc_string,
                return_doc=f"{ret_type}: Result",
                body=body,
            )
        elif self.config.language in ["typescript", "javascript"]:
            template = self._templates["typescript_function"]
            code = template.format(
                name=name,
                parameters=param_string,
                return_type=ret_type,
                docstring=description,
                params_docs="\n".join(f" * @param {p['name']} {p.get('description', '')}" for p in params),
                return_doc=f"{{return_type}} {description}",
                body=body,
            )
        else:
            code = f"// Generated function: {name}\n// {description}"
        
        # Generate tests if requested
        tests = None
        if self.config.include_tests:
            tests = self._generate_tests(name, "function", params, ret_type, examples)
        
        return GenerationResult(
            success=True,
            code=code.strip(),
            language=self.config.language,
            generation_type=GenerationType.FUNCTION,
            tests=tests,
            metadata={"name": name, "parameters": params, "return_type": ret_type},
        )
    
    def generate_class(
        self,
        name: str,
        description: str,
        attributes: Optional[List[Dict[str, str]]] = None,
        methods: Optional[List[Dict[str, Any]]] = None,
        bases: Optional[List[str]] = None,
    ) -> GenerationResult:
        """
        Generate a class.
        
        Args:
            name: Class name
            description: What the class does
            attributes: List of {name, type, description}
            methods: List of method specifications
            bases: Base classes
            
        Returns:
            Generated class code
        """
        attrs = attributes or []
        meths = methods or []
        base_list = bases or []
        
        # Build bases string
        bases_str = f"({', '.join(base_list)})" if base_list else ""
        
        # Build init parameters
        init_params = []
        init_body = []
        attrs_docs = []
        
        for attr in attrs:
            a_name = attr.get("name", "attr")
            a_type = attr.get("type", "Any")
            a_desc = attr.get("description", "")
            a_default = attr.get("default")
            
            if self.config.use_types:
                if a_default is not None:
                    init_params.append(f"{a_name}: {a_type} = {repr(a_default)}")
                else:
                    init_params.append(f"{a_name}: {a_type}")
            else:
                init_params.append(a_name)
            
            init_body.append(f"        self.{a_name} = {a_name}")
            attrs_docs.append(f"        {a_name}: {a_desc}")
        
        init_params_str = ", " + ", ".join(init_params) if init_params else ""
        init_body_str = "\n".join(init_body) if init_body else "        pass"
        attrs_docs_str = "\n".join(attrs_docs) if attrs_docs else "        None"
        
        # Generate methods
        methods_code = []
        for meth in meths:
            meth_result = self.generate_function(
                name=meth.get("name", "method"),
                description=meth.get("description", ""),
                parameters=[{"name": "self"}] + meth.get("parameters", []),
                return_type=meth.get("return_type"),
            )
            # Indent method code
            indented = "\n".join("    " + line for line in meth_result.code.split("\n"))
            methods_code.append(indented)
        
        methods_str = "\n\n".join(methods_code) if methods_code else "    pass"
        
        # Apply template
        if self.config.language == "python":
            template = self._templates["python_class"]
            code = template.format(
                name=name,
                bases=bases_str,
                docstring=description,
                attrs_docs=attrs_docs_str,
                init_params=init_params_str,
                init_body=init_body_str,
                methods=methods_str,
            )
        else:
            code = f"// Generated class: {name}\n// {description}"
        
        # Generate tests
        tests = None
        if self.config.include_tests:
            tests = self._generate_tests(name, "class", attrs, None, None)
        
        return GenerationResult(
            success=True,
            code=code.strip(),
            language=self.config.language,
            generation_type=GenerationType.CLASS,
            tests=tests,
            metadata={"name": name, "attributes": attrs, "methods": meths},
        )
    
    def generate_api_endpoint(
        self,
        name: str,
        path: str,
        method: str,
        description: str,
        request_body: Optional[Dict[str, Any]] = None,
        response_model: Optional[Dict[str, Any]] = None,
    ) -> GenerationResult:
        """
        Generate an API endpoint.
        
        Args:
            name: Endpoint function name
            path: API path
            method: HTTP method
            description: What the endpoint does
            request_body: Request body schema
            response_model: Response model schema
            
        Returns:
            Generated endpoint code
        """
        params = []
        body = []
        
        if request_body:
            params.append(f"body: {request_body.get('name', 'RequestModel')}")
            body.append("    # Validate request")
            body.append("    data = body.dict()")
        
        body.append("    # TODO: Implement endpoint logic")
        body.append(f"    # {description}")
        
        if response_model:
            body.append(f"    return {response_model.get('name', 'ResponseModel')}(...)")
        else:
            body.append("    return {\"status\": \"success\"}")
        
        code = self._templates["api_endpoint"].format(
            method=method.lower(),
            path=path,
            name=name,
            parameters=", ".join(params) if params else "",
            docstring=description,
            params_docs="",
            body="\n".join(body),
        )
        
        return GenerationResult(
            success=True,
            code=code.strip(),
            language=self.config.language,
            generation_type=GenerationType.API_ENDPOINT,
            metadata={"path": path, "method": method},
        )
    
    def generate_data_model(
        self,
        name: str,
        description: str,
        fields: List[Dict[str, str]],
        base_class: Optional[str] = None,
    ) -> GenerationResult:
        """
        Generate a data model.
        
        Args:
            name: Model name
            description: What the model represents
            fields: List of {name, type, description}
            base_class: Base class (e.g., BaseModel, dataclass)
            
        Returns:
            Generated model code
        """
        base = base_class or "BaseModel"
        
        if self.config.language == "python":
            lines = []
            
            if base == "dataclass":
                lines.append("from dataclasses import dataclass, field")
                lines.append("")
                lines.append("@dataclass")
                lines.append(f"class {name}:")
            elif base == "BaseModel":
                lines.append("from pydantic import BaseModel, Field")
                lines.append("")
                lines.append(f"class {name}(BaseModel):")
            else:
                lines.append(f"class {name}({base}):")
            
            lines.append(f'    """{description}"""')
            lines.append("")
            
            for field in fields:
                f_name = field.get("name", "field")
                f_type = field.get("type", "str")
                f_desc = field.get("description", "")
                f_default = field.get("default")
                
                if base == "BaseModel":
                    if f_default is not None:
                        lines.append(f'    {f_name}: {f_type} = Field(default={repr(f_default)}, description="{f_desc}")')
                    else:
                        lines.append(f'    {f_name}: {f_type} = Field(..., description="{f_desc}")')
                elif base == "dataclass":
                    if f_default is not None:
                        lines.append(f"    {f_name}: {f_type} = {repr(f_default)}  # {f_desc}")
                    else:
                        lines.append(f"    {f_name}: {f_type}  # {f_desc}")
                else:
                    lines.append(f"    {f_name}: {f_type}")
            
            code = "\n".join(lines)
        else:
            # TypeScript interface
            lines = [f"interface {name} {{"]
            for field in fields:
                f_name = field.get("name", "field")
                f_type = field.get("type", "string")
                optional = "?" if field.get("optional") else ""
                lines.append(f"    {f_name}{optional}: {f_type};")
            lines.append("}")
            code = "\n".join(lines)
        
        return GenerationResult(
            success=True,
            code=code,
            language=self.config.language,
            generation_type=GenerationType.DATA_MODEL,
            metadata={"name": name, "fields": fields},
        )
    
    def _generate_body(
        self,
        name: str,
        description: str,
        params: List[Dict[str, str]],
        return_type: str,
    ) -> str:
        """Generate function body from description."""
        # Simple heuristic-based generation
        lines = []
        
        # Add input validation
        for p in params:
            p_name = p.get("name", "")
            p_type = p.get("type", "")
            if p_type in ["str", "string"]:
                lines.append(f"    if not {p_name}:")
                lines.append(f'        raise ValueError("{p_name} cannot be empty")')
        
        # Add implementation placeholder
        lines.append(f"    # TODO: Implement {description}")
        
        # Add return statement
        if return_type not in ["None", "void", ""]:
            if return_type in ["bool", "boolean"]:
                lines.append("    return True")
            elif return_type in ["int", "number"]:
                lines.append("    return 0")
            elif return_type in ["str", "string"]:
                lines.append('    return ""')
            elif return_type.startswith("List") or return_type.startswith("list"):
                lines.append("    return []")
            elif return_type.startswith("Dict") or return_type.startswith("dict"):
                lines.append("    return {}")
            else:
                lines.append(f"    return {return_type}()")
        
        return "\n".join(lines) if lines else "    pass"
    
    def _generate_tests(
        self,
        name: str,
        element_type: str,
        params: List[Dict[str, str]],
        return_type: Optional[str],
        examples: Optional[List[str]],
    ) -> str:
        """Generate test code."""
        if self.config.language != "python":
            return ""
        
        lines = []
        lines.append(f"class Test{name.title()}:")
        lines.append(f'    """Tests for {name}."""')
        lines.append("")
        
        if element_type == "function":
            lines.append(f"    def test_{name}_basic(self):")
            lines.append(f'        """Test basic {name} functionality."""')
            
            # Generate test call
            test_args = []
            for p in params:
                p_type = p.get("type", "str")
                if p_type in ["str", "string"]:
                    test_args.append('"test"')
                elif p_type in ["int", "number"]:
                    test_args.append("1")
                elif p_type in ["bool", "boolean"]:
                    test_args.append("True")
                else:
                    test_args.append("None")
            
            args_str = ", ".join(test_args)
            lines.append(f"        result = {name}({args_str})")
            lines.append("        assert result is not None")
            lines.append("")
            
            lines.append(f"    def test_{name}_edge_cases(self):")
            lines.append(f'        """Test {name} edge cases."""')
            lines.append("        # TODO: Add edge case tests")
            lines.append("        pass")
        
        elif element_type == "class":
            lines.append(f"    def test_{name.lower()}_init(self):")
            lines.append(f'        """Test {name} initialization."""')
            lines.append(f"        instance = {name}()")
            lines.append("        assert instance is not None")
        
        return "\n".join(lines)
