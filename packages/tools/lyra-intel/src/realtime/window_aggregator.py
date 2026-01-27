"""
Window-based aggregation for streaming analytics.
"""

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Optional


class WindowType(Enum):
    TUMBLING = "tumbling"
    SLIDING = "sliding"
    SESSION = "session"
    GLOBAL = "global"


class AggregationType(Enum):
    COUNT = "count"
    SUM = "sum"
    AVG = "avg"
    MIN = "min"
    MAX = "max"
    FIRST = "first"
    LAST = "last"


@dataclass
class WindowResult:
    window_start: datetime = field(default_factory=datetime.utcnow)
    window_end: datetime = field(default_factory=datetime.utcnow)
    event_count: int = 0
    aggregations: dict = field(default_factory=dict)


class WindowAggregator:
    def __init__(
        self,
        window_type: WindowType = WindowType.TUMBLING,
        window_size_seconds: int = 60,
        slide_seconds: int = 30,
        session_gap_seconds: int = 300,
    ):
        self.window_type = window_type
        self.window_size = timedelta(seconds=window_size_seconds)
        self.slide_size = timedelta(seconds=slide_seconds)
        self.session_gap = timedelta(seconds=session_gap_seconds)

        self.events: deque = deque()
        self.aggregations: dict[str, tuple[str, AggregationType]] = {}
        self.results: list[WindowResult] = []
        self.current_window_start: Optional[datetime] = None

    def add_aggregation(
        self,
        name: str,
        field: str,
        agg_type: AggregationType,
    ) -> None:
        self.aggregations[name] = (field, agg_type)

    def add_event(self, event: dict, timestamp: Optional[datetime] = None) -> Optional[WindowResult]:
        timestamp = timestamp or datetime.utcnow()
        self.events.append((timestamp, event))

        if self.current_window_start is None:
            self.current_window_start = timestamp

        result = None
        if self.window_type == WindowType.TUMBLING:
            result = self._check_tumbling_window(timestamp)
        elif self.window_type == WindowType.SLIDING:
            result = self._check_sliding_window(timestamp)

        return result

    def _check_tumbling_window(self, current_time: datetime) -> Optional[WindowResult]:
        if not self.current_window_start:
            return None

        window_end = self.current_window_start + self.window_size
        if current_time >= window_end:
            result = self._compute_window(self.current_window_start, window_end)
            self._clear_old_events(window_end)
            self.current_window_start = current_time
            return result
        return None

    def _check_sliding_window(self, current_time: datetime) -> Optional[WindowResult]:
        if not self.current_window_start:
            return None

        slide_end = self.current_window_start + self.slide_size
        if current_time >= slide_end:
            window_start = current_time - self.window_size
            result = self._compute_window(window_start, current_time)
            self.current_window_start = current_time
            self._clear_old_events(window_start)
            return result
        return None

    def _compute_window(self, start: datetime, end: datetime) -> WindowResult:
        window_events = [
            e for ts, e in self.events
            if start <= ts < end
        ]

        result = WindowResult(
            window_start=start,
            window_end=end,
            event_count=len(window_events),
        )

        for name, (field, agg_type) in self.aggregations.items():
            values = [e.get(field) for e in window_events if field in e]
            values = [v for v in values if v is not None]

            if not values:
                result.aggregations[name] = None
                continue

            if agg_type == AggregationType.COUNT:
                result.aggregations[name] = len(values)
            elif agg_type == AggregationType.SUM:
                result.aggregations[name] = sum(values)
            elif agg_type == AggregationType.AVG:
                result.aggregations[name] = sum(values) / len(values)
            elif agg_type == AggregationType.MIN:
                result.aggregations[name] = min(values)
            elif agg_type == AggregationType.MAX:
                result.aggregations[name] = max(values)
            elif agg_type == AggregationType.FIRST:
                result.aggregations[name] = values[0]
            elif agg_type == AggregationType.LAST:
                result.aggregations[name] = values[-1]

        self.results.append(result)
        return result

    def _clear_old_events(self, cutoff: datetime) -> None:
        while self.events and self.events[0][0] < cutoff:
            self.events.popleft()

    def flush(self) -> Optional[WindowResult]:
        if not self.events or not self.current_window_start:
            return None

        end = datetime.utcnow()
        result = self._compute_window(self.current_window_start, end)
        self.events.clear()
        self.current_window_start = None
        return result

    def get_results(self, limit: int = 100) -> list[WindowResult]:
        return self.results[-limit:]

    def get_stats(self) -> dict:
        return {
            "window_type": self.window_type.value,
            "window_size_seconds": self.window_size.total_seconds(),
            "events_in_buffer": len(self.events),
            "windows_computed": len(self.results),
            "aggregations": list(self.aggregations.keys()),
        }

    def clear(self) -> None:
        self.events.clear()
        self.results.clear()
        self.current_window_start = None
