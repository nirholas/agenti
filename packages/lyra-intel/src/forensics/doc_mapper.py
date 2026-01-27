"""
Documentation Mapper - Maps documentation to code and vice versa.
"""

import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


@dataclass
class DocMapping:
    """Represents a doc-to-code mapping."""
    doc_path: str
    doc_section: str
    code_path: str
    code_entity: str
    code_lines: Tuple[int, int]
    match_type: str  # explicit, inferred, keyword
    confidence: float
    last_verified: datetime


@dataclass
class CodeDocIndex:
    """Index for fast code↔doc lookups."""
    code_to_docs: Dict[str, List[DocMapping]] = field(default_factory=dict)
    doc_to_code: Dict[str, List[DocMapping]] = field(default_factory=dict)
    keywords: Dict[str, List[str]] = field(default_factory=dict)  # keyword -> [paths]


class DocumentationMapper:
    """
    Maps documentation to code bidirectionally.
    
    Creates a complete index of:
    - Which docs describe which code
    - Which code is documented where
    - Keywords and concepts across both
    """
    
    def __init__(self):
        self.index = CodeDocIndex()
        self._doc_cache: Dict[str, Dict] = {}
        self._code_cache: Dict[str, Dict] = {}
    
    def build_index(
        self,
        repo_path: str,
        doc_paths: List[str],
        code_paths: List[str],
    ) -> CodeDocIndex:
        """Build complete documentation index."""
        logger.info(f"Building doc index for {len(doc_paths)} docs and {len(code_paths)} code files")
        
        # Parse all docs
        for doc_path in doc_paths:
            self._index_document(doc_path)
        
        # Parse all code files for docstrings and comments
        for code_path in code_paths:
            self._index_code(code_path)
        
        # Build mappings
        self._build_mappings()
        
        logger.info(f"Index built: {len(self.index.code_to_docs)} code mappings, {len(self.index.doc_to_code)} doc mappings")
        
        return self.index
    
    def _index_document(self, doc_path: str):
        """Index a documentation file."""
        try:
            content = Path(doc_path).read_text(encoding="utf-8", errors="ignore")
            
            # Extract sections
            sections = self._extract_sections(content)
            
            # Extract code references
            code_refs = self._extract_code_references(content)
            
            # Extract keywords
            keywords = self._extract_keywords(content)
            
            self._doc_cache[doc_path] = {
                "sections": sections,
                "code_refs": code_refs,
                "keywords": keywords,
                "content_hash": hashlib.md5(content.encode()).hexdigest(),
            }
            
            # Update keyword index
            for keyword in keywords:
                if keyword not in self.index.keywords:
                    self.index.keywords[keyword] = []
                self.index.keywords[keyword].append(doc_path)
                
        except Exception as e:
            logger.debug(f"Error indexing {doc_path}: {e}")
    
    def _index_code(self, code_path: str):
        """Index a code file."""
        try:
            content = Path(code_path).read_text(encoding="utf-8", errors="ignore")
            
            # Extract docstrings
            docstrings = self._extract_docstrings(content, code_path)
            
            # Extract inline comments
            comments = self._extract_comments(content)
            
            # Extract entity names
            entities = self._extract_entities(content, code_path)
            
            self._code_cache[code_path] = {
                "docstrings": docstrings,
                "comments": comments,
                "entities": entities,
                "content_hash": hashlib.md5(content.encode()).hexdigest(),
            }
            
        except Exception as e:
            logger.debug(f"Error indexing code {code_path}: {e}")
    
    def _extract_sections(self, content: str) -> List[Dict]:
        """Extract document sections."""
        sections = []
        current_section = None
        current_content = []
        
        for line in content.split("\n"):
            heading_match = re.match(r"^(#+)\s+(.+)$", line)
            if heading_match:
                if current_section:
                    sections.append({
                        "level": current_section["level"],
                        "title": current_section["title"],
                        "content": "\n".join(current_content),
                    })
                current_section = {
                    "level": len(heading_match.group(1)),
                    "title": heading_match.group(2),
                }
                current_content = []
            elif current_section:
                current_content.append(line)
        
        if current_section:
            sections.append({
                "level": current_section["level"],
                "title": current_section["title"],
                "content": "\n".join(current_content),
            })
        
        return sections
    
    def _extract_code_references(self, content: str) -> List[Dict]:
        """Extract code references from documentation."""
        refs = []
        
        # Inline code
        for match in re.finditer(r"`([^`]+)`", content):
            refs.append({"type": "inline_code", "value": match.group(1)})
        
        # Code blocks
        for match in re.finditer(r"```(\w+)?\n(.*?)```", content, re.DOTALL):
            refs.append({
                "type": "code_block",
                "language": match.group(1) or "unknown",
                "value": match.group(2)[:200],  # First 200 chars
            })
        
        # File paths
        for match in re.finditer(r"(?:^|[\s(])([\w./]+\.(py|js|ts|tsx|go|rs|java))", content):
            refs.append({"type": "file_path", "value": match.group(1)})
        
        # Function/class references
        for match in re.finditer(r"\b([A-Z][a-zA-Z]+(?:Service|Controller|Manager|Handler|Factory))\b", content):
            refs.append({"type": "class_name", "value": match.group(1)})
        
        return refs
    
    def _extract_keywords(self, content: str) -> Set[str]:
        """Extract keywords from content."""
        keywords = set()
        
        # Common technical terms
        patterns = [
            r"\b(api|endpoint|route|handler)\b",
            r"\b(database|schema|model|entity)\b",
            r"\b(service|controller|manager)\b",
            r"\b(authentication|authorization|auth)\b",
            r"\b(async|await|promise|callback)\b",
            r"\b(test|spec|mock|stub)\b",
        ]
        
        content_lower = content.lower()
        for pattern in patterns:
            for match in re.finditer(pattern, content_lower):
                keywords.add(match.group(1))
        
        return keywords
    
    def _extract_docstrings(self, content: str, path: str) -> List[Dict]:
        """Extract docstrings from code."""
        docstrings = []
        
        if path.endswith(".py"):
            # Python docstrings
            for match in re.finditer(r'"""(.*?)"""', content, re.DOTALL):
                docstrings.append({
                    "type": "docstring",
                    "value": match.group(1).strip()[:500],
                })
        
        elif path.endswith((".js", ".ts", ".tsx", ".jsx")):
            # JSDoc comments
            for match in re.finditer(r"/\*\*(.*?)\*/", content, re.DOTALL):
                docstrings.append({
                    "type": "jsdoc",
                    "value": match.group(1).strip()[:500],
                })
        
        return docstrings
    
    def _extract_comments(self, content: str) -> List[str]:
        """Extract significant comments."""
        comments = []
        
        # TODO/FIXME/NOTE comments
        for match in re.finditer(r"(?://|#)\s*(TODO|FIXME|NOTE|HACK|XXX):\s*(.+)", content):
            comments.append(f"{match.group(1)}: {match.group(2)}")
        
        return comments
    
    def _extract_entities(self, content: str, path: str) -> List[Dict]:
        """Extract named entities from code."""
        entities = []
        lines = content.split("\n")
        
        for i, line in enumerate(lines, 1):
            # Functions
            for match in re.finditer(r"(?:def|function|func)\s+(\w+)", line):
                entities.append({
                    "type": "function",
                    "name": match.group(1),
                    "line": i,
                })
            
            # Classes
            for match in re.finditer(r"(?:class|interface|type)\s+(\w+)", line):
                entities.append({
                    "type": "class",
                    "name": match.group(1),
                    "line": i,
                })
        
        return entities
    
    def _build_mappings(self):
        """Build mappings between docs and code."""
        for doc_path, doc_data in self._doc_cache.items():
            for ref in doc_data.get("code_refs", []):
                ref_value = ref.get("value", "")
                
                # Find matching code files
                for code_path, code_data in self._code_cache.items():
                    for entity in code_data.get("entities", []):
                        if self._matches(ref_value, entity.get("name", ""), code_path):
                            mapping = DocMapping(
                                doc_path=doc_path,
                                doc_section="",  # Could be enhanced
                                code_path=code_path,
                                code_entity=entity.get("name", ""),
                                code_lines=(entity.get("line", 0), entity.get("line", 0)),
                                match_type=ref.get("type", "inferred"),
                                confidence=self._calculate_confidence(ref, entity),
                                last_verified=datetime.now(),
                            )
                            
                            # Add to both indexes
                            if code_path not in self.index.code_to_docs:
                                self.index.code_to_docs[code_path] = []
                            self.index.code_to_docs[code_path].append(mapping)
                            
                            if doc_path not in self.index.doc_to_code:
                                self.index.doc_to_code[doc_path] = []
                            self.index.doc_to_code[doc_path].append(mapping)
    
    def _matches(self, ref: str, entity_name: str, code_path: str) -> bool:
        """Check if a reference matches an entity."""
        ref_lower = ref.lower()
        
        # Direct name match
        if entity_name.lower() in ref_lower or ref_lower in entity_name.lower():
            return True
        
        # Path match
        if ref in code_path:
            return True
        
        return False
    
    def _calculate_confidence(self, ref: Dict, entity: Dict) -> float:
        """Calculate match confidence."""
        ref_type = ref.get("type", "")
        
        if ref_type == "file_path":
            return 0.9
        elif ref_type == "class_name":
            return 0.8
        elif ref_type == "inline_code":
            return 0.7
        else:
            return 0.5
    
    def get_docs_for_code(self, code_path: str) -> List[DocMapping]:
        """Get all documentation for a code file."""
        return self.index.code_to_docs.get(code_path, [])
    
    def get_code_for_doc(self, doc_path: str) -> List[DocMapping]:
        """Get all code referenced by a document."""
        return self.index.doc_to_code.get(doc_path, [])
    
    def search_by_keyword(self, keyword: str) -> List[str]:
        """Search docs by keyword."""
        return self.index.keywords.get(keyword.lower(), [])
    
    def export_index(self, output_path: str):
        """Export the index to JSON."""
        data = {
            "code_to_docs": {
                k: [
                    {
                        "doc_path": m.doc_path,
                        "code_entity": m.code_entity,
                        "confidence": m.confidence,
                    }
                    for m in v
                ]
                for k, v in self.index.code_to_docs.items()
            },
            "doc_to_code": {
                k: [
                    {
                        "code_path": m.code_path,
                        "code_entity": m.code_entity,
                        "code_lines": m.code_lines,
                    }
                    for m in v
                ]
                for k, v in self.index.doc_to_code.items()
            },
            "keywords": dict(self.index.keywords),
            "generated_at": datetime.now().isoformat(),
        }
        
        Path(output_path).write_text(json.dumps(data, indent=2))
        logger.info(f"Index exported to {output_path}")
