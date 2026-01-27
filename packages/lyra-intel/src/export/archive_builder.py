"""
Archive builder for bundled exports.
"""

import io
import json
import tarfile
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class ArchiveFormat(Enum):
    ZIP = "zip"
    TAR = "tar"
    TAR_GZ = "tar.gz"


@dataclass
class ArchiveEntry:
    name: str = ""
    content: bytes = b""
    is_file: bool = True


class ArchiveBuilder:
    def __init__(self, format: ArchiveFormat = ArchiveFormat.ZIP):
        self.format = format
        self.entries: list[ArchiveEntry] = []

    def add_file(self, name: str, content: str | bytes) -> None:
        if isinstance(content, str):
            content = content.encode("utf-8")
        self.entries.append(ArchiveEntry(name=name, content=content))

    def add_json(self, name: str, data: Any) -> None:
        content = json.dumps(data, indent=2, default=str)
        self.add_file(f"{name}.json", content)

    def add_directory(self, name: str) -> None:
        self.entries.append(ArchiveEntry(name=name, content=b"", is_file=False))

    def build(self, output_path: str) -> str:
        if self.format == ArchiveFormat.ZIP:
            return self._build_zip(output_path)
        else:
            return self._build_tar(output_path)

    def _build_zip(self, output_path: str) -> str:
        filepath = f"{output_path}.zip"
        with zipfile.ZipFile(filepath, "w", zipfile.ZIP_DEFLATED) as zf:
            for entry in self.entries:
                if entry.is_file:
                    zf.writestr(entry.name, entry.content)
        return filepath

    def _build_tar(self, output_path: str) -> str:
        ext = ".tar.gz" if self.format == ArchiveFormat.TAR_GZ else ".tar"
        mode = "w:gz" if self.format == ArchiveFormat.TAR_GZ else "w"
        filepath = f"{output_path}{ext}"

        with tarfile.open(filepath, mode) as tf:
            for entry in self.entries:
                if entry.is_file:
                    info = tarfile.TarInfo(name=entry.name)
                    info.size = len(entry.content)
                    tf.addfile(info, io.BytesIO(entry.content))
                else:
                    info = tarfile.TarInfo(name=entry.name)
                    info.type = tarfile.DIRTYPE
                    tf.addfile(info)

        return filepath

    def build_bytes(self) -> bytes:
        buffer = io.BytesIO()
        if self.format == ArchiveFormat.ZIP:
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
                for entry in self.entries:
                    if entry.is_file:
                        zf.writestr(entry.name, entry.content)
        else:
            mode = "w:gz" if self.format == ArchiveFormat.TAR_GZ else "w"
            with tarfile.open(fileobj=buffer, mode=mode) as tf:
                for entry in self.entries:
                    if entry.is_file:
                        info = tarfile.TarInfo(name=entry.name)
                        info.size = len(entry.content)
                        tf.addfile(info, io.BytesIO(entry.content))
        return buffer.getvalue()

    def clear(self) -> None:
        self.entries = []

    def get_entry_count(self) -> int:
        return len(self.entries)

    def get_total_size(self) -> int:
        return sum(len(e.content) for e in self.entries)
