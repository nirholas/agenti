"""
Main exporter for analysis results.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class ExportFormat(Enum):
    JSON = "json"
    CSV = "csv"
    HTML = "html"
    MARKDOWN = "markdown"
    PDF = "pdf"
    XML = "xml"
    YAML = "yaml"


@dataclass
class ExportConfig:
    output_dir: str = "./exports"
    default_format: ExportFormat = ExportFormat.JSON
    include_metadata: bool = True
    compress: bool = False
    pretty_print: bool = True


@dataclass
class ExportResult:
    path: str = ""
    format: ExportFormat = ExportFormat.JSON
    size_bytes: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)


class Exporter:
    def __init__(self, config: Optional[ExportConfig] = None):
        self.config = config or ExportConfig()
        self.exports: list[ExportResult] = []

    def export(
        self,
        data: Any,
        filename: str,
        format: Optional[ExportFormat] = None,
        metadata: Optional[dict] = None,
    ) -> ExportResult:
        format = format or self.config.default_format
        output_dir = Path(self.config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        ext = self._get_extension(format)
        filepath = output_dir / f"{filename}.{ext}"

        if self.config.include_metadata and metadata:
            data = {"_metadata": metadata, "_generated_at": datetime.utcnow().isoformat(), "data": data}

        content = self._serialize(data, format)
        filepath.write_text(content)

        result = ExportResult(
            path=str(filepath),
            format=format,
            size_bytes=len(content.encode()),
            metadata=metadata or {},
        )
        self.exports.append(result)
        return result

    def _get_extension(self, format: ExportFormat) -> str:
        extensions = {
            ExportFormat.JSON: "json",
            ExportFormat.CSV: "csv",
            ExportFormat.HTML: "html",
            ExportFormat.MARKDOWN: "md",
            ExportFormat.PDF: "pdf",
            ExportFormat.XML: "xml",
            ExportFormat.YAML: "yaml",
        }
        return extensions.get(format, "txt")

    def _serialize(self, data: Any, format: ExportFormat) -> str:
        if format == ExportFormat.JSON:
            return json.dumps(data, indent=2 if self.config.pretty_print else None, default=str)
        elif format == ExportFormat.CSV:
            return self._to_csv(data)
        elif format == ExportFormat.HTML:
            return self._to_html(data)
        elif format == ExportFormat.MARKDOWN:
            return self._to_markdown(data)
        elif format == ExportFormat.YAML:
            return self._to_yaml(data)
        elif format == ExportFormat.XML:
            return self._to_xml(data)
        else:
            return str(data)

    def _to_csv(self, data: Any) -> str:
        if isinstance(data, list) and data and isinstance(data[0], dict):
            headers = list(data[0].keys())
            lines = [",".join(headers)]
            for item in data:
                row = [str(item.get(h, "")) for h in headers]
                lines.append(",".join(f'"{v}"' for v in row))
            return "\n".join(lines)
        return str(data)

    def _to_html(self, data: Any) -> str:
        html = ["<!DOCTYPE html>", "<html>", "<head><meta charset='utf-8'><title>Export</title></head>", "<body>"]
        html.append("<pre>")
        html.append(json.dumps(data, indent=2, default=str))
        html.append("</pre>")
        html.append("</body></html>")
        return "\n".join(html)

    def _to_markdown(self, data: Any) -> str:
        lines = ["# Export", "", f"Generated: {datetime.utcnow().isoformat()}", "", "```json"]
        lines.append(json.dumps(data, indent=2, default=str))
        lines.append("```")
        return "\n".join(lines)

    def _to_yaml(self, data: Any) -> str:
        def _convert(obj: Any, indent: int = 0) -> str:
            prefix = "  " * indent
            if isinstance(obj, dict):
                lines = []
                for k, v in obj.items():
                    if isinstance(v, (dict, list)):
                        lines.append(f"{prefix}{k}:")
                        lines.append(_convert(v, indent + 1))
                    else:
                        lines.append(f"{prefix}{k}: {v}")
                return "\n".join(lines)
            elif isinstance(obj, list):
                lines = []
                for item in obj:
                    if isinstance(item, (dict, list)):
                        lines.append(f"{prefix}-")
                        lines.append(_convert(item, indent + 1))
                    else:
                        lines.append(f"{prefix}- {item}")
                return "\n".join(lines)
            return f"{prefix}{obj}"
        return _convert(data)

    def _to_xml(self, data: Any) -> str:
        def _convert(obj: Any, tag: str = "root") -> str:
            if isinstance(obj, dict):
                children = "".join(_convert(v, k) for k, v in obj.items())
                return f"<{tag}>{children}</{tag}>"
            elif isinstance(obj, list):
                children = "".join(_convert(item, "item") for item in obj)
                return f"<{tag}>{children}</{tag}>"
            return f"<{tag}>{obj}</{tag}>"
        return f'<?xml version="1.0" encoding="UTF-8"?>\n{_convert(data)}'

    def list_exports(self) -> list[ExportResult]:
        return self.exports

    def get_stats(self) -> dict:
        total_size = sum(e.size_bytes for e in self.exports)
        by_format = {}
        for e in self.exports:
            by_format[e.format.value] = by_format.get(e.format.value, 0) + 1
        return {
            "total_exports": len(self.exports),
            "total_size_bytes": total_size,
            "by_format": by_format,
        }
