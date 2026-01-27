"""
Benchmark Runner for Lyra Intel.
"""

import asyncio
import gc
import logging
import statistics
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class BenchmarkResult:
    """Result of a single benchmark."""
    name: str
    iterations: int
    total_time_ms: float
    min_time_ms: float
    max_time_ms: float
    mean_time_ms: float
    median_time_ms: float
    std_dev_ms: float
    ops_per_second: float
    memory_delta_bytes: int = 0


@dataclass
class Benchmark:
    """Benchmark definition."""
    name: str
    func: Callable
    iterations: int = 100
    warmup_iterations: int = 10
    setup: Optional[Callable] = None
    teardown: Optional[Callable] = None


class BenchmarkRunner:
    """
    Runs performance benchmarks.
    
    Features:
    - Warmup iterations
    - Statistical analysis
    - Memory profiling
    - Comparison between benchmarks
    """
    
    def __init__(self):
        self._benchmarks: Dict[str, Benchmark] = {}
        self._results: Dict[str, BenchmarkResult] = {}
    
    def benchmark(
        self,
        name: Optional[str] = None,
        iterations: int = 100,
        warmup: int = 10,
    ):
        """Decorator to register a benchmark."""
        def decorator(func: Callable):
            bench_name = name or func.__name__
            self._benchmarks[bench_name] = Benchmark(
                name=bench_name,
                func=func,
                iterations=iterations,
                warmup_iterations=warmup,
            )
            return func
        return decorator
    
    def add_benchmark(self, benchmark: Benchmark):
        """Add a benchmark."""
        self._benchmarks[benchmark.name] = benchmark
    
    async def run_all(self) -> Dict[str, BenchmarkResult]:
        """Run all benchmarks."""
        for name, benchmark in self._benchmarks.items():
            logger.info(f"Running benchmark: {name}")
            result = await self.run_benchmark(benchmark)
            self._results[name] = result
        
        return self._results
    
    async def run_benchmark(self, benchmark: Benchmark) -> BenchmarkResult:
        """Run a single benchmark."""
        # Setup
        if benchmark.setup:
            if asyncio.iscoroutinefunction(benchmark.setup):
                await benchmark.setup()
            else:
                benchmark.setup()
        
        # Warmup
        logger.debug(f"Warming up ({benchmark.warmup_iterations} iterations)...")
        for _ in range(benchmark.warmup_iterations):
            await self._run_iteration(benchmark.func)
        
        # Force garbage collection
        gc.collect()
        
        # Get initial memory
        import sys
        initial_memory = sys.getsizeof(gc.get_objects())
        
        # Run benchmark
        times = []
        logger.debug(f"Running benchmark ({benchmark.iterations} iterations)...")
        
        for _ in range(benchmark.iterations):
            duration = await self._run_iteration(benchmark.func)
            times.append(duration)
        
        # Get final memory
        final_memory = sys.getsizeof(gc.get_objects())
        memory_delta = final_memory - initial_memory
        
        # Teardown
        if benchmark.teardown:
            if asyncio.iscoroutinefunction(benchmark.teardown):
                await benchmark.teardown()
            else:
                benchmark.teardown()
        
        # Calculate statistics
        times_ms = [t * 1000 for t in times]
        total_time = sum(times_ms)
        mean_time = statistics.mean(times_ms)
        
        result = BenchmarkResult(
            name=benchmark.name,
            iterations=benchmark.iterations,
            total_time_ms=total_time,
            min_time_ms=min(times_ms),
            max_time_ms=max(times_ms),
            mean_time_ms=mean_time,
            median_time_ms=statistics.median(times_ms),
            std_dev_ms=statistics.stdev(times_ms) if len(times_ms) > 1 else 0,
            ops_per_second=1000 / mean_time if mean_time > 0 else 0,
            memory_delta_bytes=memory_delta,
        )
        
        logger.info(f"  Mean: {result.mean_time_ms:.3f}ms, "
                   f"Ops/s: {result.ops_per_second:.2f}")
        
        return result
    
    async def _run_iteration(self, func: Callable) -> float:
        """Run a single iteration and return duration in seconds."""
        start = time.perf_counter()
        
        if asyncio.iscoroutinefunction(func):
            await func()
        else:
            func()
        
        return time.perf_counter() - start
    
    def compare(
        self,
        benchmark1: str,
        benchmark2: str,
    ) -> Dict[str, Any]:
        """Compare two benchmark results."""
        r1 = self._results.get(benchmark1)
        r2 = self._results.get(benchmark2)
        
        if not r1 or not r2:
            return {"error": "One or both benchmarks not found"}
        
        speedup = r1.mean_time_ms / r2.mean_time_ms if r2.mean_time_ms > 0 else 0
        
        return {
            "benchmark1": benchmark1,
            "benchmark2": benchmark2,
            "mean_time_1_ms": r1.mean_time_ms,
            "mean_time_2_ms": r2.mean_time_ms,
            "speedup": speedup,
            "faster": benchmark2 if speedup > 1 else benchmark1,
            "percent_faster": abs(speedup - 1) * 100,
        }
    
    def format_results(self, format: str = "text") -> str:
        """Format benchmark results."""
        if format == "json":
            return self._format_json()
        elif format == "markdown":
            return self._format_markdown()
        else:
            return self._format_text()
    
    def _format_text(self) -> str:
        """Format results as text."""
        lines = [
            "",
            "=" * 70,
            "BENCHMARK RESULTS",
            "=" * 70,
            "",
        ]
        
        for name, result in sorted(self._results.items()):
            lines.extend([
                f"📊 {result.name}",
                f"   Iterations: {result.iterations}",
                f"   Mean:       {result.mean_time_ms:.3f} ms",
                f"   Median:     {result.median_time_ms:.3f} ms",
                f"   Min:        {result.min_time_ms:.3f} ms",
                f"   Max:        {result.max_time_ms:.3f} ms",
                f"   Std Dev:    {result.std_dev_ms:.3f} ms",
                f"   Ops/sec:    {result.ops_per_second:,.2f}",
                "",
            ])
        
        return "\n".join(lines)
    
    def _format_json(self) -> str:
        """Format results as JSON."""
        import json
        
        data = {
            "timestamp": datetime.utcnow().isoformat(),
            "benchmarks": {
                name: {
                    "iterations": r.iterations,
                    "mean_ms": r.mean_time_ms,
                    "median_ms": r.median_time_ms,
                    "min_ms": r.min_time_ms,
                    "max_ms": r.max_time_ms,
                    "std_dev_ms": r.std_dev_ms,
                    "ops_per_second": r.ops_per_second,
                }
                for name, r in self._results.items()
            },
        }
        
        return json.dumps(data, indent=2)
    
    def _format_markdown(self) -> str:
        """Format results as markdown table."""
        lines = [
            "# Benchmark Results",
            "",
            f"*Generated: {datetime.utcnow().isoformat()}*",
            "",
            "| Benchmark | Iterations | Mean (ms) | Median (ms) | Std Dev | Ops/sec |",
            "|-----------|------------|-----------|-------------|---------|---------|",
        ]
        
        for name, r in sorted(self._results.items()):
            lines.append(
                f"| {name} | {r.iterations} | {r.mean_time_ms:.3f} | "
                f"{r.median_time_ms:.3f} | {r.std_dev_ms:.3f} | {r.ops_per_second:,.0f} |"
            )
        
        return "\n".join(lines)


# Convenience functions
def run_benchmarks(
    benchmarks: List[Callable],
    iterations: int = 100,
) -> Dict[str, BenchmarkResult]:
    """Run a list of benchmark functions."""
    runner = BenchmarkRunner()
    
    for func in benchmarks:
        runner.benchmark(iterations=iterations)(func)
    
    return asyncio.run(runner.run_all())
