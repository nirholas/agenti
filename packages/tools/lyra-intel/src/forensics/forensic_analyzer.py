"""
Forensic Analyzer - Complete bidirectional code↔doc mapping with deep analysis.
"""

import asyncio
import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
import os

logger = logging.getLogger(__name__)


class RelationshipType(Enum):
    """Types of code-doc relationships."""
    IMPLEMENTS = "implements"  # Code implements documented feature
    REFERENCES = "references"  # Code references doc concept
    DOCUMENTS = "documents"    # Doc describes code
    ORPHAN_CODE = "orphan_code"  # Code with no documentation
    ORPHAN_DOC = "orphan_doc"    # Doc with no implementation
    OUTDATED = "outdated"      # Doc doesn't match code
    PARTIAL = "partial"        # Partial implementation


@dataclass
class CodeEntity:
    """Represents a code entity (function, class, file, etc.)."""
    path: str
    name: str
    entity_type: str  # file, function, class, method, variable
    line_start: int
    line_end: int
    content_hash: str
    imports: List[str] = field(default_factory=list)
    exports: List[str] = field(default_factory=list)
    calls: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)


@dataclass
class DocEntity:
    """Represents a documentation entity."""
    path: str
    title: str
    sections: List[str]
    code_references: List[str]  # Mentioned code paths/names
    keywords: List[str]
    last_modified: datetime
    content_hash: str


@dataclass
class Relationship:
    """Represents a relationship between code and docs."""
    relationship_type: RelationshipType
    code_entity: Optional[CodeEntity]
    doc_entity: Optional[DocEntity]
    confidence: float  # 0.0 - 1.0
    evidence: List[str]
    line_numbers: List[int] = field(default_factory=list)


@dataclass
class ForensicConfig:
    """Configuration for forensic analysis."""
    include_node_modules: bool = False
    include_build_dirs: bool = False
    max_file_size_mb: int = 10
    parallel_workers: int = 4
    enable_git_analysis: bool = True
    doc_extensions: List[str] = field(default_factory=lambda: [".md", ".mdx", ".rst", ".txt"])
    code_extensions: List[str] = field(default_factory=lambda: [
        ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".java", ".c", ".cpp", ".h"
    ])


class ForensicAnalyzer:
    """
    Complete forensic analyzer for bidirectional code↔doc mapping.
    
    Features:
    - Full codebase scanning
    - Documentation parsing
    - Relationship mapping
    - Orphan detection
    - Discrepancy identification
    - Git history correlation
    """
    
    def __init__(self, config: Optional[ForensicConfig] = None):
        self.config = config or ForensicConfig()
        self.code_entities: Dict[str, CodeEntity] = {}
        self.doc_entities: Dict[str, DocEntity] = {}
        self.relationships: List[Relationship] = []
        self._exclude_patterns = self._build_exclude_patterns()
    
    def _build_exclude_patterns(self) -> List[re.Pattern]:
        """Build file exclusion patterns."""
        patterns = [
            r"\.git/",
            r"__pycache__/",
            r"\.pyc$",
            r"\.pyo$",
        ]
        
        if not self.config.include_node_modules:
            patterns.append(r"node_modules/")
        
        if not self.config.include_build_dirs:
            patterns.extend([
                r"\.next/",
                r"dist/",
                r"build/",
                r"target/",
                r"\.cache/",
            ])
        
        return [re.compile(p) for p in patterns]
    
    def _should_exclude(self, path: str) -> bool:
        """Check if path should be excluded."""
        return any(p.search(path) for p in self._exclude_patterns)
    
    async def analyze_repository(self, repo_path: str) -> Dict[str, Any]:
        """
        Perform complete forensic analysis of a repository.
        
        Returns comprehensive mapping of all code and documentation relationships.
        """
        repo = Path(repo_path)
        
        logger.info(f"Starting forensic analysis of {repo}")
        
        # Phase 1: Collect all files
        all_files = await self._collect_all_files(repo)
        
        # Phase 2: Parse code files
        code_files = [f for f in all_files if f.suffix in self.config.code_extensions]
        await self._parse_code_files(code_files)
        
        # Phase 3: Parse documentation files
        doc_files = [f for f in all_files if f.suffix in self.config.doc_extensions]
        await self._parse_doc_files(doc_files)
        
        # Phase 4: Build relationships
        await self._build_relationships()
        
        # Phase 5: Detect orphans and discrepancies
        orphans = self._detect_orphans()
        discrepancies = await self._detect_discrepancies()
        
        # Phase 6: Generate report
        report = self._generate_forensic_report(orphans, discrepancies)
        
        return report
    
    async def _collect_all_files(self, repo: Path) -> List[Path]:
        """Collect all files in repository."""
        files = []
        max_size = self.config.max_file_size_mb * 1024 * 1024
        
        for root, dirs, filenames in os.walk(repo):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if not self._should_exclude(os.path.join(root, d, ""))]
            
            for filename in filenames:
                filepath = Path(root) / filename
                rel_path = str(filepath.relative_to(repo))
                
                if self._should_exclude(rel_path):
                    continue
                
                try:
                    if filepath.stat().st_size <= max_size:
                        files.append(filepath)
                except (OSError, IOError):
                    continue
        
        logger.info(f"Collected {len(files)} files for analysis")
        return files
    
    async def _parse_code_files(self, files: List[Path]):
        """Parse all code files to extract entities."""
        for filepath in files:
            try:
                content = filepath.read_text(encoding="utf-8", errors="ignore")
                entities = self._extract_code_entities(filepath, content)
                
                for entity in entities:
                    key = f"{entity.path}:{entity.name}"
                    self.code_entities[key] = entity
                    
            except Exception as e:
                logger.debug(f"Error parsing {filepath}: {e}")
        
        logger.info(f"Extracted {len(self.code_entities)} code entities")
    
    def _extract_code_entities(self, filepath: Path, content: str) -> List[CodeEntity]:
        """Extract code entities from a file."""
        entities = []
        content_hash = hashlib.md5(content.encode()).hexdigest()
        
        # Add file-level entity
        entities.append(CodeEntity(
            path=str(filepath),
            name=filepath.name,
            entity_type="file",
            line_start=1,
            line_end=content.count("\n") + 1,
            content_hash=content_hash,
        ))
        
        suffix = filepath.suffix
        
        # Python parsing
        if suffix == ".py":
            entities.extend(self._parse_python(filepath, content))
        
        # JavaScript/TypeScript parsing
        elif suffix in [".js", ".ts", ".tsx", ".jsx"]:
            entities.extend(self._parse_javascript(filepath, content))
        
        # Go parsing
        elif suffix == ".go":
            entities.extend(self._parse_go(filepath, content))
        
        return entities
    
    def _parse_python(self, filepath: Path, content: str) -> List[CodeEntity]:
        """Parse Python file for entities."""
        entities = []
        lines = content.split("\n")
        
        # Simple regex patterns for extraction
        function_pattern = re.compile(r"^(?:async\s+)?def\s+(\w+)\s*\(")
        class_pattern = re.compile(r"^class\s+(\w+)")
        import_pattern = re.compile(r"^(?:from\s+(\S+)\s+)?import\s+(.+)")
        
        current_class = None
        
        for i, line in enumerate(lines, 1):
            # Functions
            match = function_pattern.match(line)
            if match:
                name = match.group(1)
                if current_class:
                    name = f"{current_class}.{name}"
                
                entities.append(CodeEntity(
                    path=str(filepath),
                    name=name,
                    entity_type="function",
                    line_start=i,
                    line_end=i,  # Simplified
                    content_hash=hashlib.md5(line.encode()).hexdigest(),
                ))
            
            # Classes
            match = class_pattern.match(line)
            if match:
                current_class = match.group(1)
                entities.append(CodeEntity(
                    path=str(filepath),
                    name=current_class,
                    entity_type="class",
                    line_start=i,
                    line_end=i,
                    content_hash=hashlib.md5(line.encode()).hexdigest(),
                ))
            
            # Track imports
            match = import_pattern.match(line)
            if match:
                module = match.group(1) or match.group(2).split(",")[0].strip()
                if entities:
                    entities[-1].imports.append(module)
        
        return entities
    
    def _parse_javascript(self, filepath: Path, content: str) -> List[CodeEntity]:
        """Parse JavaScript/TypeScript file for entities."""
        entities = []
        lines = content.split("\n")
        
        patterns = {
            "function": re.compile(r"(?:export\s+)?(?:async\s+)?function\s+(\w+)"),
            "arrow_function": re.compile(r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>"),
            "class": re.compile(r"(?:export\s+)?class\s+(\w+)"),
            "interface": re.compile(r"(?:export\s+)?interface\s+(\w+)"),
            "type": re.compile(r"(?:export\s+)?type\s+(\w+)"),
        }
        
        for i, line in enumerate(lines, 1):
            for entity_type, pattern in patterns.items():
                match = pattern.search(line)
                if match:
                    entities.append(CodeEntity(
                        path=str(filepath),
                        name=match.group(1),
                        entity_type=entity_type,
                        line_start=i,
                        line_end=i,
                        content_hash=hashlib.md5(line.encode()).hexdigest(),
                    ))
        
        return entities
    
    def _parse_go(self, filepath: Path, content: str) -> List[CodeEntity]:
        """Parse Go file for entities."""
        entities = []
        lines = content.split("\n")
        
        func_pattern = re.compile(r"^func\s+(?:\([^)]+\)\s+)?(\w+)")
        type_pattern = re.compile(r"^type\s+(\w+)\s+(struct|interface)")
        
        for i, line in enumerate(lines, 1):
            match = func_pattern.match(line)
            if match:
                entities.append(CodeEntity(
                    path=str(filepath),
                    name=match.group(1),
                    entity_type="function",
                    line_start=i,
                    line_end=i,
                    content_hash=hashlib.md5(line.encode()).hexdigest(),
                ))
            
            match = type_pattern.match(line)
            if match:
                entities.append(CodeEntity(
                    path=str(filepath),
                    name=match.group(1),
                    entity_type=match.group(2),
                    line_start=i,
                    line_end=i,
                    content_hash=hashlib.md5(line.encode()).hexdigest(),
                ))
        
        return entities
    
    async def _parse_doc_files(self, files: List[Path]):
        """Parse all documentation files."""
        for filepath in files:
            try:
                content = filepath.read_text(encoding="utf-8", errors="ignore")
                doc = self._extract_doc_entity(filepath, content)
                self.doc_entities[str(filepath)] = doc
            except Exception as e:
                logger.debug(f"Error parsing doc {filepath}: {e}")
        
        logger.info(f"Parsed {len(self.doc_entities)} documentation files")
    
    def _extract_doc_entity(self, filepath: Path, content: str) -> DocEntity:
        """Extract documentation entity from file."""
        content_hash = hashlib.md5(content.encode()).hexdigest()
        
        # Extract title (first heading)
        title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        title = title_match.group(1) if title_match else filepath.stem
        
        # Extract sections (all headings)
        sections = re.findall(r"^#+\s+(.+)$", content, re.MULTILINE)
        
        # Extract code references (backticks, file paths, function names)
        code_refs = []
        code_refs.extend(re.findall(r"`([^`]+)`", content))  # Inline code
        code_refs.extend(re.findall(r"[\w/]+\.\w+", content))  # File paths
        code_refs.extend(re.findall(r"\b[A-Z][a-zA-Z]+(?:Service|Controller|Handler|Manager)\b", content))
        
        # Extract keywords
        keywords = re.findall(r"\b(?:function|class|method|API|endpoint|interface|type)\s+(\w+)", content, re.IGNORECASE)
        
        try:
            last_modified = datetime.fromtimestamp(filepath.stat().st_mtime)
        except OSError:
            last_modified = datetime.now()
        
        return DocEntity(
            path=str(filepath),
            title=title,
            sections=sections,
            code_references=list(set(code_refs)),
            keywords=keywords,
            last_modified=last_modified,
            content_hash=content_hash,
        )
    
    async def _build_relationships(self):
        """Build relationships between code and docs."""
        logger.info("Building code↔doc relationships...")
        
        # For each doc, find related code
        for doc_path, doc in self.doc_entities.items():
            for ref in doc.code_references:
                matches = self._find_code_matches(ref)
                for code_entity in matches:
                    self.relationships.append(Relationship(
                        relationship_type=RelationshipType.DOCUMENTS,
                        code_entity=code_entity,
                        doc_entity=doc,
                        confidence=0.8,
                        evidence=[f"Doc references '{ref}'"],
                    ))
        
        # For each code entity, check if documented
        documented_code = {r.code_entity.path for r in self.relationships if r.code_entity}
        
        for key, code in self.code_entities.items():
            if code.path not in documented_code:
                # Try to find related docs by name matching
                related_docs = self._find_doc_matches(code.name)
                
                if related_docs:
                    for doc in related_docs:
                        self.relationships.append(Relationship(
                            relationship_type=RelationshipType.PARTIAL,
                            code_entity=code,
                            doc_entity=doc,
                            confidence=0.5,
                            evidence=[f"Name match: {code.name}"],
                        ))
        
        logger.info(f"Built {len(self.relationships)} relationships")
    
    def _find_code_matches(self, reference: str) -> List[CodeEntity]:
        """Find code entities matching a reference."""
        matches = []
        ref_lower = reference.lower()
        
        for key, entity in self.code_entities.items():
            if ref_lower in entity.name.lower() or ref_lower in entity.path.lower():
                matches.append(entity)
        
        return matches[:10]  # Limit results
    
    def _find_doc_matches(self, name: str) -> List[DocEntity]:
        """Find documentation matching a code name."""
        matches = []
        name_lower = name.lower()
        
        for path, doc in self.doc_entities.items():
            title_lower = doc.title.lower()
            if name_lower in title_lower or any(name_lower in s.lower() for s in doc.sections):
                matches.append(doc)
        
        return matches[:5]
    
    def _detect_orphans(self) -> Dict[str, List]:
        """Detect orphan code and documentation."""
        documented_code = set()
        documenting_docs = set()
        
        for rel in self.relationships:
            if rel.code_entity:
                documented_code.add(f"{rel.code_entity.path}:{rel.code_entity.name}")
            if rel.doc_entity:
                documenting_docs.add(rel.doc_entity.path)
        
        orphan_code = []
        for key, entity in self.code_entities.items():
            if key not in documented_code and entity.entity_type in ["function", "class"]:
                orphan_code.append(entity)
        
        orphan_docs = []
        for path, doc in self.doc_entities.items():
            if path not in documenting_docs:
                orphan_docs.append(doc)
        
        logger.info(f"Found {len(orphan_code)} orphan code entities, {len(orphan_docs)} orphan docs")
        
        return {
            "orphan_code": orphan_code,
            "orphan_docs": orphan_docs,
        }
    
    async def _detect_discrepancies(self) -> List[Dict]:
        """Detect discrepancies between code and documentation."""
        discrepancies = []
        
        # Check for documented features not implemented
        for doc_path, doc in self.doc_entities.items():
            for ref in doc.code_references:
                matches = self._find_code_matches(ref)
                if not matches:
                    discrepancies.append({
                        "type": "missing_implementation",
                        "doc": doc_path,
                        "reference": ref,
                        "message": f"Documentation references '{ref}' but no matching code found",
                    })
        
        return discrepancies
    
    def _generate_forensic_report(self, orphans: Dict, discrepancies: List) -> Dict[str, Any]:
        """Generate comprehensive forensic report."""
        return {
            "summary": {
                "total_code_entities": len(self.code_entities),
                "total_doc_entities": len(self.doc_entities),
                "total_relationships": len(self.relationships),
                "orphan_code_count": len(orphans.get("orphan_code", [])),
                "orphan_doc_count": len(orphans.get("orphan_docs", [])),
                "discrepancy_count": len(discrepancies),
            },
            "code_entities": {
                k: {
                    "path": v.path,
                    "name": v.name,
                    "type": v.entity_type,
                    "line": v.line_start,
                }
                for k, v in list(self.code_entities.items())[:100]  # Sample
            },
            "doc_entities": {
                k: {
                    "title": v.title,
                    "sections": len(v.sections),
                    "code_references": len(v.code_references),
                }
                for k, v in self.doc_entities.items()
            },
            "relationships": [
                {
                    "type": r.relationship_type.value,
                    "code": r.code_entity.name if r.code_entity else None,
                    "doc": r.doc_entity.title if r.doc_entity else None,
                    "confidence": r.confidence,
                }
                for r in self.relationships[:100]
            ],
            "orphans": {
                "code": [
                    {"path": e.path, "name": e.name, "type": e.entity_type}
                    for e in orphans.get("orphan_code", [])[:50]
                ],
                "docs": [
                    {"path": d.path, "title": d.title}
                    for d in orphans.get("orphan_docs", [])[:50]
                ],
            },
            "discrepancies": discrepancies[:50],
            "generated_at": datetime.now().isoformat(),
        }
