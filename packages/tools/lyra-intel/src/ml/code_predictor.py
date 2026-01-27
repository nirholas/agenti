"""
Code prediction for intelligent suggestions.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class PredictionType(Enum):
    BUG_PROBABILITY = "bug_probability"
    COMPLEXITY_INCREASE = "complexity_increase"
    REFACTOR_NEEDED = "refactor_needed"
    TEST_COVERAGE_GAP = "test_coverage_gap"
    PERFORMANCE_ISSUE = "performance_issue"
    SECURITY_RISK = "security_risk"
    MAINTAINABILITY = "maintainability"


@dataclass
class PredictionResult:
    id: str = field(default_factory=lambda: str(uuid4()))
    prediction_type: PredictionType = PredictionType.BUG_PROBABILITY
    file_path: str = ""
    confidence: float = 0.0
    probability: float = 0.0
    explanation: str = ""
    factors: list[dict] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    predicted_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.prediction_type.value,
            "file_path": self.file_path,
            "confidence": self.confidence,
            "probability": self.probability,
            "explanation": self.explanation,
            "recommendations": self.recommendations,
        }


class CodePredictor:
    def __init__(self, model_trainer=None):
        self.model_trainer = model_trainer
        self.prediction_history: list[PredictionResult] = []

        # Default thresholds
        self.thresholds = {
            "complexity_warning": 15,
            "complexity_critical": 25,
            "lines_warning": 200,
            "lines_critical": 500,
            "imports_warning": 20,
            "nesting_warning": 4,
        }

    def predict_bug_probability(self, features: dict) -> PredictionResult:
        factors = []
        probability = 0.0

        # Complexity factor
        complexity = features.get("cyclomatic_complexity", 0)
        if complexity > self.thresholds["complexity_critical"]:
            probability += 0.3
            factors.append({"factor": "high_complexity", "value": complexity, "weight": 0.3})
        elif complexity > self.thresholds["complexity_warning"]:
            probability += 0.15
            factors.append({"factor": "moderate_complexity", "value": complexity, "weight": 0.15})

        # Size factor
        lines = features.get("num_lines", 0)
        if lines > self.thresholds["lines_critical"]:
            probability += 0.2
            factors.append({"factor": "very_large_file", "value": lines, "weight": 0.2})
        elif lines > self.thresholds["lines_warning"]:
            probability += 0.1
            factors.append({"factor": "large_file", "value": lines, "weight": 0.1})

        # Nesting factor
        nesting = features.get("max_nesting_depth", 0)
        if nesting > self.thresholds["nesting_warning"]:
            probability += 0.15
            factors.append({"factor": "deep_nesting", "value": nesting, "weight": 0.15})

        # Error handling
        has_try_except = features.get("has_try_except", False)
        if not has_try_except and complexity > 5:
            probability += 0.1
            factors.append({"factor": "missing_error_handling", "value": 0, "weight": 0.1})

        # Type hints
        has_type_hints = features.get("has_type_hints", False)
        if not has_type_hints:
            probability += 0.05
            factors.append({"factor": "no_type_hints", "value": 0, "weight": 0.05})

        recommendations = []
        if complexity > self.thresholds["complexity_warning"]:
            recommendations.append("Consider breaking down complex functions")
        if lines > self.thresholds["lines_warning"]:
            recommendations.append("Consider splitting into multiple modules")
        if nesting > self.thresholds["nesting_warning"]:
            recommendations.append("Reduce nesting depth using early returns or guard clauses")
        if not has_try_except and complexity > 5:
            recommendations.append("Add error handling for edge cases")

        probability = min(probability, 1.0)
        confidence = 0.7 + (len(factors) * 0.05)

        result = PredictionResult(
            prediction_type=PredictionType.BUG_PROBABILITY,
            file_path=features.get("file_path", ""),
            confidence=min(confidence, 0.95),
            probability=probability,
            explanation=f"Bug probability: {probability*100:.1f}% based on {len(factors)} risk factors",
            factors=factors,
            recommendations=recommendations,
        )

        self.prediction_history.append(result)
        return result

    def predict_refactor_needed(self, features: dict) -> PredictionResult:
        factors = []
        score = 0.0

        # Code smells
        magic_numbers = features.get("num_magic_numbers", 0)
        if magic_numbers > 3:
            score += 0.2
            factors.append({"factor": "magic_numbers", "value": magic_numbers, "weight": 0.2})

        long_methods = features.get("num_long_methods", 0)
        if long_methods > 0:
            score += 0.25 * min(long_methods, 3)
            factors.append({"factor": "long_methods", "value": long_methods, "weight": 0.25})

        todo_comments = features.get("num_todo_comments", 0)
        if todo_comments > 2:
            score += 0.1
            factors.append({"factor": "todo_debt", "value": todo_comments, "weight": 0.1})

        avg_func_length = features.get("avg_function_length", 0)
        if avg_func_length > 30:
            score += 0.15
            factors.append({"factor": "long_avg_functions", "value": avg_func_length, "weight": 0.15})

        recommendations = []
        if magic_numbers > 3:
            recommendations.append("Extract magic numbers into named constants")
        if long_methods > 0:
            recommendations.append("Break down long methods into smaller functions")
        if todo_comments > 2:
            recommendations.append("Address TODO comments to reduce technical debt")

        score = min(score, 1.0)

        result = PredictionResult(
            prediction_type=PredictionType.REFACTOR_NEEDED,
            file_path=features.get("file_path", ""),
            confidence=0.8,
            probability=score,
            explanation=f"Refactoring recommended: {score*100:.1f}% technical debt score",
            factors=factors,
            recommendations=recommendations,
        )

        self.prediction_history.append(result)
        return result

    def predict_maintainability(self, features: dict) -> PredictionResult:
        # Higher is better for maintainability
        score = 100.0

        factors = []

        # Complexity penalty
        complexity = features.get("cyclomatic_complexity", 0)
        if complexity > 10:
            penalty = min((complexity - 10) * 2, 30)
            score -= penalty
            factors.append({"factor": "complexity_penalty", "value": -penalty, "impact": "negative"})

        # Documentation bonus
        docstrings = features.get("num_docstrings", 0)
        functions = features.get("num_functions", 1)
        doc_ratio = docstrings / functions if functions > 0 else 0
        if doc_ratio > 0.5:
            bonus = doc_ratio * 10
            score += bonus
            factors.append({"factor": "documentation_bonus", "value": bonus, "impact": "positive"})

        # Type hints bonus
        if features.get("has_type_hints", False):
            score += 10
            factors.append({"factor": "type_hints_bonus", "value": 10, "impact": "positive"})

        # Size penalty
        lines = features.get("num_lines", 0)
        if lines > 500:
            penalty = min((lines - 500) / 50, 20)
            score -= penalty
            factors.append({"factor": "size_penalty", "value": -penalty, "impact": "negative"})

        score = max(0, min(100, score))

        recommendations = []
        if score < 50:
            recommendations.append("Major refactoring recommended")
        elif score < 70:
            recommendations.append("Consider improving documentation and reducing complexity")

        result = PredictionResult(
            prediction_type=PredictionType.MAINTAINABILITY,
            file_path=features.get("file_path", ""),
            confidence=0.85,
            probability=score / 100,
            explanation=f"Maintainability index: {score:.1f}/100",
            factors=factors,
            recommendations=recommendations,
        )

        self.prediction_history.append(result)
        return result

    def predict_all(self, features: dict) -> list[PredictionResult]:
        return [
            self.predict_bug_probability(features),
            self.predict_refactor_needed(features),
            self.predict_maintainability(features),
        ]

    def get_history(self, prediction_type: Optional[PredictionType] = None) -> list[PredictionResult]:
        if prediction_type:
            return [p for p in self.prediction_history if p.prediction_type == prediction_type]
        return self.prediction_history

    def clear_history(self) -> None:
        self.prediction_history = []
