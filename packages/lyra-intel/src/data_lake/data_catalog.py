"""
Data catalog for metadata management and discovery.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class EntryType(Enum):
    TABLE = "table"
    VIEW = "view"
    DATASET = "dataset"
    MODEL = "model"
    PIPELINE = "pipeline"


@dataclass
class ColumnSchema:
    name: str = ""
    data_type: str = ""
    nullable: bool = True
    description: str = ""
    tags: list[str] = field(default_factory=list)


@dataclass
class CatalogEntry:
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    entry_type: EntryType = EntryType.DATASET
    description: str = ""
    location: str = ""
    schema: list[ColumnSchema] = field(default_factory=list)
    owner: str = ""
    tags: list[str] = field(default_factory=list)
    lineage: list[str] = field(default_factory=list)  # Parent entry IDs
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)
    statistics: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.entry_type.value,
            "description": self.description,
            "location": self.location,
            "owner": self.owner,
            "tags": self.tags,
            "created_at": self.created_at.isoformat(),
        }


class DataCatalog:
    def __init__(self):
        self.entries: dict[str, CatalogEntry] = {}
        self.entries_by_name: dict[str, str] = {}

    def register(
        self,
        name: str,
        entry_type: EntryType,
        location: str,
        description: str = "",
        schema: Optional[list[ColumnSchema]] = None,
        owner: str = "",
        tags: Optional[list[str]] = None,
        lineage: Optional[list[str]] = None,
    ) -> CatalogEntry:
        entry = CatalogEntry(
            name=name,
            entry_type=entry_type,
            location=location,
            description=description,
            schema=schema or [],
            owner=owner,
            tags=tags or [],
            lineage=lineage or [],
        )
        self.entries[entry.id] = entry
        self.entries_by_name[name] = entry.id
        return entry

    def get(self, entry_id: str) -> Optional[CatalogEntry]:
        return self.entries.get(entry_id)

    def get_by_name(self, name: str) -> Optional[CatalogEntry]:
        entry_id = self.entries_by_name.get(name)
        return self.entries.get(entry_id) if entry_id else None

    def update(self, entry_id: str, **updates: Any) -> Optional[CatalogEntry]:
        entry = self.entries.get(entry_id)
        if not entry:
            return None
        for key, value in updates.items():
            if hasattr(entry, key):
                setattr(entry, key, value)
        entry.updated_at = datetime.utcnow()
        return entry

    def delete(self, entry_id: str) -> bool:
        entry = self.entries.get(entry_id)
        if not entry:
            return False
        self.entries_by_name.pop(entry.name, None)
        del self.entries[entry_id]
        return True

    def search(
        self,
        query: str = "",
        entry_type: Optional[EntryType] = None,
        tags: Optional[list[str]] = None,
        owner: Optional[str] = None,
    ) -> list[CatalogEntry]:
        results = []
        query_lower = query.lower()

        for entry in self.entries.values():
            if entry_type and entry.entry_type != entry_type:
                continue
            if owner and entry.owner != owner:
                continue
            if tags and not set(tags).issubset(set(entry.tags)):
                continue
            if query:
                if query_lower not in entry.name.lower() and query_lower not in entry.description.lower():
                    continue
            results.append(entry)

        return results

    def get_lineage(self, entry_id: str) -> dict:
        entry = self.entries.get(entry_id)
        if not entry:
            return {"error": "Entry not found"}

        upstream = []
        for parent_id in entry.lineage:
            parent = self.entries.get(parent_id)
            if parent:
                upstream.append(parent.to_dict())

        downstream = []
        for other in self.entries.values():
            if entry_id in other.lineage:
                downstream.append(other.to_dict())

        return {
            "entry": entry.to_dict(),
            "upstream": upstream,
            "downstream": downstream,
        }

    def add_tag(self, entry_id: str, tag: str) -> bool:
        entry = self.entries.get(entry_id)
        if not entry:
            return False
        if tag not in entry.tags:
            entry.tags.append(tag)
            entry.updated_at = datetime.utcnow()
        return True

    def remove_tag(self, entry_id: str, tag: str) -> bool:
        entry = self.entries.get(entry_id)
        if not entry or tag not in entry.tags:
            return False
        entry.tags.remove(tag)
        entry.updated_at = datetime.utcnow()
        return True

    def update_statistics(self, entry_id: str, stats: dict) -> bool:
        entry = self.entries.get(entry_id)
        if not entry:
            return False
        entry.statistics.update(stats)
        entry.updated_at = datetime.utcnow()
        return True

    def list_all(self, entry_type: Optional[EntryType] = None) -> list[CatalogEntry]:
        if entry_type:
            return [e for e in self.entries.values() if e.entry_type == entry_type]
        return list(self.entries.values())

    def get_stats(self) -> dict:
        by_type = {}
        by_owner = {}
        all_tags = {}

        for entry in self.entries.values():
            type_val = entry.entry_type.value
            by_type[type_val] = by_type.get(type_val, 0) + 1

            if entry.owner:
                by_owner[entry.owner] = by_owner.get(entry.owner, 0) + 1

            for tag in entry.tags:
                all_tags[tag] = all_tags.get(tag, 0) + 1

        return {
            "total_entries": len(self.entries),
            "by_type": by_type,
            "by_owner": by_owner,
            "top_tags": sorted(all_tags.items(), key=lambda x: x[1], reverse=True)[:10],
        }

    def export_catalog(self) -> list[dict]:
        return [entry.to_dict() for entry in self.entries.values()]
