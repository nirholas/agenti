"""
Anomaly detection for identifying unusual code patterns.
"""

import math
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class AnomalyType(Enum):
    COMPLEXITY = "complexity"
    SIZE = "size"
    COUPLING = "coupling"
    PATTERN = "pattern"
    SECURITY = "security"
    PERFORMANCE = "performance"
    STYLE = "style"


class AnomalySeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AnomalyConfig:
    sensitivity: float = 0.5  # 0.0 = low, 1.0 = high
    z_score_threshold: float = 2.5
    min_samples: int = 10
    enabled_types: list[AnomalyType] = field(default_factory=lambda: list(AnomalyType))


@dataclass
class Anomaly:
    id: str = field(default_factory=lambda: str(uuid4()))
    anomaly_type: AnomalyType = AnomalyType.PATTERN
    severity: AnomalySeverity = AnomalySeverity.MEDIUM
    file_path: str = ""
    line_number: Optional[int] = None
    description: str = ""
    score: float = 0.0
    expected_value: Optional[float] = None
    actual_value: Optional[float] = None
    context: dict = field(default_factory=dict)
    detected_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.anomaly_type.value,
            "severity": self.severity.value,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "description": self.description,
            "score": self.score,
        }


class AnomalyDetector:
    def __init__(self, config: Optional[AnomalyConfig] = None):
        self.config = config or AnomalyConfig()
        self.baseline: dict[str, dict] = {}  # metric -> {mean, std}
        self.anomalies: list[Anomaly] = []

    def train_baseline(self, samples: list[dict[str, float]]) -> None:
        if len(samples) < self.config.min_samples:
            return

        for key in samples[0].keys():
            values = [s.get(key, 0) for s in samples]
            mean = sum(values) / len(values)
            variance = sum((v - mean) ** 2 for v in values) / len(values)
            std = math.sqrt(variance) if variance > 0 else 1.0
            self.baseline[key] = {"mean": mean, "std": std, "samples": len(values)}

    def detect(self, metrics: dict[str, float], file_path: str = "") -> list[Anomaly]:
        detected = []

        for key, value in metrics.items():
            if key not in self.baseline:
                continue

            baseline = self.baseline[key]
            z_score = abs(value - baseline["mean"]) / baseline["std"] if baseline["std"] > 0 else 0

            threshold = self.config.z_score_threshold * (2 - self.config.sensitivity)

            if z_score > threshold:
                severity = self._determine_severity(z_score, threshold)
                anomaly_type = self._determine_type(key)

                anomaly = Anomaly(
                    anomaly_type=anomaly_type,
                    severity=severity,
                    file_path=file_path,
                    description=f"Unusual {key}: {value:.2f} (expected ~{baseline['mean']:.2f})",
                    score=z_score,
                    expected_value=baseline["mean"],
                    actual_value=value,
                    context={"metric": key, "z_score": z_score},
                )

                if anomaly_type in self.config.enabled_types:
                    detected.append(anomaly)
                    self.anomalies.append(anomaly)

        return detected

    def _determine_severity(self, z_score: float, threshold: float) -> AnomalySeverity:
        ratio = z_score / threshold
        if ratio > 3:
            return AnomalySeverity.CRITICAL
        elif ratio > 2:
            return AnomalySeverity.HIGH
        elif ratio > 1.5:
            return AnomalySeverity.MEDIUM
        return AnomalySeverity.LOW

    def _determine_type(self, metric: str) -> AnomalyType:
        metric_lower = metric.lower()
        if "complexity" in metric_lower or "cyclomatic" in metric_lower:
            return AnomalyType.COMPLEXITY
        elif "size" in metric_lower or "lines" in metric_lower or "length" in metric_lower:
            return AnomalyType.SIZE
        elif "import" in metric_lower or "dependency" in metric_lower or "coupling" in metric_lower:
            return AnomalyType.COUPLING
        elif "security" in metric_lower or "vuln" in metric_lower:
            return AnomalyType.SECURITY
        elif "perf" in metric_lower or "time" in metric_lower:
            return AnomalyType.PERFORMANCE
        return AnomalyType.PATTERN

    def detect_batch(self, files: list[dict]) -> dict[str, list[Anomaly]]:
        results = {}
        for file_data in files:
            file_path = file_data.get("path", "")
            metrics = file_data.get("metrics", {})
            anomalies = self.detect(metrics, file_path)
            if anomalies:
                results[file_path] = anomalies
        return results

    def get_summary(self) -> dict:
        by_type = {}
        by_severity = {}

        for anomaly in self.anomalies:
            type_val = anomaly.anomaly_type.value
            by_type[type_val] = by_type.get(type_val, 0) + 1

            sev_val = anomaly.severity.value
            by_severity[sev_val] = by_severity.get(sev_val, 0) + 1

        return {
            "total_anomalies": len(self.anomalies),
            "by_type": by_type,
            "by_severity": by_severity,
            "baseline_metrics": list(self.baseline.keys()),
        }

    def get_anomalies(
        self,
        anomaly_type: Optional[AnomalyType] = None,
        severity: Optional[AnomalySeverity] = None,
        file_path: Optional[str] = None,
    ) -> list[Anomaly]:
        results = []
        for anomaly in self.anomalies:
            if anomaly_type and anomaly.anomaly_type != anomaly_type:
                continue
            if severity and anomaly.severity != severity:
                continue
            if file_path and anomaly.file_path != file_path:
                continue
            results.append(anomaly)
        return results

    def clear_anomalies(self) -> None:
        self.anomalies = []

    def export_baseline(self) -> dict:
        return self.baseline.copy()

    def import_baseline(self, baseline: dict) -> None:
        self.baseline = baseline.copy()
