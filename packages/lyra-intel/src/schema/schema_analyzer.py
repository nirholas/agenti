"""
Schema Analyzer - Database schema analysis and recommendations.

This module analyzes database schemas from code (ORMs, migrations)
and provides insights and recommendations.
"""

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class SchemaTable:
    """Represents a database table."""
    name: str
    columns: List[Dict[str, Any]]
    primary_key: Optional[str] = None
    foreign_keys: List[Dict[str, str]] = field(default_factory=list)
    indexes: List[str] = field(default_factory=list)
    file_path: Optional[str] = None


@dataclass
class SchemaRelationship:
    """Represents a relationship between tables."""
    from_table: str
    to_table: str
    relationship_type: str  # one-to-one, one-to-many, many-to-many
    through_table: Optional[str] = None


@dataclass
class SchemaResult:
    """Result of schema analysis."""
    tables: List[SchemaTable]
    relationships: List[SchemaRelationship]
    issues: List[Dict[str, Any]]
    recommendations: List[str]
    statistics: Dict[str, Any]


class SchemaAnalyzer:
    """
    Analyzes database schemas from code.
    
    Features:
    - Parse ORM models (SQLAlchemy, Django, Prisma)
    - Detect relationships
    - Identify issues (missing indexes, etc.)
    - Generate ER diagrams
    """
    
    def __init__(self):
        """Initialize schema analyzer."""
        self._tables: List[SchemaTable] = []
        self._relationships: List[SchemaRelationship] = []
    
    def analyze_file(self, file_path: str, content: str) -> List[SchemaTable]:
        """
        Analyze a file for schema definitions.
        
        Args:
            file_path: Path to the file
            content: File content
            
        Returns:
            List of detected tables
        """
        tables = []
        
        # SQLAlchemy pattern
        sqlalchemy_pattern = r"class\s+(\w+)\(.*?(?:Base|Model|db\.Model).*?\):\s*\n(.*?)(?=\nclass|\Z)"
        
        for match in re.finditer(sqlalchemy_pattern, content, re.DOTALL):
            table_name = match.group(1)
            body = match.group(2)
            
            columns = self._extract_sqlalchemy_columns(body)
            pk = self._find_primary_key(columns)
            fks = self._find_foreign_keys(columns)
            
            tables.append(SchemaTable(
                name=table_name,
                columns=columns,
                primary_key=pk,
                foreign_keys=fks,
                file_path=file_path,
            ))
        
        # Django pattern
        django_pattern = r"class\s+(\w+)\(models\.Model\):\s*\n(.*?)(?=\nclass|\Z)"
        
        for match in re.finditer(django_pattern, content, re.DOTALL):
            table_name = match.group(1)
            body = match.group(2)
            
            columns = self._extract_django_columns(body)
            pk = self._find_primary_key(columns)
            fks = self._find_foreign_keys(columns)
            
            tables.append(SchemaTable(
                name=table_name,
                columns=columns,
                primary_key=pk,
                foreign_keys=fks,
                file_path=file_path,
            ))
        
        # Prisma pattern
        prisma_pattern = r"model\s+(\w+)\s*\{([^}]+)\}"
        
        for match in re.finditer(prisma_pattern, content):
            table_name = match.group(1)
            body = match.group(2)
            
            columns = self._extract_prisma_columns(body)
            pk = self._find_primary_key(columns)
            fks = self._find_foreign_keys(columns)
            
            tables.append(SchemaTable(
                name=table_name,
                columns=columns,
                primary_key=pk,
                foreign_keys=fks,
                file_path=file_path,
            ))
        
        return tables
    
    def _extract_sqlalchemy_columns(self, body: str) -> List[Dict[str, Any]]:
        """Extract columns from SQLAlchemy model."""
        columns = []
        
        # Match: column_name = Column(Type, ...)
        pattern = r"(\w+)\s*=\s*(?:db\.)?Column\(\s*(?:db\.)?(\w+)(?:\([^)]*\))?\s*(?:,([^)]+))?\)"
        
        for match in re.finditer(pattern, body):
            name = match.group(1)
            col_type = match.group(2)
            options = match.group(3) or ""
            
            columns.append({
                "name": name,
                "type": col_type,
                "nullable": "nullable=False" not in options,
                "primary_key": "primary_key=True" in options,
                "foreign_key": "ForeignKey" in options,
            })
        
        return columns
    
    def _extract_django_columns(self, body: str) -> List[Dict[str, Any]]:
        """Extract columns from Django model."""
        columns = []
        
        pattern = r"(\w+)\s*=\s*models\.(\w+)\(([^)]*)\)"
        
        for match in re.finditer(pattern, body):
            name = match.group(1)
            col_type = match.group(2)
            options = match.group(3)
            
            columns.append({
                "name": name,
                "type": col_type,
                "nullable": "null=True" in options,
                "primary_key": "primary_key=True" in options,
                "foreign_key": col_type in ["ForeignKey", "OneToOneField", "ManyToManyField"],
            })
        
        return columns
    
    def _extract_prisma_columns(self, body: str) -> List[Dict[str, Any]]:
        """Extract columns from Prisma model."""
        columns = []
        
        for line in body.strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("//") or line.startswith("@@"):
                continue
            
            parts = line.split()
            if len(parts) >= 2:
                name = parts[0]
                col_type = parts[1]
                
                columns.append({
                    "name": name,
                    "type": col_type.rstrip("?"),
                    "nullable": col_type.endswith("?"),
                    "primary_key": "@id" in line,
                    "foreign_key": "@relation" in line,
                })
        
        return columns
    
    def _find_primary_key(self, columns: List[Dict[str, Any]]) -> Optional[str]:
        """Find primary key column."""
        for col in columns:
            if col.get("primary_key"):
                return col["name"]
        return None
    
    def _find_foreign_keys(self, columns: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """Find foreign key columns."""
        fks = []
        for col in columns:
            if col.get("foreign_key"):
                fks.append({
                    "column": col["name"],
                    "references": col.get("references", "unknown"),
                })
        return fks
    
    def analyze_codebase(self, files: List[Dict[str, str]]) -> SchemaResult:
        """
        Analyze entire codebase for schemas.
        
        Args:
            files: List of {path, content} dicts
            
        Returns:
            Complete schema analysis
        """
        all_tables = []
        
        for file_info in files:
            path = file_info.get("path", "")
            content = file_info.get("content", "")
            
            if any(ext in path for ext in [".py", ".ts", ".prisma"]):
                tables = self.analyze_file(path, content)
                all_tables.extend(tables)
        
        # Detect relationships
        relationships = self._detect_relationships(all_tables)
        
        # Find issues
        issues = self._find_issues(all_tables)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(all_tables, issues)
        
        # Gather statistics
        statistics = {
            "total_tables": len(all_tables),
            "total_columns": sum(len(t.columns) for t in all_tables),
            "total_relationships": len(relationships),
            "tables_without_pk": sum(1 for t in all_tables if not t.primary_key),
        }
        
        return SchemaResult(
            tables=all_tables,
            relationships=relationships,
            issues=issues,
            recommendations=recommendations,
            statistics=statistics,
        )
    
    def _detect_relationships(self, tables: List[SchemaTable]) -> List[SchemaRelationship]:
        """Detect relationships between tables."""
        relationships = []
        table_names = {t.name.lower() for t in tables}
        
        for table in tables:
            for fk in table.foreign_keys:
                col_name = fk["column"].lower()
                # Try to find referenced table
                for other_name in table_names:
                    if other_name in col_name or col_name.replace("_id", "") == other_name:
                        relationships.append(SchemaRelationship(
                            from_table=table.name,
                            to_table=other_name,
                            relationship_type="many-to-one",
                        ))
                        break
        
        return relationships
    
    def _find_issues(self, tables: List[SchemaTable]) -> List[Dict[str, Any]]:
        """Find potential schema issues."""
        issues = []
        
        for table in tables:
            # Missing primary key
            if not table.primary_key:
                issues.append({
                    "type": "missing_primary_key",
                    "severity": "high",
                    "table": table.name,
                    "message": f"Table {table.name} has no primary key",
                })
            
            # Too many columns
            if len(table.columns) > 30:
                issues.append({
                    "type": "too_many_columns",
                    "severity": "medium",
                    "table": table.name,
                    "message": f"Table {table.name} has {len(table.columns)} columns. Consider normalization.",
                })
        
        return issues
    
    def _generate_recommendations(
        self,
        tables: List[SchemaTable],
        issues: List[Dict[str, Any]],
    ) -> List[str]:
        """Generate schema recommendations."""
        recs = []
        
        if any(i["type"] == "missing_primary_key" for i in issues):
            recs.append("🔑 Add primary keys to tables that are missing them")
        
        if any(i["type"] == "too_many_columns" for i in issues):
            recs.append("📊 Consider normalizing tables with many columns")
        
        if len(tables) > 50:
            recs.append("📁 Large schema detected. Consider modular organization.")
        
        return recs
    
    def generate_erd(self, tables: List[SchemaTable]) -> str:
        """Generate ERD in Mermaid format."""
        lines = ["erDiagram"]
        
        for table in tables:
            for col in table.columns[:5]:  # Limit columns for readability
                pk = "PK" if col.get("primary_key") else ""
                fk = "FK" if col.get("foreign_key") else ""
                key = pk or fk
                lines.append(f"    {table.name} {{{col['type']} {col['name']} {key}}}")
        
        return "\n".join(lines)
