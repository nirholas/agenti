"""
Feature extraction for ML-based code analysis.
"""

import ast
import re
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class CodeFeatures:
    # Structural features
    num_lines: int = 0
    num_functions: int = 0
    num_classes: int = 0
    num_imports: int = 0
    num_comments: int = 0
    num_docstrings: int = 0

    # Complexity features
    cyclomatic_complexity: float = 0.0
    cognitive_complexity: float = 0.0
    max_nesting_depth: int = 0
    avg_function_length: float = 0.0

    # Quality features
    num_todo_comments: int = 0
    num_fixme_comments: int = 0
    num_magic_numbers: int = 0
    num_long_methods: int = 0

    # Naming features
    num_short_names: int = 0
    num_non_descriptive_names: int = 0

    # Pattern features
    has_try_except: bool = False
    has_async: bool = False
    has_decorators: bool = False
    has_type_hints: bool = False
    has_logging: bool = False

    # Dependency features
    external_imports: list[str] = field(default_factory=list)
    internal_imports: list[str] = field(default_factory=list)

    def to_vector(self) -> list[float]:
        return [
            float(self.num_lines),
            float(self.num_functions),
            float(self.num_classes),
            float(self.num_imports),
            self.cyclomatic_complexity,
            self.cognitive_complexity,
            float(self.max_nesting_depth),
            self.avg_function_length,
            float(self.num_todo_comments),
            float(self.num_magic_numbers),
            float(self.has_try_except),
            float(self.has_async),
            float(self.has_type_hints),
        ]


class FeatureExtractor:
    def __init__(self):
        self.magic_number_threshold = 2
        self.long_method_threshold = 50
        self.short_name_threshold = 2

    def extract(self, code: str, language: str = "python") -> CodeFeatures:
        features = CodeFeatures()

        lines = code.split("\n")
        features.num_lines = len(lines)

        # Extract comments
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("#") or stripped.startswith("//"):
                features.num_comments += 1
                if "TODO" in line.upper():
                    features.num_todo_comments += 1
                if "FIXME" in line.upper():
                    features.num_fixme_comments += 1

        if language == "python":
            features = self._extract_python_features(code, features)

        return features

    def _extract_python_features(self, code: str, features: CodeFeatures) -> CodeFeatures:
        try:
            tree = ast.parse(code)
        except SyntaxError:
            return features

        function_lengths = []
        max_depth = 0

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
                features.num_functions += 1
                func_lines = node.end_lineno - node.lineno if hasattr(node, "end_lineno") else 10
                function_lengths.append(func_lines)
                if func_lines > self.long_method_threshold:
                    features.num_long_methods += 1
                if isinstance(node, ast.AsyncFunctionDef):
                    features.has_async = True
                if node.decorator_list:
                    features.has_decorators = True
                if node.returns:
                    features.has_type_hints = True
                if len(node.name) <= self.short_name_threshold:
                    features.num_short_names += 1

            elif isinstance(node, ast.ClassDef):
                features.num_classes += 1

            elif isinstance(node, ast.Import):
                features.num_imports += 1
                for alias in node.names:
                    features.external_imports.append(alias.name)

            elif isinstance(node, ast.ImportFrom):
                features.num_imports += 1
                module = node.module or ""
                if module.startswith("."):
                    features.internal_imports.append(module)
                else:
                    features.external_imports.append(module)

            elif isinstance(node, (ast.Try, ast.ExceptHandler)):
                features.has_try_except = True

            elif isinstance(node, ast.Constant):
                if isinstance(node.value, (int, float)) and abs(node.value) > self.magic_number_threshold:
                    if node.value not in [0, 1, -1, 2, 10, 100, 1000]:
                        features.num_magic_numbers += 1

            elif isinstance(node, ast.Call):
                if hasattr(node.func, "attr"):
                    if node.func.attr in ["info", "debug", "warning", "error", "critical"]:
                        features.has_logging = True

        if function_lengths:
            features.avg_function_length = sum(function_lengths) / len(function_lengths)

        # Calculate cyclomatic complexity (simplified)
        features.cyclomatic_complexity = self._calculate_cyclomatic(tree)

        # Calculate max nesting depth
        features.max_nesting_depth = self._calculate_max_depth(tree)

        # Count docstrings
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Module)):
                if (
                    node.body
                    and isinstance(node.body[0], ast.Expr)
                    and isinstance(node.body[0].value, ast.Constant)
                    and isinstance(node.body[0].value.value, str)
                ):
                    features.num_docstrings += 1

        return features

    def _calculate_cyclomatic(self, tree: ast.AST) -> float:
        complexity = 1
        for node in ast.walk(tree):
            if isinstance(node, (ast.If, ast.While, ast.For, ast.ExceptHandler, ast.With, ast.Assert, ast.comprehension)):
                complexity += 1
            elif isinstance(node, ast.BoolOp):
                complexity += len(node.values) - 1
        return float(complexity)

    def _calculate_max_depth(self, tree: ast.AST, current_depth: int = 0) -> int:
        max_depth = current_depth
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, (ast.If, ast.While, ast.For, ast.With, ast.Try)):
                child_depth = self._calculate_max_depth(node, current_depth + 1)
                max_depth = max(max_depth, child_depth)
            else:
                child_depth = self._calculate_max_depth(node, current_depth)
                max_depth = max(max_depth, child_depth)
        return max_depth

    def extract_batch(self, files: list[dict]) -> list[CodeFeatures]:
        results = []
        for file_data in files:
            code = file_data.get("content", "")
            language = file_data.get("language", "python")
            features = self.extract(code, language)
            results.append(features)
        return results

    def get_feature_names(self) -> list[str]:
        return [
            "num_lines",
            "num_functions",
            "num_classes",
            "num_imports",
            "cyclomatic_complexity",
            "cognitive_complexity",
            "max_nesting_depth",
            "avg_function_length",
            "num_todo_comments",
            "num_magic_numbers",
            "has_try_except",
            "has_async",
            "has_type_hints",
        ]
