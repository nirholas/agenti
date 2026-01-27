"""
Cron expression parser.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional


@dataclass
class CronSchedule:
    minute: str = "*"
    hour: str = "*"
    day_of_month: str = "*"
    month: str = "*"
    day_of_week: str = "*"
    expression: str = ""

    @classmethod
    def from_expression(cls, expr: str) -> "CronSchedule":
        parts = expr.strip().split()
        if len(parts) != 5:
            raise ValueError(f"Invalid cron expression: {expr}")
        return cls(
            minute=parts[0],
            hour=parts[1],
            day_of_month=parts[2],
            month=parts[3],
            day_of_week=parts[4],
            expression=expr,
        )


class CronParser:
    PRESETS = {
        "@yearly": "0 0 1 1 *",
        "@annually": "0 0 1 1 *",
        "@monthly": "0 0 1 * *",
        "@weekly": "0 0 * * 0",
        "@daily": "0 0 * * *",
        "@midnight": "0 0 * * *",
        "@hourly": "0 * * * *",
    }

    def __init__(self):
        pass

    def parse(self, expression: str) -> CronSchedule:
        if expression in self.PRESETS:
            expression = self.PRESETS[expression]
        return CronSchedule.from_expression(expression)

    def get_next_run(self, schedule: CronSchedule, from_time: Optional[datetime] = None) -> datetime:
        now = from_time or datetime.utcnow()
        next_run = now.replace(second=0, microsecond=0)

        for _ in range(366 * 24 * 60):  # Max search: 1 year
            if self._matches(schedule, next_run):
                if next_run > now:
                    return next_run
            next_run += timedelta(minutes=1)

        return now + timedelta(hours=1)

    def _matches(self, schedule: CronSchedule, dt: datetime) -> bool:
        # Convert Python weekday (Mon=0, Sun=6) to cron weekday (Sun=0, Sat=6)
        cron_weekday = (dt.weekday() + 1) % 7
        return (
            self._field_matches(schedule.minute, dt.minute, 0, 59) and
            self._field_matches(schedule.hour, dt.hour, 0, 23) and
            self._field_matches(schedule.day_of_month, dt.day, 1, 31) and
            self._field_matches(schedule.month, dt.month, 1, 12) and
            self._field_matches(schedule.day_of_week, cron_weekday, 0, 6)
        )

    def _field_matches(self, field: str, value: int, min_val: int, max_val: int) -> bool:
        if field == "*":
            return True

        for part in field.split(","):
            if "-" in part:
                start, end = map(int, part.split("-"))
                if start <= value <= end:
                    return True
            elif "/" in part:
                base, step = part.split("/")
                base_val = min_val if base == "*" else int(base)
                if (value - base_val) % int(step) == 0:
                    return True
            else:
                if int(part) == value:
                    return True

        return False

    def validate(self, expression: str) -> tuple[bool, str]:
        try:
            if expression in self.PRESETS:
                return True, ""
            schedule = self.parse(expression)
            return True, ""
        except ValueError as e:
            return False, str(e)
