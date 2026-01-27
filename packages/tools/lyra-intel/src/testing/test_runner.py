"""
Test Runner for Lyra Intel.
"""

import asyncio
import logging
import time
import traceback
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

logger = logging.getLogger(__name__)


class TestStatus(Enum):
    """Test execution status."""
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"
    TIMEOUT = "timeout"


@dataclass
class TestResult:
    """Result of a single test."""
    name: str
    status: TestStatus
    duration_ms: float
    message: str = ""
    traceback: str = ""
    assertions: int = 0
    output: str = ""


@dataclass
class TestSuiteResult:
    """Result of a test suite."""
    name: str
    results: List[TestResult]
    total_duration_ms: float
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    errors: int = 0


@dataclass
class TestConfig:
    """Test runner configuration."""
    timeout_seconds: int = 60
    parallel: bool = True
    max_workers: int = 4
    fail_fast: bool = False
    verbose: bool = True
    output_format: str = "text"  # text, json, junit


class TestRunner:
    """
    Test runner with async support and multiple output formats.
    
    Features:
    - Async test support
    - Parallel execution
    - Timeout handling
    - Multiple output formats (text, JSON, JUnit)
    - Test discovery
    """
    
    def __init__(self, config: Optional[TestConfig] = None):
        self.config = config or TestConfig()
        self._tests: Dict[str, Callable] = {}
        self._suites: Dict[str, List[str]] = {}
        self._fixtures: Dict[str, Callable] = {}
        self._before_all: List[Callable] = []
        self._after_all: List[Callable] = []
        self._before_each: List[Callable] = []
        self._after_each: List[Callable] = []
    
    def test(self, name: Optional[str] = None, suite: str = "default"):
        """Decorator to register a test function."""
        def decorator(func: Callable):
            test_name = name or func.__name__
            self._tests[test_name] = func
            
            if suite not in self._suites:
                self._suites[suite] = []
            self._suites[suite].append(test_name)
            
            return func
        return decorator
    
    def fixture(self, name: Optional[str] = None):
        """Decorator to register a fixture."""
        def decorator(func: Callable):
            fixture_name = name or func.__name__
            self._fixtures[fixture_name] = func
            return func
        return decorator
    
    def before_all(self, func: Callable):
        """Register a before-all hook."""
        self._before_all.append(func)
        return func
    
    def after_all(self, func: Callable):
        """Register an after-all hook."""
        self._after_all.append(func)
        return func
    
    def before_each(self, func: Callable):
        """Register a before-each hook."""
        self._before_each.append(func)
        return func
    
    def after_each(self, func: Callable):
        """Register an after-each hook."""
        self._after_each.append(func)
        return func
    
    async def run_all(self) -> Dict[str, TestSuiteResult]:
        """Run all registered tests."""
        results = {}
        
        # Run before-all hooks
        for hook in self._before_all:
            await self._run_hook(hook)
        
        for suite_name, test_names in self._suites.items():
            result = await self.run_suite(suite_name, test_names)
            results[suite_name] = result
            
            if self.config.fail_fast and result.failed > 0:
                break
        
        # Run after-all hooks
        for hook in self._after_all:
            await self._run_hook(hook)
        
        return results
    
    async def run_suite(self, name: str, test_names: List[str]) -> TestSuiteResult:
        """Run a test suite."""
        start_time = time.time()
        results = []
        
        if self.config.parallel:
            # Run tests in parallel
            tasks = [
                self._run_test(test_name)
                for test_name in test_names
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            results = [r if isinstance(r, TestResult) else self._error_result(test_names[i], r) 
                      for i, r in enumerate(results)]
        else:
            # Run tests sequentially
            for test_name in test_names:
                result = await self._run_test(test_name)
                results.append(result)
                
                if self.config.fail_fast and result.status == TestStatus.FAILED:
                    break
        
        total_duration = (time.time() - start_time) * 1000
        
        return TestSuiteResult(
            name=name,
            results=results,
            total_duration_ms=total_duration,
            passed=sum(1 for r in results if r.status == TestStatus.PASSED),
            failed=sum(1 for r in results if r.status == TestStatus.FAILED),
            skipped=sum(1 for r in results if r.status == TestStatus.SKIPPED),
            errors=sum(1 for r in results if r.status == TestStatus.ERROR),
        )
    
    async def _run_test(self, name: str) -> TestResult:
        """Run a single test."""
        test_func = self._tests.get(name)
        if not test_func:
            return TestResult(
                name=name,
                status=TestStatus.ERROR,
                duration_ms=0,
                message=f"Test not found: {name}",
            )
        
        # Run before-each hooks
        for hook in self._before_each:
            await self._run_hook(hook)
        
        start_time = time.time()
        
        try:
            # Run test with timeout
            if asyncio.iscoroutinefunction(test_func):
                await asyncio.wait_for(
                    test_func(),
                    timeout=self.config.timeout_seconds
                )
            else:
                test_func()
            
            duration = (time.time() - start_time) * 1000
            
            result = TestResult(
                name=name,
                status=TestStatus.PASSED,
                duration_ms=duration,
            )
            
        except asyncio.TimeoutError:
            duration = (time.time() - start_time) * 1000
            result = TestResult(
                name=name,
                status=TestStatus.TIMEOUT,
                duration_ms=duration,
                message=f"Test timed out after {self.config.timeout_seconds}s",
            )
            
        except AssertionError as e:
            duration = (time.time() - start_time) * 1000
            result = TestResult(
                name=name,
                status=TestStatus.FAILED,
                duration_ms=duration,
                message=str(e),
                traceback=traceback.format_exc(),
            )
            
        except Exception as e:
            duration = (time.time() - start_time) * 1000
            result = TestResult(
                name=name,
                status=TestStatus.ERROR,
                duration_ms=duration,
                message=str(e),
                traceback=traceback.format_exc(),
            )
        
        # Run after-each hooks
        for hook in self._after_each:
            await self._run_hook(hook)
        
        if self.config.verbose:
            status_icon = {
                TestStatus.PASSED: "✅",
                TestStatus.FAILED: "❌",
                TestStatus.SKIPPED: "⏭️",
                TestStatus.ERROR: "💥",
                TestStatus.TIMEOUT: "⏰",
            }.get(result.status, "?")
            logger.info(f"{status_icon} {name} ({result.duration_ms:.2f}ms)")
        
        return result
    
    async def _run_hook(self, hook: Callable):
        """Run a hook function."""
        try:
            if asyncio.iscoroutinefunction(hook):
                await hook()
            else:
                hook()
        except Exception as e:
            logger.error(f"Hook error: {e}")
    
    def _error_result(self, name: str, exception: Exception) -> TestResult:
        """Create error result from exception."""
        return TestResult(
            name=name,
            status=TestStatus.ERROR,
            duration_ms=0,
            message=str(exception),
            traceback=''.join(traceback.format_exception(type(exception), exception, exception.__traceback__)),
        )
    
    def format_results(self, results: Dict[str, TestSuiteResult]) -> str:
        """Format results based on configured output format."""
        if self.config.output_format == "json":
            return self._format_json(results)
        elif self.config.output_format == "junit":
            return self._format_junit(results)
        else:
            return self._format_text(results)
    
    def _format_text(self, results: Dict[str, TestSuiteResult]) -> str:
        """Format results as text."""
        lines = ["\n" + "="*60]
        lines.append("TEST RESULTS")
        lines.append("="*60)
        
        total_passed = 0
        total_failed = 0
        total_skipped = 0
        total_errors = 0
        
        for suite_name, suite_result in results.items():
            lines.append(f"\n📦 Suite: {suite_name}")
            lines.append("-"*40)
            
            for result in suite_result.results:
                status_icon = {
                    TestStatus.PASSED: "✅",
                    TestStatus.FAILED: "❌",
                    TestStatus.SKIPPED: "⏭️",
                    TestStatus.ERROR: "💥",
                    TestStatus.TIMEOUT: "⏰",
                }.get(result.status, "?")
                
                lines.append(f"  {status_icon} {result.name} ({result.duration_ms:.2f}ms)")
                
                if result.message and result.status != TestStatus.PASSED:
                    lines.append(f"      └─ {result.message}")
            
            lines.append(f"\n  Passed: {suite_result.passed}, Failed: {suite_result.failed}, "
                        f"Skipped: {suite_result.skipped}, Errors: {suite_result.errors}")
            lines.append(f"  Duration: {suite_result.total_duration_ms:.2f}ms")
            
            total_passed += suite_result.passed
            total_failed += suite_result.failed
            total_skipped += suite_result.skipped
            total_errors += suite_result.errors
        
        lines.append("\n" + "="*60)
        lines.append("SUMMARY")
        lines.append("="*60)
        lines.append(f"Total: {total_passed + total_failed + total_skipped + total_errors} tests")
        lines.append(f"  ✅ Passed:  {total_passed}")
        lines.append(f"  ❌ Failed:  {total_failed}")
        lines.append(f"  ⏭️  Skipped: {total_skipped}")
        lines.append(f"  💥 Errors:  {total_errors}")
        
        status = "PASSED" if total_failed == 0 and total_errors == 0 else "FAILED"
        lines.append(f"\nStatus: {status}")
        
        return "\n".join(lines)
    
    def _format_json(self, results: Dict[str, TestSuiteResult]) -> str:
        """Format results as JSON."""
        import json
        
        data = {
            "suites": {
                name: {
                    "passed": suite.passed,
                    "failed": suite.failed,
                    "skipped": suite.skipped,
                    "errors": suite.errors,
                    "duration_ms": suite.total_duration_ms,
                    "tests": [
                        {
                            "name": r.name,
                            "status": r.status.value,
                            "duration_ms": r.duration_ms,
                            "message": r.message,
                        }
                        for r in suite.results
                    ],
                }
                for name, suite in results.items()
            },
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        return json.dumps(data, indent=2)
    
    def _format_junit(self, results: Dict[str, TestSuiteResult]) -> str:
        """Format results as JUnit XML."""
        lines = ['<?xml version="1.0" encoding="UTF-8"?>']
        lines.append('<testsuites>')
        
        for suite_name, suite_result in results.items():
            lines.append(f'  <testsuite name="{suite_name}" tests="{len(suite_result.results)}" '
                        f'failures="{suite_result.failed}" errors="{suite_result.errors}" '
                        f'skipped="{suite_result.skipped}" time="{suite_result.total_duration_ms / 1000:.3f}">')
            
            for result in suite_result.results:
                lines.append(f'    <testcase name="{result.name}" time="{result.duration_ms / 1000:.3f}">')
                
                if result.status == TestStatus.FAILED:
                    lines.append(f'      <failure message="{result.message}"><![CDATA[{result.traceback}]]></failure>')
                elif result.status == TestStatus.ERROR:
                    lines.append(f'      <error message="{result.message}"><![CDATA[{result.traceback}]]></error>')
                elif result.status == TestStatus.SKIPPED:
                    lines.append('      <skipped/>')
                
                lines.append('    </testcase>')
            
            lines.append('  </testsuite>')
        
        lines.append('</testsuites>')
        
        return "\n".join(lines)


def run_tests(test_funcs: List[Callable], config: Optional[TestConfig] = None) -> Dict[str, TestSuiteResult]:
    """Convenience function to run a list of test functions."""
    runner = TestRunner(config)
    
    for func in test_funcs:
        runner.test()(func)
    
    return asyncio.run(runner.run_all())
