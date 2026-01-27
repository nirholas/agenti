"""
Prometheus metrics and observability integration.

Provides:
- Custom metrics tracking
- Request instrumentation
- Performance monitoring
- Health checks
- Distributed tracing
"""

import time
from typing import Dict, Any, Optional, Callable
from functools import wraps
from collections import defaultdict
import threading
import logging

try:
    from prometheus_client import (
        Counter,
        Histogram,
        Gauge,
        Summary,
        Info,
        CollectorRegistry,
        generate_latest,
        CONTENT_TYPE_LATEST
    )
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

logger = logging.getLogger(__name__)


class MetricsCollector:
    """Collects and exposes Prometheus metrics."""
    
    def __init__(self, namespace: str = "lyra_intel"):
        self.namespace = namespace
        self.registry = CollectorRegistry() if PROMETHEUS_AVAILABLE else None
        self._metrics: Dict[str, Any] = {}
        self._lock = threading.Lock()
        
        if PROMETHEUS_AVAILABLE:
            self._initialize_metrics()
        else:
            logger.warning("Prometheus client not available. Metrics disabled.")
    
    def _initialize_metrics(self):
        """Initialize standard metrics."""
        # Request metrics
        self._metrics['requests_total'] = Counter(
            f'{self.namespace}_requests_total',
            'Total number of requests',
            ['method', 'endpoint', 'status'],
            registry=self.registry
        )
        
        self._metrics['request_duration'] = Histogram(
            f'{self.namespace}_request_duration_seconds',
            'Request duration in seconds',
            ['method', 'endpoint'],
            registry=self.registry
        )
        
        # Analysis metrics
        self._metrics['analyses_total'] = Counter(
            f'{self.namespace}_analyses_total',
            'Total number of analyses',
            ['analyzer_type', 'status'],
            registry=self.registry
        )
        
        self._metrics['analysis_duration'] = Histogram(
            f'{self.namespace}_analysis_duration_seconds',
            'Analysis duration in seconds',
            ['analyzer_type'],
            buckets=(0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0, 120.0),
            registry=self.registry
        )
        
        self._metrics['files_analyzed'] = Counter(
            f'{self.namespace}_files_analyzed_total',
            'Total number of files analyzed',
            ['language'],
            registry=self.registry
        )
        
        # System metrics
        self._metrics['active_analyses'] = Gauge(
            f'{self.namespace}_active_analyses',
            'Number of currently running analyses',
            registry=self.registry
        )
        
        self._metrics['cache_hits'] = Counter(
            f'{self.namespace}_cache_hits_total',
            'Total cache hits',
            ['cache_type'],
            registry=self.registry
        )
        
        self._metrics['cache_misses'] = Counter(
            f'{self.namespace}_cache_misses_total',
            'Total cache misses',
            ['cache_type'],
            registry=self.registry
        )
        
        # AI provider metrics
        self._metrics['ai_requests'] = Counter(
            f'{self.namespace}_ai_requests_total',
            'Total AI provider requests',
            ['provider', 'status'],
            registry=self.registry
        )
        
        self._metrics['ai_tokens'] = Counter(
            f'{self.namespace}_ai_tokens_total',
            'Total AI tokens used',
            ['provider', 'type'],
            registry=self.registry
        )
        
        # Error metrics
        self._metrics['errors_total'] = Counter(
            f'{self.namespace}_errors_total',
            'Total errors',
            ['error_type', 'component'],
            registry=self.registry
        )
        
        # Info metrics
        self._metrics['build_info'] = Info(
            f'{self.namespace}_build_info',
            'Build information',
            registry=self.registry
        )
        
        # Set build info
        self._metrics['build_info'].info({
            'version': '1.0.0',
            'python_version': '3.11'
        })
    
    def track_request(self, method: str, endpoint: str, status: int, duration: float):
        """Track an HTTP request."""
        if not PROMETHEUS_AVAILABLE:
            return
        
        self._metrics['requests_total'].labels(
            method=method,
            endpoint=endpoint,
            status=status
        ).inc()
        
        self._metrics['request_duration'].labels(
            method=method,
            endpoint=endpoint
        ).observe(duration)
    
    def track_analysis(self, analyzer_type: str, status: str, duration: float):
        """Track an analysis run."""
        if not PROMETHEUS_AVAILABLE:
            return
        
        self._metrics['analyses_total'].labels(
            analyzer_type=analyzer_type,
            status=status
        ).inc()
        
        self._metrics['analysis_duration'].labels(
            analyzer_type=analyzer_type
        ).observe(duration)
    
    def track_file_analyzed(self, language: str):
        """Track a file being analyzed."""
        if not PROMETHEUS_AVAILABLE:
            return
        
        self._metrics['files_analyzed'].labels(language=language).inc()
    
    def track_cache(self, cache_type: str, hit: bool):
        """Track cache hit or miss."""
        if not PROMETHEUS_AVAILABLE:
            return
        
        if hit:
            self._metrics['cache_hits'].labels(cache_type=cache_type).inc()
        else:
            self._metrics['cache_misses'].labels(cache_type=cache_type).inc()
    
    def track_ai_request(self, provider: str, status: str, input_tokens: int = 0, output_tokens: int = 0):
        """Track an AI provider request."""
        if not PROMETHEUS_AVAILABLE:
            return
        
        self._metrics['ai_requests'].labels(
            provider=provider,
            status=status
        ).inc()
        
        if input_tokens:
            self._metrics['ai_tokens'].labels(
                provider=provider,
                type='input'
            ).inc(input_tokens)
        
        if output_tokens:
            self._metrics['ai_tokens'].labels(
                provider=provider,
                type='output'
            ).inc(output_tokens)
    
    def track_error(self, error_type: str, component: str):
        """Track an error."""
        if not PROMETHEUS_AVAILABLE:
            return
        
        self._metrics['errors_total'].labels(
            error_type=error_type,
            component=component
        ).inc()
    
    def inc_active_analyses(self):
        """Increment active analyses counter."""
        if PROMETHEUS_AVAILABLE:
            self._metrics['active_analyses'].inc()
    
    def dec_active_analyses(self):
        """Decrement active analyses counter."""
        if PROMETHEUS_AVAILABLE:
            self._metrics['active_analyses'].dec()
    
    def get_metrics(self) -> bytes:
        """Get metrics in Prometheus format."""
        if not PROMETHEUS_AVAILABLE:
            return b"# Prometheus client not installed\n"
        
        return generate_latest(self.registry)


# Global metrics collector
_metrics_collector: Optional[MetricsCollector] = None


def get_metrics_collector() -> MetricsCollector:
    """Get or create the global metrics collector."""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector


def track_time(analyzer_type: str):
    """Decorator to track execution time of analysis functions."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            collector = get_metrics_collector()
            collector.inc_active_analyses()
            
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                status = "success"
                return result
            except Exception as e:
                status = "error"
                collector.track_error(type(e).__name__, analyzer_type)
                raise
            finally:
                duration = time.time() - start_time
                collector.track_analysis(analyzer_type, status, duration)
                collector.dec_active_analyses()
        
        return wrapper
    return decorator


class StructuredLogger:
    """Structured logging for better observability."""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self._context: Dict[str, Any] = {}
    
    def set_context(self, **kwargs):
        """Set context fields for all log messages."""
        self._context.update(kwargs)
    
    def clear_context(self):
        """Clear context fields."""
        self._context.clear()
    
    def _log(self, level: int, message: str, **kwargs):
        """Log with structured context."""
        extra = {**self._context, **kwargs}
        self.logger.log(level, message, extra=extra)
    
    def debug(self, message: str, **kwargs):
        """Log debug message."""
        self._log(logging.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs):
        """Log info message."""
        self._log(logging.INFO, message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning message."""
        self._log(logging.WARNING, message, **kwargs)
    
    def error(self, message: str, **kwargs):
        """Log error message."""
        self._log(logging.ERROR, message, **kwargs)
    
    def critical(self, message: str, **kwargs):
        """Log critical message."""
        self._log(logging.CRITICAL, message, **kwargs)


class HealthChecker:
    """Health check aggregator for monitoring."""
    
    def __init__(self):
        self.checks: Dict[str, Callable[[], bool]] = {}
        self._lock = threading.Lock()
    
    def register_check(self, name: str, check_func: Callable[[], bool]):
        """Register a health check function."""
        with self._lock:
            self.checks[name] = check_func
    
    def run_checks(self) -> Dict[str, Any]:
        """Run all health checks."""
        results = {
            "healthy": True,
            "checks": {}
        }
        
        for name, check_func in self.checks.items():
            try:
                result = check_func()
                results["checks"][name] = {
                    "healthy": result,
                    "status": "up" if result else "down"
                }
                if not result:
                    results["healthy"] = False
            except Exception as e:
                results["checks"][name] = {
                    "healthy": False,
                    "status": "error",
                    "error": str(e)
                }
                results["healthy"] = False
        
        return results


# Global health checker
_health_checker = HealthChecker()


def get_health_checker() -> HealthChecker:
    """Get the global health checker."""
    return _health_checker
