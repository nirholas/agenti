"""
Specialized format handlers for exports.
"""

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any


class JSONExporter:
    def __init__(self, pretty: bool = True):
        self.pretty = pretty

    def export(self, data: Any) -> str:
        return json.dumps(data, indent=2 if self.pretty else None, default=str)


class CSVExporter:
    def __init__(self, delimiter: str = ",", quote_char: str = '"'):
        self.delimiter = delimiter
        self.quote_char = quote_char

    def export(self, data: list[dict]) -> str:
        if not data:
            return ""
        headers = list(data[0].keys())
        lines = [self.delimiter.join(headers)]
        for row in data:
            values = []
            for h in headers:
                val = str(row.get(h, ""))
                if self.delimiter in val or self.quote_char in val:
                    val = f'{self.quote_char}{val.replace(self.quote_char, self.quote_char*2)}{self.quote_char}'
                values.append(val)
            lines.append(self.delimiter.join(values))
        return "\n".join(lines)


class HTMLExporter:
    def __init__(self, title: str = "Export", include_styles: bool = True):
        self.title = title
        self.include_styles = include_styles

    def export(self, data: Any) -> str:
        styles = """
        <style>
            body { font-family: system-ui, sans-serif; margin: 40px; }
            h1 { color: #333; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
        </style>
        """ if self.include_styles else ""

        html = [
            "<!DOCTYPE html>",
            "<html>",
            f"<head><meta charset='utf-8'><title>{self.title}</title>{styles}</head>",
            "<body>",
            f"<h1>{self.title}</h1>",
            f"<p>Generated: {datetime.utcnow().isoformat()}</p>",
        ]

        if isinstance(data, list) and data and isinstance(data[0], dict):
            html.append(self._render_table(data))
        else:
            html.append(f"<pre>{json.dumps(data, indent=2, default=str)}</pre>")

        html.extend(["</body>", "</html>"])
        return "\n".join(html)

    def _render_table(self, data: list[dict]) -> str:
        headers = list(data[0].keys())
        html = ["<table>", "<tr>"]
        for h in headers:
            html.append(f"<th>{h}</th>")
        html.append("</tr>")

        for row in data:
            html.append("<tr>")
            for h in headers:
                html.append(f"<td>{row.get(h, '')}</td>")
            html.append("</tr>")

        html.append("</table>")
        return "\n".join(html)


class PDFExporter:
    """PDF exporter (generates HTML that can be converted to PDF)."""

    def __init__(self, title: str = "Report"):
        self.title = title
        self.html_exporter = HTMLExporter(title=title)

    def export(self, data: Any) -> str:
        # Returns HTML that should be converted to PDF by a PDF library
        # In production, would use reportlab, weasyprint, or similar
        html = self.html_exporter.export(data)
        return f"<!-- PDF-ready HTML -->\n{html}"
