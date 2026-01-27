"""
Complexity Analyzer - Calculates code complexity metrics.
"""

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ComplexityRating(Enum):
    """Complexity rating levels."""
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    VERY_COMPLEX = "very_complex"
    UNMAINTAINABLE = "unmaintainable"


@dataclass
class ComplexityResult:
    """Result of complexity analysis for a code unit."""
    file_path: str
    entity_name: str
    entity_type: str
    line_start: int
    line_end: int
    cyclomatic_complexity: int
    cognitive_complexity: int
    halstead_metrics: Dict[str, float]
    loc: int  # Lines of code
    sloc: int  # Source lines (excluding blanks/comments)
    rating: ComplexityRating
    suggestions: List[str] = field(default_factory=list)


@dataclass
class FileComplexity:
    """Complexity metrics for a file."""
    file_path: str
    total_loc: int
    total_sloc: int
    average_cyclomatic: float
    max_cyclomatic: int
    entities: List[ComplexityResult]
    maintainability_index: float


class ComplexityAnalyzer:
    """
    Analyzes code complexity using multiple metrics.
    
    Metrics calculated:
    - Cyclomatic Complexity (McCabe)
    - Cognitive Complexity
    - Halstead Metrics
    - Lines of Code (LOC/SLOC)
    - Maintainability Index
    """
    
    def __init__(self):
        self._complexity_thresholds = {
            ComplexityRating.SIMPLE: 5,
            ComplexityRating.MODERATE: 10,
            ComplexityRating.COMPLEX: 20,
            ComplexityRating.VERY_COMPLEX: 50,
        }
    
    def analyze_file(self, file_path: str) -> FileComplexity:
        """Analyze complexity of a single file."""
        path = Path(file_path)
        content = path.read_text(encoding="utf-8", errors="ignore")
        
        suffix = path.suffix
        entities = []
        
        if suffix == ".py":
            entities = self._analyze_python(file_path, content)
        elif suffix in [".js", ".ts", ".tsx", ".jsx"]:
            entities = self._analyze_javascript(file_path, content)
        elif suffix == ".go":
            entities = self._analyze_go(file_path, content)
        else:
            # Basic LOC analysis for other files
            pass
        
        # Calculate file-level metrics
        total_loc = content.count("\n") + 1
        total_sloc = len([l for l in content.split("\n") if l.strip() and not l.strip().startswith(("#", "//", "/*", "*"))])
        
        avg_cyclomatic = sum(e.cyclomatic_complexity for e in entities) / max(len(entities), 1)
        max_cyclomatic = max((e.cyclomatic_complexity for e in entities), default=0)
        
        maintainability = self._calculate_maintainability_index(
            total_sloc,
            avg_cyclomatic,
            len(entities),
        )
        
        return FileComplexity(
            file_path=file_path,
            total_loc=total_loc,
            total_sloc=total_sloc,
            average_cyclomatic=round(avg_cyclomatic, 2),
            max_cyclomatic=max_cyclomatic,
            entities=entities,
            maintainability_index=maintainability,
        )
    
    def analyze_directory(self, dir_path: str) -> Dict[str, FileComplexity]:
        """Analyze all files in a directory."""
        results = {}
        
        for filepath in Path(dir_path).rglob("*"):
            if not filepath.is_file():
                continue
            
            if filepath.suffix not in [".py", ".js", ".ts", ".tsx", ".jsx", ".go"]:
                continue
            
            if any(p in str(filepath) for p in ["node_modules", "__pycache__", ".git"]):
                continue
            
            try:
                results[str(filepath)] = self.analyze_file(str(filepath))
            except Exception as e:
                logger.debug(f"Error analyzing {filepath}: {e}")
        
        return results
    
    def _analyze_python(self, file_path: str, content: str) -> List[ComplexityResult]:
        """Analyze Python file complexity."""
        entities = []
        lines = content.split("\n")
        
        # Find function definitions
        func_pattern = re.compile(r"^(\s*)(?:async\s+)?def\s+(\w+)")
        class_pattern = re.compile(r"^(\s*)class\s+(\w+)")
        
        in_function = False
        func_name = ""
        func_start = 0
        func_indent = 0
        func_lines = []
        
        for i, line in enumerate(lines, 1):
            # Check for function start
            func_match = func_pattern.match(line)
            if func_match:
                # Save previous function if exists
                if in_function and func_lines:
                    result = self._analyze_function("\n".join(func_lines), func_name, file_path, func_start)
                    entities.append(result)
                
                func_indent = len(func_match.group(1))
                func_name = func_match.group(2)
                func_start = i
                func_lines = [line]
                in_function = True
                continue
            
            # Check for class
            class_match = class_pattern.match(line)
            if class_match:
                if in_function and func_lines:
                    result = self._analyze_function("\n".join(func_lines), func_name, file_path, func_start)
                    entities.append(result)
                    in_function = False
                    func_lines = []
                continue
            
            # Collect function lines
            if in_function:
                # Check if we're still in the function (same or greater indent, or empty line)
                stripped = line.lstrip()
                current_indent = len(line) - len(stripped) if stripped else func_indent + 1
                
                if stripped and current_indent <= func_indent and not line.strip().startswith(("#", '"""', "'''")):
                    # End of function
                    result = self._analyze_function("\n".join(func_lines), func_name, file_path, func_start)
                    entities.append(result)
                    in_function = False
                    func_lines = []
                else:
                    func_lines.append(line)
        
        # Don't forget the last function
        if in_function and func_lines:
            result = self._analyze_function("\n".join(func_lines), func_name, file_path, func_start)
            entities.append(result)
        
        return entities
    
    def _analyze_javascript(self, file_path: str, content: str) -> List[ComplexityResult]:
        """Analyze JavaScript/TypeScript file complexity."""
        entities = []
        
        # Simple function detection
        func_patterns = [
            re.compile(r"function\s+(\w+)\s*\([^)]*\)\s*{"),
            re.compile(r"(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>"),
            re.compile(r"(\w+)\s*:\s*(?:async\s+)?function"),
        ]
        
        for pattern in func_patterns:
            for match in pattern.finditer(content):
                func_name = match.group(1)
                start_pos = match.start()
                line_start = content[:start_pos].count("\n") + 1
                
                # Extract function body (simplified)
                func_body = self._extract_block(content[match.end():])
                
                result = self._analyze_function(func_body, func_name, file_path, line_start)
                entities.append(result)
        
        return entities
    
    def _analyze_go(self, file_path: str, content: str) -> List[ComplexityResult]:
        """Analyze Go file complexity."""
        entities = []
        
        func_pattern = re.compile(r"func\s+(?:\([^)]+\)\s+)?(\w+)\s*\([^)]*\)")
        
        for match in func_pattern.finditer(content):
            func_name = match.group(1)
            start_pos = match.start()
            line_start = content[:start_pos].count("\n") + 1
            
            func_body = self._extract_block(content[match.end():])
            
            result = self._analyze_function(func_body, func_name, file_path, line_start)
            entities.append(result)
        
        return entities
    
    def _extract_block(self, content: str) -> str:
        """Extract a code block enclosed in braces."""
        depth = 0
        started = False
        end_pos = 0
        
        for i, char in enumerate(content):
            if char == "{":
                depth += 1
                started = True
            elif char == "}":
                depth -= 1
                if started and depth == 0:
                    end_pos = i
                    break
        
        return content[:end_pos] if end_pos else content[:200]
    
    def _analyze_function(self, body: str, name: str, file_path: str, line_start: int) -> ComplexityResult:
        """Analyze complexity of a function."""
        cyclomatic = self._calculate_cyclomatic(body)
        cognitive = self._calculate_cognitive(body)
        halstead = self._calculate_halstead(body)
        
        loc = body.count("\n") + 1
        sloc = len([l for l in body.split("\n") if l.strip()])
        
        rating = self._get_rating(cyclomatic)
        suggestions = self._generate_suggestions(cyclomatic, cognitive, loc, name)
        
        return ComplexityResult(
            file_path=file_path,
            entity_name=name,
            entity_type="function",
            line_start=line_start,
            line_end=line_start + loc - 1,
            cyclomatic_complexity=cyclomatic,
            cognitive_complexity=cognitive,
            halstead_metrics=halstead,
            loc=loc,
            sloc=sloc,
            rating=rating,
            suggestions=suggestions,
        )
    
    def _calculate_cyclomatic(self, body: str) -> int:
        """Calculate McCabe cyclomatic complexity."""
        complexity = 1  # Base complexity
        
        # Decision points
        decision_keywords = [
            r"\bif\b",
            r"\belif\b",
            r"\belse\b",
            r"\bfor\b",
            r"\bwhile\b",
            r"\bexcept\b",
            r"\bcatch\b",
            r"\bcase\b",
            r"\b\?\b",  # Ternary operator
            r"\band\b",
            r"\bor\b",
            r"\|\|",
            r"&&",
        ]
        
        for keyword in decision_keywords:
            complexity += len(re.findall(keyword, body))
        
        return complexity
    
    def _calculate_cognitive(self, body: str) -> int:
        """Calculate cognitive complexity."""
        complexity = 0
        nesting_level = 0
        
        lines = body.split("\n")
        
        nesting_keywords = {"if", "for", "while", "try", "catch", "switch", "else"}
        increment_keywords = {"if", "elif", "else if", "for", "while", "catch", "switch", "case", "?", "and", "or", "&&", "||"}
        
        for line in lines:
            stripped = line.strip()
            
            # Check for nesting increase
            for keyword in nesting_keywords:
                if re.search(rf"\b{keyword}\b", stripped):
                    nesting_level += 1
                    break
            
            # Add complexity for control structures
            for keyword in increment_keywords:
                if keyword in ["&&", "||"]:
                    complexity += stripped.count(keyword)
                elif re.search(rf"\b{keyword}\b", stripped):
                    complexity += 1 + nesting_level  # Nested structures add more complexity
            
            # Check for nesting decrease
            if stripped == "}" or stripped.startswith(("end", "fi", "done")):
                nesting_level = max(0, nesting_level - 1)
        
        return complexity
    
    def _calculate_halstead(self, body: str) -> Dict[str, float]:
        """Calculate Halstead complexity metrics."""
        # Simplified Halstead calculation
        operators = set()
        operands = set()
        
        # Find operators
        op_pattern = re.compile(r"[+\-*/=<>!&|^%]+|and|or|not|in|is")
        for match in op_pattern.finditer(body):
            operators.add(match.group())
        
        # Find operands (identifiers and literals)
        operand_pattern = re.compile(r"\b[a-zA-Z_]\w*\b|\b\d+\.?\d*\b")
        for match in operand_pattern.finditer(body):
            operands.add(match.group())
        
        n1 = len(operators)  # Unique operators
        n2 = len(operands)   # Unique operands
        
        # Estimated total occurrences (simplified)
        N1 = len(op_pattern.findall(body))
        N2 = len(operand_pattern.findall(body))
        
        vocabulary = n1 + n2
        length = N1 + N2
        
        # Halstead volume = length * log2(vocabulary)
        import math
        volume = length * math.log2(vocabulary) if vocabulary > 1 else 0
        difficulty = (n1 / 2) * (N2 / max(n2, 1)) if n1 > 0 else 0
        effort = volume * difficulty
        
        return {
            "vocabulary": vocabulary,
            "length": length,
            "volume": round(volume, 2),
            "difficulty": round(difficulty, 2),
            "effort": round(effort, 2),
        }
    
    def _calculate_maintainability_index(self, sloc: int, avg_complexity: float, num_entities: int) -> float:
        """Calculate maintainability index (0-100)."""
        import math
        
        if sloc <= 0:
            return 100.0
        
        # Simplified maintainability index formula
        halstead_volume = sloc * 3  # Rough approximation
        
        mi = max(0, (
            171
            - 5.2 * math.log(halstead_volume + 1)
            - 0.23 * avg_complexity
            - 16.2 * math.log(sloc + 1)
        ) * 100 / 171)
        
        return round(mi, 2)
    
    def _get_rating(self, cyclomatic: int) -> ComplexityRating:
        """Get complexity rating from cyclomatic complexity."""
        if cyclomatic <= self._complexity_thresholds[ComplexityRating.SIMPLE]:
            return ComplexityRating.SIMPLE
        elif cyclomatic <= self._complexity_thresholds[ComplexityRating.MODERATE]:
            return ComplexityRating.MODERATE
        elif cyclomatic <= self._complexity_thresholds[ComplexityRating.COMPLEX]:
            return ComplexityRating.COMPLEX
        elif cyclomatic <= self._complexity_thresholds[ComplexityRating.VERY_COMPLEX]:
            return ComplexityRating.VERY_COMPLEX
        else:
            return ComplexityRating.UNMAINTAINABLE
    
    def _generate_suggestions(self, cyclomatic: int, cognitive: int, loc: int, name: str) -> List[str]:
        """Generate improvement suggestions."""
        suggestions = []
        
        if cyclomatic > 10:
            suggestions.append(f"Consider breaking '{name}' into smaller functions (cyclomatic: {cyclomatic})")
        
        if cognitive > 15:
            suggestions.append(f"Reduce nesting depth in '{name}' (cognitive: {cognitive})")
        
        if loc > 50:
            suggestions.append(f"Function '{name}' is too long ({loc} lines), consider splitting")
        
        if cyclomatic > 20 and loc < 30:
            suggestions.append(f"'{name}' has high decision density, simplify conditional logic")
        
        return suggestions
    
    def get_summary(self, results: Dict[str, FileComplexity]) -> Dict[str, Any]:
        """Get summary of complexity analysis."""
        all_entities = []
        for fc in results.values():
            all_entities.extend(fc.entities)
        
        return {
            "files_analyzed": len(results),
            "total_entities": len(all_entities),
            "average_cyclomatic": round(
                sum(e.cyclomatic_complexity for e in all_entities) / max(len(all_entities), 1), 2
            ),
            "max_cyclomatic": max((e.cyclomatic_complexity for e in all_entities), default=0),
            "average_maintainability": round(
                sum(fc.maintainability_index for fc in results.values()) / max(len(results), 1), 2
            ),
            "by_rating": {
                rating.value: len([e for e in all_entities if e.rating == rating])
                for rating in ComplexityRating
            },
            "most_complex": sorted(
                all_entities,
                key=lambda x: x.cyclomatic_complexity,
                reverse=True
            )[:10],
        }
