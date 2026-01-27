"""
Impact Analyzer - Analyze the impact of code changes.

This module provides tools to understand how changes
affect the rest of the codebase.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from .diff_analyzer import FileDiff, SemanticChange, ChangeType


@dataclass
class ImpactNode:
    """Represents a node in the impact graph."""
    id: str
    name: str
    file_path: str
    node_type: str  # file, function, class, etc.
    impact_level: int  # 0 = direct, 1 = 1st degree, etc.
    reason: str = ""


@dataclass
class ImpactResult:
    """Result of impact analysis."""
    changed_elements: List[str]
    total_impacted: int
    impact_by_level: Dict[int, int] = field(default_factory=dict)
    impacted_files: List[str] = field(default_factory=list)
    impacted_functions: List[str] = field(default_factory=list)
    impacted_tests: List[str] = field(default_factory=list)
    risk_score: float = 0.0
    risk_level: str = "low"
    recommendations: List[str] = field(default_factory=list)


class ImpactAnalyzer:
    """
    Analyzes the impact of code changes on the codebase.
    
    Features:
    - Find affected code elements
    - Calculate risk scores
    - Identify affected tests
    - Generate recommendations
    """
    
    def __init__(self):
        """Initialize impact analyzer."""
        self._dependency_graph: Dict[str, Set[str]] = {}  # element -> set of dependents
        self._file_elements: Dict[str, List[str]] = {}  # file -> list of elements
        self._test_coverage: Dict[str, List[str]] = {}  # element -> list of tests
    
    def build_dependency_graph(
        self,
        dependencies: Dict[str, Any],
        ast_results: List[Dict[str, Any]],
    ) -> None:
        """
        Build dependency graph from analysis results.
        
        Args:
            dependencies: Dependency analysis results
            ast_results: AST analysis results
        """
        # Build file-level dependencies
        dep_graph = dependencies.get("graph", {})
        for source, targets in dep_graph.items():
            for target in targets:
                if target not in self._dependency_graph:
                    self._dependency_graph[target] = set()
                self._dependency_graph[target].add(source)
        
        # Build element-level from AST
        for result in ast_results:
            if "error" in result:
                continue
            
            file_path = result.get("file_path", "")
            elements = []
            
            for unit in result.get("code_units", []):
                element_id = f"{file_path}::{unit.get('name', '')}"
                elements.append(element_id)
                
                # Track references as dependencies
                for ref in unit.get("references", []):
                    ref_name = ref if isinstance(ref, str) else ref.get("name", "")
                    ref_id = f"*::{ref_name}"  # Wildcard file
                    
                    if element_id not in self._dependency_graph:
                        self._dependency_graph[element_id] = set()
                    self._dependency_graph[element_id].add(ref_id)
            
            self._file_elements[file_path] = elements
        
        # Identify tests
        for file_path, elements in self._file_elements.items():
            if "test" in file_path.lower() or "spec" in file_path.lower():
                for elem in elements:
                    # Extract what's being tested from element name
                    elem_name = elem.split("::")[-1] if "::" in elem else elem
                    tested = elem_name.replace("test_", "").replace("Test", "")
                    
                    for other_file, other_elems in self._file_elements.items():
                        for other_elem in other_elems:
                            if tested in other_elem:
                                if other_elem not in self._test_coverage:
                                    self._test_coverage[other_elem] = []
                                self._test_coverage[other_elem].append(elem)
    
    def analyze_impact(
        self,
        file_diffs: List[FileDiff],
        max_depth: int = 3,
    ) -> ImpactResult:
        """
        Analyze the impact of changes.
        
        Args:
            file_diffs: List of file changes
            max_depth: Maximum depth to traverse
            
        Returns:
            Impact analysis result
        """
        # Collect changed elements
        changed_elements = []
        changed_files = set()
        
        for diff in file_diffs:
            changed_files.add(diff.file_path)
            
            for sc in diff.semantic_changes:
                element_id = f"{diff.file_path}::{sc.name}"
                changed_elements.append(element_id)
        
        # Find impacted elements
        impacted = set()
        impact_by_level: Dict[int, Set[str]] = {0: set(changed_elements)}
        
        for level in range(max_depth):
            current_level = impact_by_level.get(level, set())
            next_level = set()
            
            for elem in current_level:
                # Find dependents
                dependents = self._find_dependents(elem)
                for dep in dependents:
                    if dep not in impacted:
                        impacted.add(dep)
                        next_level.add(dep)
            
            if next_level:
                impact_by_level[level + 1] = next_level
            else:
                break
        
        # Find impacted files
        impacted_files = set()
        for elem in impacted:
            if "::" in elem:
                file_path = elem.split("::")[0]
                if file_path != "*":
                    impacted_files.add(file_path)
        
        # Find impacted tests
        impacted_tests = set()
        for elem in list(impacted) + changed_elements:
            tests = self._test_coverage.get(elem, [])
            impacted_tests.update(tests)
        
        # Calculate risk score
        risk_score = self._calculate_risk_score(
            changed_elements, impacted, impacted_tests, file_diffs
        )
        
        # Determine risk level
        if risk_score >= 0.7:
            risk_level = "critical"
        elif risk_score >= 0.5:
            risk_level = "high"
        elif risk_score >= 0.3:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            file_diffs, impacted, impacted_tests, risk_score
        )
        
        return ImpactResult(
            changed_elements=changed_elements,
            total_impacted=len(impacted),
            impact_by_level={k: len(v) for k, v in impact_by_level.items()},
            impacted_files=list(impacted_files),
            impacted_functions=[e for e in impacted if "::" in e],
            impacted_tests=list(impacted_tests),
            risk_score=risk_score,
            risk_level=risk_level,
            recommendations=recommendations,
        )
    
    def _find_dependents(self, element: str) -> Set[str]:
        """Find elements that depend on the given element."""
        dependents = set()
        
        # Direct dependents
        if element in self._dependency_graph:
            dependents.update(self._dependency_graph[element])
        
        # Wildcard match
        if "::" in element:
            name = element.split("::")[-1]
            wildcard = f"*::{name}"
            if wildcard in self._dependency_graph:
                dependents.update(self._dependency_graph[wildcard])
        
        return dependents
    
    def _calculate_risk_score(
        self,
        changed: List[str],
        impacted: Set[str],
        impacted_tests: Set[str],
        file_diffs: List[FileDiff],
    ) -> float:
        """Calculate a risk score for the changes."""
        score = 0.0
        
        # Number of changed elements
        score += min(len(changed) * 0.05, 0.2)
        
        # Impact radius
        score += min(len(impacted) * 0.01, 0.2)
        
        # Test coverage
        if not impacted_tests and impacted:
            score += 0.2  # No test coverage for impacted code
        
        # Type of changes
        for diff in file_diffs:
            for sc in diff.semantic_changes:
                if sc.change_type == ChangeType.DELETED:
                    score += 0.05  # Deletions are risky
                if sc.element_type == "class":
                    score += 0.03  # Class changes are riskier
        
        # Lines changed
        total_lines = sum(d.lines_added + d.lines_deleted for d in file_diffs)
        score += min(total_lines * 0.001, 0.2)
        
        return min(score, 1.0)
    
    def _generate_recommendations(
        self,
        file_diffs: List[FileDiff],
        impacted: Set[str],
        impacted_tests: Set[str],
        risk_score: float,
    ) -> List[str]:
        """Generate recommendations based on impact analysis."""
        recommendations = []
        
        # High impact
        if len(impacted) > 10:
            recommendations.append(
                f"⚠️ High impact: {len(impacted)} elements affected. Consider splitting into smaller changes."
            )
        
        # Test coverage
        if not impacted_tests and impacted:
            recommendations.append(
                "🧪 No tests cover the affected code. Consider adding tests before merging."
            )
        elif impacted_tests:
            recommendations.append(
                f"✅ {len(impacted_tests)} test(s) should be run to verify changes."
            )
        
        # Risk level
        if risk_score >= 0.5:
            recommendations.append(
                "🔍 High-risk change. Recommend thorough code review."
            )
        
        # Deletions
        deletions = sum(
            1 for d in file_diffs
            for sc in d.semantic_changes
            if sc.change_type == ChangeType.DELETED
        )
        if deletions > 0:
            recommendations.append(
                f"🗑️ {deletions} element(s) deleted. Verify no remaining references."
            )
        
        # API changes
        api_changes = sum(
            1 for d in file_diffs
            for sc in d.semantic_changes
            if sc.change_type == ChangeType.MODIFIED and sc.details.get("old_signature")
        )
        if api_changes > 0:
            recommendations.append(
                f"📝 {api_changes} API signature(s) changed. Check all callers."
            )
        
        return recommendations
    
    def get_affected_tests(self, changed_elements: List[str]) -> List[str]:
        """Get tests affected by changed elements."""
        tests = set()
        
        for elem in changed_elements:
            if elem in self._test_coverage:
                tests.update(self._test_coverage[elem])
        
        return list(tests)
    
    def visualize_impact(self, result: ImpactResult) -> str:
        """Generate a text visualization of impact."""
        lines = []
        lines.append("Impact Analysis")
        lines.append("=" * 40)
        lines.append(f"Risk Score: {result.risk_score:.2f} ({result.risk_level.upper()})")
        lines.append(f"Total Impacted: {result.total_impacted}")
        lines.append("")
        
        lines.append("Impact by Level:")
        for level, count in sorted(result.impact_by_level.items()):
            indent = "  " * level
            label = "Direct" if level == 0 else f"Level {level}"
            lines.append(f"{indent}• {label}: {count}")
        
        lines.append("")
        lines.append("Impacted Files:")
        for f in result.impacted_files[:10]:
            lines.append(f"  📄 {f}")
        if len(result.impacted_files) > 10:
            lines.append(f"  ... and {len(result.impacted_files) - 10} more")
        
        lines.append("")
        lines.append("Tests to Run:")
        for t in result.impacted_tests[:10]:
            lines.append(f"  🧪 {t}")
        if len(result.impacted_tests) > 10:
            lines.append(f"  ... and {len(result.impacted_tests) - 10} more")
        
        lines.append("")
        lines.append("Recommendations:")
        for r in result.recommendations:
            lines.append(f"  {r}")
        
        return "\n".join(lines)
