"""
Performance baseline plugin for pytest.

Automatically records test durations and saves to a JSON benchmark file.
Focus on devnet/localnet integration tests to track latency regressions.

Usage:
    pytest tests/ -m devnet -v -s --timeout=180
    # Results saved to tests/.perf-baseline.json

    # Compare with previous baseline:
    pytest tests/ -m devnet -v -s --timeout=180 --perf-compare
"""

from __future__ import annotations

import contextlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest

BASELINE_FILE = Path(__file__).parent / ".perf-baseline.json"

# Threshold for regression warning (% slower than baseline)
REGRESSION_THRESHOLD_PCT = 50


def pytest_addoption(parser):
    parser.addoption(
        "--perf-compare",
        action="store_true",
        default=False,
        help="Compare test durations against saved baseline and warn on regressions",
    )
    parser.addoption(
        "--perf-save",
        action="store_true",
        default=True,
        help="Save test durations as new baseline (default: True)",
    )


class PerfCollector:
    """Collects per-test timing data during a pytest session."""

    def __init__(self):
        self.results: dict[str, dict] = {}
        self._start_times: dict[str, float] = {}

    def start(self, nodeid: str):
        self._start_times[nodeid] = time.monotonic()

    def stop(self, nodeid: str, passed: bool):
        start = self._start_times.pop(nodeid, None)
        if start is None:
            return
        elapsed = time.monotonic() - start
        self.results[nodeid] = {
            "duration_s": round(elapsed, 3),
            "passed": passed,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def save(self, path: Path):
        """Save results to JSON file, merging with existing data."""
        existing = {}
        if path.exists():
            with contextlib.suppress(json.JSONDecodeError, OSError):
                existing = json.loads(path.read_text())

        # Merge: update existing entries, add new ones
        existing.update(self.results)

        path.write_text(json.dumps(existing, indent=2, sort_keys=True) + "\n")

    @staticmethod
    def load_baseline(path: Path) -> dict[str, dict]:
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            return {}


_collector = PerfCollector()


@pytest.hookimpl(tryfirst=True)
def pytest_runtest_setup(item):
    """Record test start time for integration tests."""
    markers = {m.name for m in item.iter_markers()}
    if markers & {"devnet", "localnet"}:
        _collector.start(item.nodeid)


@pytest.hookimpl(trylast=True)
def pytest_runtest_makereport(item, call):
    """Record test end time and pass/fail status."""
    if call.when == "call":
        markers = {m.name for m in item.iter_markers()}
        if markers & {"devnet", "localnet"}:
            _collector.stop(item.nodeid, call.excinfo is None)


def pytest_sessionfinish(session, exitstatus):
    """Save performance results and optionally compare against baseline."""
    if not _collector.results:
        return

    config = session.config
    do_save = config.getoption("--perf-save", default=True)
    do_compare = config.getoption("--perf-compare", default=False)

    # Compare against baseline
    if do_compare:
        baseline = PerfCollector.load_baseline(BASELINE_FILE)
        regressions = []
        for nodeid, data in _collector.results.items():
            if nodeid in baseline and data["passed"]:
                old = baseline[nodeid].get("duration_s", 0)
                new = data["duration_s"]
                if old > 0 and new > old * (1 + REGRESSION_THRESHOLD_PCT / 100):
                    pct = ((new - old) / old) * 100
                    regressions.append(
                        f"  ⚠ {nodeid}: {old:.2f}s → {new:.2f}s (+{pct:.0f}%)"
                    )
        if regressions:
            print("\n\n=== Performance Regressions Detected ===")
            print(f"Threshold: >{REGRESSION_THRESHOLD_PCT}% slower than baseline\n")
            for r in regressions:
                print(r)
            print()

    # Save new baseline
    if do_save:
        _collector.save(BASELINE_FILE)
        count = len(_collector.results)
        print(f"\n[perf] Saved {count} test timings to {BASELINE_FILE.name}")
