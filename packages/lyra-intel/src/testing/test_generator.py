"""
Test Generator for Lyra Intel - Auto-generates tests from code.
"""

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class GeneratedTest:
    """Represents a generated test."""
    name: str
    target_function: str
    target_file: str
    test_code: str
    test_type: str  # unit, integration, edge_case


class TestGenerator:
    """
    Auto-generates test cases from source code.
    
    Features:
    - Function signature analysis
    - Edge case generation
    - Mock generation
    - Test file creation
    """
    
    def __init__(self):
        self._templates = self._setup_templates()
    
    def _setup_templates(self) -> Dict[str, str]:
        """Setup test templates."""
        return {
            "python_unit": '''
def test_{func_name}_{case_name}():
    """Test {func_name} - {description}."""
    # Arrange
    {arrange}
    
    # Act
    {act}
    
    # Assert
    {assert_}
''',
            "python_async": '''
async def test_{func_name}_{case_name}():
    """Test {func_name} - {description}."""
    # Arrange
    {arrange}
    
    # Act
    {act}
    
    # Assert
    {assert_}
''',
            "python_class": '''
class Test{class_name}:
    """Test suite for {class_name}."""
    
    def setup_method(self):
        """Setup for each test."""
        self.instance = {class_name}({init_args})
    
{test_methods}
''',
        }
    
    def generate_for_file(self, file_path: str) -> List[GeneratedTest]:
        """Generate tests for all functions in a file."""
        path = Path(file_path)
        content = path.read_text(encoding="utf-8", errors="ignore")
        
        tests = []
        
        if path.suffix == ".py":
            tests.extend(self._generate_python_tests(file_path, content))
        elif path.suffix in [".js", ".ts"]:
            tests.extend(self._generate_js_tests(file_path, content))
        
        return tests
    
    def _generate_python_tests(self, file_path: str, content: str) -> List[GeneratedTest]:
        """Generate tests for Python file."""
        tests = []
        
        # Find functions
        func_pattern = re.compile(
            r"(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\w+))?"
        )
        
        for match in func_pattern.finditer(content):
            func_name = match.group(1)
            params = match.group(2)
            return_type = match.group(3)
            
            # Skip private and dunder methods
            if func_name.startswith("_"):
                continue
            
            # Generate basic test
            basic_test = self._generate_basic_test(func_name, params, return_type, "async" in match.group(0))
            tests.append(GeneratedTest(
                name=f"test_{func_name}_basic",
                target_function=func_name,
                target_file=file_path,
                test_code=basic_test,
                test_type="unit",
            ))
            
            # Generate edge case tests
            edge_tests = self._generate_edge_case_tests(func_name, params, return_type)
            tests.extend([
                GeneratedTest(
                    name=f"test_{func_name}_{et['name']}",
                    target_function=func_name,
                    target_file=file_path,
                    test_code=et["code"],
                    test_type="edge_case",
                )
                for et in edge_tests
            ])
        
        return tests
    
    def _generate_basic_test(
        self,
        func_name: str,
        params: str,
        return_type: Optional[str],
        is_async: bool,
    ) -> str:
        """Generate basic test for a function."""
        template = self._templates["python_async" if is_async else "python_unit"]
        
        # Parse parameters
        param_list = [p.strip() for p in params.split(",") if p.strip()]
        
        # Generate arrange section
        arrange_lines = []
        call_args = []
        
        for param in param_list:
            if ":" in param:
                name, type_hint = param.split(":", 1)
                name = name.strip()
                type_hint = type_hint.strip()
                
                # Handle default values
                if "=" in type_hint:
                    type_hint = type_hint.split("=")[0].strip()
                
                value = self._generate_value_for_type(type_hint)
                arrange_lines.append(f"{name} = {value}")
                call_args.append(name)
            elif "=" not in param:
                name = param.split("=")[0].strip()
                if name not in ["self", "cls"]:
                    arrange_lines.append(f'{name} = "test_value"')
                    call_args.append(name)
        
        arrange = "\n    ".join(arrange_lines) if arrange_lines else "pass"
        
        # Generate act section
        call = f"await {func_name}({', '.join(call_args)})" if is_async else f"{func_name}({', '.join(call_args)})"
        act = f"result = {call}"
        
        # Generate assert section
        if return_type:
            assert_ = f"assert result is not None"
        else:
            assert_ = "# Add assertions here"
        
        return template.format(
            func_name=func_name,
            case_name="basic",
            description="basic functionality",
            arrange=arrange,
            act=act,
            assert_=assert_,
        )
    
    def _generate_edge_case_tests(
        self,
        func_name: str,
        params: str,
        return_type: Optional[str],
    ) -> List[Dict[str, str]]:
        """Generate edge case tests."""
        edge_cases = []
        
        # Parse parameters to determine edge cases
        param_list = [p.strip() for p in params.split(",") if p.strip()]
        
        for param in param_list:
            if ":" in param:
                name, type_hint = param.split(":", 1)
                name = name.strip()
                type_hint = type_hint.split("=")[0].strip()
                
                # Generate type-specific edge cases
                if "str" in type_hint:
                    edge_cases.extend([
                        {
                            "name": f"empty_{name}",
                            "code": self._generate_edge_test(func_name, name, '""'),
                        },
                        {
                            "name": f"long_{name}",
                            "code": self._generate_edge_test(func_name, name, '"a" * 10000'),
                        },
                    ])
                elif "int" in type_hint or "float" in type_hint:
                    edge_cases.extend([
                        {
                            "name": f"zero_{name}",
                            "code": self._generate_edge_test(func_name, name, "0"),
                        },
                        {
                            "name": f"negative_{name}",
                            "code": self._generate_edge_test(func_name, name, "-1"),
                        },
                    ])
                elif "List" in type_hint or "list" in type_hint:
                    edge_cases.extend([
                        {
                            "name": f"empty_list_{name}",
                            "code": self._generate_edge_test(func_name, name, "[]"),
                        },
                    ])
                elif "Dict" in type_hint or "dict" in type_hint:
                    edge_cases.extend([
                        {
                            "name": f"empty_dict_{name}",
                            "code": self._generate_edge_test(func_name, name, "{}"),
                        },
                    ])
        
        # None/null test
        edge_cases.append({
            "name": "with_none",
            "code": f'''
def test_{func_name}_with_none():
    """Test {func_name} handles None input."""
    with pytest.raises((TypeError, ValueError)):
        {func_name}(None)
''',
        })
        
        return edge_cases
    
    def _generate_edge_test(self, func_name: str, param_name: str, value: str) -> str:
        """Generate a single edge case test."""
        return f'''
def test_{func_name}_edge_{param_name}():
    """Test {func_name} with edge case for {param_name}."""
    result = {func_name}({param_name}={value})
    assert result is not None  # Update assertion as needed
'''
    
    def _generate_value_for_type(self, type_hint: str) -> str:
        """Generate a test value for a type."""
        type_values = {
            "str": '"test_string"',
            "int": "42",
            "float": "3.14",
            "bool": "True",
            "list": "[]",
            "dict": "{}",
            "List": "[]",
            "Dict": "{}",
            "Optional": "None",
            "Path": 'Path(".")',
            "Any": '"test"',
        }
        
        for type_name, value in type_values.items():
            if type_name in type_hint:
                return value
        
        return "None"
    
    def _generate_js_tests(self, file_path: str, content: str) -> List[GeneratedTest]:
        """Generate tests for JavaScript/TypeScript file."""
        tests = []
        
        # Find functions
        func_patterns = [
            re.compile(r"function\s+(\w+)\s*\(([^)]*)\)"),
            re.compile(r"const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>"),
            re.compile(r"(\w+)\s*:\s*(?:async\s+)?function\s*\(([^)]*)\)"),
        ]
        
        for pattern in func_patterns:
            for match in pattern.finditer(content):
                func_name = match.group(1)
                
                if func_name.startswith("_"):
                    continue
                
                test_code = f'''
describe('{func_name}', () => {{
    it('should work correctly', () => {{
        // Arrange
        const input = null; // Add test input
        
        // Act
        const result = {func_name}(input);
        
        // Assert
        expect(result).toBeDefined();
    }});
    
    it('should handle edge cases', () => {{
        // Test edge cases
        expect(() => {func_name}(null)).toThrow();
    }});
}});
'''
                tests.append(GeneratedTest(
                    name=f"test_{func_name}",
                    target_function=func_name,
                    target_file=file_path,
                    test_code=test_code,
                    test_type="unit",
                ))
        
        return tests
    
    def generate_test_file(
        self,
        source_file: str,
        output_dir: str,
    ) -> str:
        """Generate a complete test file."""
        tests = self.generate_for_file(source_file)
        
        source_path = Path(source_file)
        output_path = Path(output_dir) / f"test_{source_path.stem}.py"
        
        # Build test file content
        imports = [
            "import pytest",
            f"from {source_path.stem} import *",
            "",
        ]
        
        test_code = "\n\n".join(t.test_code for t in tests)
        
        content = "\n".join(imports) + "\n" + test_code
        
        output_path.write_text(content)
        logger.info(f"Generated test file: {output_path}")
        
        return str(output_path)
