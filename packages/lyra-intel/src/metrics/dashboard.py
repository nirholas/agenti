"""
Metrics Dashboard - Real-time metrics visualization.

Provides:
- Terminal dashboard
- JSON API output
- HTML dashboard
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json

from .collector import MetricsCollector, get_metrics

logger = logging.getLogger(__name__)


class MetricsDashboard:
    """
    Real-time metrics dashboard.
    
    Features:
    - Terminal output
    - JSON export
    - HTML dashboard
    """
    
    def __init__(self, collector: Optional[MetricsCollector] = None):
        self.collector = collector or get_metrics()
    
    def render_terminal(self) -> str:
        """
        Render metrics as terminal output.
        
        Returns:
            Formatted string for terminal display
        """
        metrics = self.collector.get_all()
        
        lines = [
            "=" * 60,
            "       📊 LYRA INTEL METRICS DASHBOARD",
            "=" * 60,
            f"       Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
        ]
        
        # Counters
        if metrics["counters"]:
            lines.append("📈 COUNTERS")
            lines.append("-" * 40)
            for name, value in sorted(metrics["counters"].items()):
                lines.append(f"  {name}: {value:,.0f}")
            lines.append("")
        
        # Gauges
        if metrics["gauges"]:
            lines.append("📉 GAUGES")
            lines.append("-" * 40)
            for name, value in sorted(metrics["gauges"].items()):
                lines.append(f"  {name}: {value:,.2f}")
            lines.append("")
        
        # Timers
        if metrics["timers"]:
            lines.append("⏱️  TIMERS")
            lines.append("-" * 40)
            for name, stats in sorted(metrics["timers"].items()):
                lines.append(f"  {name}:")
                lines.append(f"    count: {stats['count']:,}")
                lines.append(f"    mean: {stats['mean_ms']:.2f}ms")
                lines.append(f"    p95: {stats['p95_ms']:.2f}ms")
                lines.append(f"    p99: {stats['p99_ms']:.2f}ms")
            lines.append("")
        
        # Histograms
        if metrics["histograms"]:
            lines.append("📊 HISTOGRAMS")
            lines.append("-" * 40)
            for name, stats in sorted(metrics["histograms"].items()):
                lines.append(f"  {name}:")
                lines.append(f"    count: {stats['count']:,}")
                lines.append(f"    mean: {stats['mean']:.2f}")
                lines.append(f"    p95: {stats['p95']:.2f}")
            lines.append("")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    def render_json(self) -> str:
        """
        Render metrics as JSON.
        
        Returns:
            JSON string
        """
        data = {
            "timestamp": datetime.now().isoformat(),
            "metrics": self.collector.get_all(),
        }
        return json.dumps(data, indent=2)
    
    def render_html(self) -> str:
        """
        Render metrics as HTML dashboard.
        
        Returns:
            HTML string
        """
        metrics = self.collector.get_all()
        
        # Build counter cards
        counter_cards = ""
        for name, value in sorted(metrics["counters"].items()):
            counter_cards += f'''
            <div class="card">
                <h3>{name}</h3>
                <div class="value">{value:,.0f}</div>
                <div class="type">Counter</div>
            </div>
            '''
        
        # Build gauge cards
        gauge_cards = ""
        for name, value in sorted(metrics["gauges"].items()):
            gauge_cards += f'''
            <div class="card">
                <h3>{name}</h3>
                <div class="value">{value:,.2f}</div>
                <div class="type">Gauge</div>
            </div>
            '''
        
        # Build timer cards
        timer_cards = ""
        for name, stats in sorted(metrics["timers"].items()):
            timer_cards += f'''
            <div class="card wide">
                <h3>{name}</h3>
                <div class="stats">
                    <div><span class="label">Count:</span> {stats['count']:,}</div>
                    <div><span class="label">Mean:</span> {stats['mean_ms']:.2f}ms</div>
                    <div><span class="label">P95:</span> {stats['p95_ms']:.2f}ms</div>
                    <div><span class="label">P99:</span> {stats['p99_ms']:.2f}ms</div>
                </div>
                <div class="type">Timer</div>
            </div>
            '''
        
        html = f'''<!DOCTYPE html>
<html>
<head>
    <title>Lyra Intel Metrics Dashboard</title>
    <meta http-equiv="refresh" content="5">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            padding: 20px;
        }}
        header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        h1 {{ color: #4CAF50; font-size: 2em; }}
        .timestamp {{ color: #888; font-size: 0.9em; }}
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .card {{
            background: #16213e;
            border-radius: 10px;
            padding: 20px;
            border-left: 4px solid #4CAF50;
        }}
        .card.wide {{
            grid-column: span 2;
        }}
        .card h3 {{
            font-size: 0.9em;
            color: #888;
            margin-bottom: 10px;
            word-break: break-all;
        }}
        .card .value {{
            font-size: 2em;
            font-weight: bold;
            color: #4CAF50;
        }}
        .card .type {{
            font-size: 0.8em;
            color: #666;
            margin-top: 10px;
        }}
        .card .stats {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin: 10px 0;
        }}
        .card .stats .label {{
            color: #888;
        }}
        section {{
            margin-bottom: 30px;
        }}
        section h2 {{
            color: #4CAF50;
            margin-bottom: 15px;
            font-size: 1.2em;
        }}
    </style>
</head>
<body>
    <header>
        <h1>📊 Lyra Intel Metrics</h1>
        <div class="timestamp">Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
    </header>
    
    <section>
        <h2>📈 Counters</h2>
        <div class="grid">{counter_cards if counter_cards else '<div class="card"><div class="value">No data</div></div>'}</div>
    </section>
    
    <section>
        <h2>📉 Gauges</h2>
        <div class="grid">{gauge_cards if gauge_cards else '<div class="card"><div class="value">No data</div></div>'}</div>
    </section>
    
    <section>
        <h2>⏱️ Timers</h2>
        <div class="grid">{timer_cards if timer_cards else '<div class="card"><div class="value">No data</div></div>'}</div>
    </section>
</body>
</html>'''
        
        return html
    
    def print_summary(self) -> None:
        """Print a quick summary to stdout."""
        print(self.render_terminal())
    
    def save_html(self, path: str) -> None:
        """Save HTML dashboard to file."""
        from pathlib import Path
        Path(path).write_text(self.render_html())
        logger.info(f"Dashboard saved to: {path}")
    
    def get_summary_stats(self) -> Dict[str, Any]:
        """Get summary statistics."""
        metrics = self.collector.get_all()
        
        return {
            "total_counters": len(metrics["counters"]),
            "total_gauges": len(metrics["gauges"]),
            "total_timers": len(metrics["timers"]),
            "total_histograms": len(metrics["histograms"]),
            "total_counter_value": sum(metrics["counters"].values()),
        }
