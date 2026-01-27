"""
Metrics Collector - Real-time metrics collection.

Provides:
- Counter metrics
- Gauge metrics
- Histogram metrics
- Timer metrics
- Metric aggregation
"""

import asyncio
import logging
import time
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict
import statistics

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of metrics supported."""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"


@dataclass
class Metric:
    """A metric measurement."""
    name: str
    value: float
    metric_type: MetricType
    timestamp: datetime = field(default_factory=datetime.now)
    labels: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "type": self.metric_type.value,
            "timestamp": self.timestamp.isoformat(),
            "labels": self.labels,
        }


@dataclass
class MetricSeries:
    """A time series of metrics."""
    name: str
    metric_type: MetricType
    values: List[tuple] = field(default_factory=list)  # (timestamp, value)
    labels: Dict[str, str] = field(default_factory=dict)
    
    def add(self, value: float, timestamp: Optional[datetime] = None) -> None:
        """Add a value to the series."""
        ts = timestamp or datetime.now()
        self.values.append((ts, value))
    
    def get_latest(self) -> Optional[float]:
        """Get the latest value."""
        if self.values:
            return self.values[-1][1]
        return None
    
    def get_average(self, window: Optional[timedelta] = None) -> Optional[float]:
        """Get average value over a time window."""
        if not self.values:
            return None
        
        if window:
            cutoff = datetime.now() - window
            values = [v for ts, v in self.values if ts >= cutoff]
        else:
            values = [v for _, v in self.values]
        
        return statistics.mean(values) if values else None
    
    def get_min(self) -> Optional[float]:
        """Get minimum value."""
        if self.values:
            return min(v for _, v in self.values)
        return None
    
    def get_max(self) -> Optional[float]:
        """Get maximum value."""
        if self.values:
            return max(v for _, v in self.values)
        return None
    
    def prune(self, max_age: timedelta) -> int:
        """Remove old values."""
        cutoff = datetime.now() - max_age
        original_len = len(self.values)
        self.values = [(ts, v) for ts, v in self.values if ts >= cutoff]
        return original_len - len(self.values)


class MetricsCollector:
    """
    Collects and manages metrics.
    
    Features:
    - Multiple metric types
    - Labeled metrics
    - Time windowing
    - Aggregations
    """
    
    def __init__(self, max_history: int = 10000, prune_interval: int = 60):
        self._series: Dict[str, MetricSeries] = {}
        self._counters: Dict[str, float] = defaultdict(float)
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = defaultdict(list)
        self._timers: Dict[str, List[float]] = defaultdict(list)
        self._max_history = max_history
        self._prune_interval = prune_interval
        self._callbacks: List[Callable[[Metric], None]] = []
        self._running = False
    
    def _get_key(self, name: str, labels: Optional[Dict[str, str]] = None) -> str:
        """Generate a unique key for a metric with labels."""
        if labels:
            label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
            return f"{name}{{{label_str}}}"
        return name
    
    def counter(
        self,
        name: str,
        value: float = 1.0,
        labels: Optional[Dict[str, str]] = None
    ) -> float:
        """
        Increment a counter metric.
        
        Args:
            name: Metric name
            value: Value to add (default 1)
            labels: Optional labels
            
        Returns:
            New counter value
        """
        key = self._get_key(name, labels)
        self._counters[key] += value
        
        metric = Metric(name, self._counters[key], MetricType.COUNTER, labels=labels or {})
        self._record_and_notify(key, metric)
        
        return self._counters[key]
    
    def gauge(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None
    ) -> float:
        """
        Set a gauge metric.
        
        Args:
            name: Metric name
            value: Current value
            labels: Optional labels
            
        Returns:
            Current gauge value
        """
        key = self._get_key(name, labels)
        self._gauges[key] = value
        
        metric = Metric(name, value, MetricType.GAUGE, labels=labels or {})
        self._record_and_notify(key, metric)
        
        return value
    
    def histogram(
        self,
        name: str,
        value: float,
        labels: Optional[Dict[str, str]] = None
    ) -> Dict[str, float]:
        """
        Record a histogram value.
        
        Args:
            name: Metric name
            value: Observed value
            labels: Optional labels
            
        Returns:
            Histogram statistics
        """
        key = self._get_key(name, labels)
        self._histograms[key].append(value)
        
        # Limit history
        if len(self._histograms[key]) > self._max_history:
            self._histograms[key] = self._histograms[key][-self._max_history:]
        
        metric = Metric(name, value, MetricType.HISTOGRAM, labels=labels or {})
        self._record_and_notify(key, metric)
        
        return self._get_histogram_stats(key)
    
    def timer(
        self,
        name: str,
        duration_ms: float,
        labels: Optional[Dict[str, str]] = None
    ) -> Dict[str, float]:
        """
        Record a timer value.
        
        Args:
            name: Metric name
            duration_ms: Duration in milliseconds
            labels: Optional labels
            
        Returns:
            Timer statistics
        """
        key = self._get_key(name, labels)
        self._timers[key].append(duration_ms)
        
        # Limit history
        if len(self._timers[key]) > self._max_history:
            self._timers[key] = self._timers[key][-self._max_history:]
        
        metric = Metric(name, duration_ms, MetricType.TIMER, labels=labels or {})
        self._record_and_notify(key, metric)
        
        return self._get_timer_stats(key)
    
    def time(self, name: str, labels: Optional[Dict[str, str]] = None):
        """
        Context manager for timing operations.
        
        Usage:
            with collector.time("operation"):
                do_work()
        """
        return TimerContext(self, name, labels)
    
    def _record_and_notify(self, key: str, metric: Metric) -> None:
        """Record metric and notify callbacks."""
        # Record to series
        if key not in self._series:
            self._series[key] = MetricSeries(
                name=metric.name,
                metric_type=metric.metric_type,
                labels=metric.labels,
            )
        self._series[key].add(metric.value, metric.timestamp)
        
        # Notify callbacks
        for callback in self._callbacks:
            try:
                callback(metric)
            except Exception as e:
                logger.error(f"Metric callback error: {e}")
    
    def _get_histogram_stats(self, key: str) -> Dict[str, float]:
        """Calculate histogram statistics."""
        values = self._histograms.get(key, [])
        if not values:
            return {}
        
        return {
            "count": len(values),
            "sum": sum(values),
            "min": min(values),
            "max": max(values),
            "mean": statistics.mean(values),
            "median": statistics.median(values),
            "p95": self._percentile(values, 95),
            "p99": self._percentile(values, 99),
        }
    
    def _get_timer_stats(self, key: str) -> Dict[str, float]:
        """Calculate timer statistics."""
        values = self._timers.get(key, [])
        if not values:
            return {}
        
        return {
            "count": len(values),
            "total_ms": sum(values),
            "min_ms": min(values),
            "max_ms": max(values),
            "mean_ms": statistics.mean(values),
            "median_ms": statistics.median(values),
            "p95_ms": self._percentile(values, 95),
            "p99_ms": self._percentile(values, 99),
        }
    
    def _percentile(self, values: List[float], percentile: int) -> float:
        """Calculate percentile."""
        if not values:
            return 0.0
        sorted_values = sorted(values)
        idx = int(len(sorted_values) * percentile / 100)
        return sorted_values[min(idx, len(sorted_values) - 1)]
    
    def on_metric(self, callback: Callable[[Metric], None]) -> None:
        """Register a callback for new metrics."""
        self._callbacks.append(callback)
    
    def get_all(self) -> Dict[str, Any]:
        """Get all current metrics."""
        result = {
            "counters": dict(self._counters),
            "gauges": dict(self._gauges),
            "histograms": {k: self._get_histogram_stats(k) for k in self._histograms},
            "timers": {k: self._get_timer_stats(k) for k in self._timers},
        }
        return result
    
    def get_series(self, name: str) -> Optional[MetricSeries]:
        """Get a metric series by name."""
        return self._series.get(name)
    
    def get_counter(self, name: str, labels: Optional[Dict[str, str]] = None) -> float:
        """Get a counter value."""
        key = self._get_key(name, labels)
        return self._counters.get(key, 0.0)
    
    def get_gauge(self, name: str, labels: Optional[Dict[str, str]] = None) -> Optional[float]:
        """Get a gauge value."""
        key = self._get_key(name, labels)
        return self._gauges.get(key)
    
    def reset(self) -> None:
        """Reset all metrics."""
        self._counters.clear()
        self._gauges.clear()
        self._histograms.clear()
        self._timers.clear()
        self._series.clear()
    
    async def start_pruning(self, max_age: timedelta = timedelta(hours=1)):
        """Start background pruning of old metrics."""
        self._running = True
        while self._running:
            await asyncio.sleep(self._prune_interval)
            for series in self._series.values():
                series.prune(max_age)
    
    def stop_pruning(self):
        """Stop background pruning."""
        self._running = False


class TimerContext:
    """Context manager for timing operations."""
    
    def __init__(
        self,
        collector: MetricsCollector,
        name: str,
        labels: Optional[Dict[str, str]] = None
    ):
        self.collector = collector
        self.name = name
        self.labels = labels
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time is not None:
            duration_ms = (time.perf_counter() - self.start_time) * 1000
            self.collector.timer(self.name, duration_ms, self.labels)
        return False


# Global metrics collector instance
_global_collector: Optional[MetricsCollector] = None


def get_metrics() -> MetricsCollector:
    """Get the global metrics collector instance."""
    global _global_collector
    if _global_collector is None:
        _global_collector = MetricsCollector()
    return _global_collector
