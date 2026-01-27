"""
Archive Indexer - Creates indexed archive of documentation for future reference.
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class ArchivedDocument:
    """Represents an archived document."""
    original_path: str
    title: str
    description: str
    category: str
    importance: str  # critical, important, reference, noise
    future_relevance: str
    code_connections: List[Dict[str, Any]]
    line_numbers: Dict[str, List[int]]  # {code_file: [lines implementing documented features]}
    keywords: List[str]
    content_hash: str
    archived_date: datetime
    file_size_bytes: int


@dataclass
class ArchiveIndex:
    """Index for archived documentation."""
    documents: List[ArchivedDocument] = field(default_factory=list)
    categories: Dict[str, List[str]] = field(default_factory=dict)
    quick_reference: Dict[str, str] = field(default_factory=dict)
    recovery_instructions: str = ""
    before_snapshot: str = ""
    after_snapshot: str = ""


class ArchiveIndexer:
    """
    Creates an index for archived documentation.
    
    Generates ARCHIVED_DOCUMENTATION_INDEX.md with:
    - Every removed doc with description and future relevance
    - Code line numbers implementing documented features
    - BEFORE (full backup) and AFTER (lean reference) versions
    """
    
    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
        self.index = ArchiveIndex()
    
    def build_archive_index(
        self,
        docs_to_archive: List[str],
        code_mappings: Dict[str, List[Dict]],
    ) -> ArchiveIndex:
        """Build complete archive index."""
        logger.info(f"Building archive index for {len(docs_to_archive)} documents")
        
        for doc_path in docs_to_archive:
            archived_doc = self._process_document(doc_path, code_mappings)
            if archived_doc:
                self.index.documents.append(archived_doc)
                
                # Update categories
                cat = archived_doc.category
                if cat not in self.index.categories:
                    self.index.categories[cat] = []
                self.index.categories[cat].append(archived_doc.original_path)
        
        # Build quick reference
        self._build_quick_reference()
        
        # Generate recovery instructions
        self._generate_recovery_instructions()
        
        return self.index
    
    def _process_document(
        self,
        doc_path: str,
        code_mappings: Dict[str, List[Dict]],
    ) -> Optional[ArchivedDocument]:
        """Process a single document for archiving."""
        try:
            path = Path(doc_path)
            content = path.read_text(encoding="utf-8", errors="ignore")
            
            # Extract metadata
            title = self._extract_title(content)
            description = self._generate_description(content)
            category = self._categorize_document(path, content)
            importance = self._assess_importance(content, code_mappings.get(doc_path, []))
            future_relevance = self._assess_future_relevance(content, category)
            
            # Get code connections
            connections = code_mappings.get(doc_path, [])
            line_numbers = self._extract_line_numbers(connections)
            
            # Extract keywords
            keywords = self._extract_keywords(content)
            
            return ArchivedDocument(
                original_path=doc_path,
                title=title,
                description=description,
                category=category,
                importance=importance,
                future_relevance=future_relevance,
                code_connections=connections,
                line_numbers=line_numbers,
                keywords=keywords,
                content_hash=hashlib.md5(content.encode()).hexdigest(),
                archived_date=datetime.now(),
                file_size_bytes=len(content.encode()),
            )
            
        except Exception as e:
            logger.error(f"Error processing {doc_path}: {e}")
            return None
    
    def _extract_title(self, content: str) -> str:
        """Extract document title."""
        import re
        match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        return match.group(1) if match else "Untitled"
    
    def _generate_description(self, content: str) -> str:
        """Generate brief description from content."""
        # Get first paragraph after title
        lines = content.split("\n")
        description_lines = []
        
        started = False
        for line in lines:
            if line.startswith("#"):
                if started:
                    break
                started = True
                continue
            
            if started and line.strip():
                description_lines.append(line.strip())
                if len(" ".join(description_lines)) > 200:
                    break
        
        description = " ".join(description_lines)
        return description[:250] + "..." if len(description) > 250 else description
    
    def _categorize_document(self, path: Path, content: str) -> str:
        """Categorize document based on path and content."""
        path_str = str(path).lower()
        content_lower = content.lower()
        
        categories = [
            ("architecture", ["architecture", "design", "structure", "system"]),
            ("planning", ["planning", "roadmap", "todo", "task", "strategy"]),
            ("research", ["research", "analysis", "study", "investigation"]),
            ("guides", ["guide", "tutorial", "how-to", "setup", "install"]),
            ("fixes", ["fix", "bug", "issue", "debug", "solution"]),
            ("internal", ["internal", "changelog", "notes", "summary"]),
            ("mcp", ["mcp", "plugin", "tool"]),
            ("agents", ["agent", "assistant", "ai"]),
            ("api", ["api", "endpoint", "route"]),
        ]
        
        for category, keywords in categories:
            if any(kw in path_str or kw in content_lower[:500] for kw in keywords):
                return category
        
        return "general"
    
    def _assess_importance(self, content: str, connections: List[Dict]) -> str:
        """Assess document importance."""
        score = 0
        
        # Has code connections
        if connections:
            score += len(connections) * 2
        
        # Contains implementation details
        if "```" in content:
            score += 5
        
        # Contains diagrams or architecture
        if any(kw in content.lower() for kw in ["diagram", "architecture", "flow"]):
            score += 3
        
        # Length indicates depth
        if len(content) > 5000:
            score += 2
        
        # Has clear structure
        if content.count("#") > 5:
            score += 2
        
        if score >= 10:
            return "critical"
        elif score >= 6:
            return "important"
        elif score >= 3:
            return "reference"
        else:
            return "noise"
    
    def _assess_future_relevance(self, content: str, category: str) -> str:
        """Assess future relevance of document."""
        content_lower = content.lower()
        
        # High future relevance
        if category in ["architecture", "planning"]:
            return "High - Core system design documentation"
        
        if any(kw in content_lower for kw in ["future", "roadmap", "planned", "milestone"]):
            return "High - Contains future development plans"
        
        if any(kw in content_lower for kw in ["api", "interface", "contract"]):
            return "Medium - API/interface documentation may be needed"
        
        # Low relevance
        if category == "fixes":
            return "Low - Historical fix documentation"
        
        if category == "internal":
            return "Low - Internal notes, likely outdated"
        
        return "Medium - May be useful as reference"
    
    def _extract_line_numbers(self, connections: List[Dict]) -> Dict[str, List[int]]:
        """Extract line numbers from code connections."""
        line_numbers = {}
        
        for conn in connections:
            code_path = conn.get("code_path", "")
            lines = conn.get("code_lines", (0, 0))
            
            if code_path:
                if code_path not in line_numbers:
                    line_numbers[code_path] = []
                if isinstance(lines, (list, tuple)) and len(lines) == 2:
                    line_numbers[code_path].extend(range(lines[0], lines[1] + 1))
                elif isinstance(lines, int):
                    line_numbers[code_path].append(lines)
        
        return line_numbers
    
    def _extract_keywords(self, content: str) -> List[str]:
        """Extract keywords from content."""
        import re
        
        # Common technical keywords
        keywords = set()
        
        # Extract from headings
        for match in re.finditer(r"^#+\s+(.+)$", content, re.MULTILINE):
            words = match.group(1).lower().split()
            keywords.update(w for w in words if len(w) > 3)
        
        # Extract code references
        for match in re.finditer(r"`([^`]+)`", content):
            keywords.add(match.group(1).lower())
        
        return list(keywords)[:20]
    
    def _build_quick_reference(self):
        """Build quick reference table."""
        needs = {
            "Agent development": [],
            "MCP plugins": [],
            "Architecture understanding": [],
            "Feature specifications": [],
            "Migration planning": [],
        }
        
        for doc in self.index.documents:
            if doc.importance in ["critical", "important"]:
                if "agent" in doc.category:
                    needs["Agent development"].append(doc.original_path)
                if "mcp" in doc.category:
                    needs["MCP plugins"].append(doc.original_path)
                if "architecture" in doc.category:
                    needs["Architecture understanding"].append(doc.original_path)
                if "planning" in doc.category:
                    needs["Feature specifications"].append(doc.original_path)
                    needs["Migration planning"].append(doc.original_path)
        
        self.index.quick_reference = {k: v[0] if v else "" for k, v in needs.items() if v}
    
    def _generate_recovery_instructions(self):
        """Generate recovery instructions."""
        self.index.recovery_instructions = """
## Recovery Instructions

**If you need a document:**
1. Plug in external hard drive
2. Navigate to `/backup-docs/`
3. Use this index to find the file path
4. Copy it back to your repository if needed

**Using the code line mappings:**
When a doc shows line numbers like:
```
src/services/agent.ts: [45-230]
```
This means lines 45-230 implement the documented feature.
You can view those lines to understand the implementation.

**Re-generating fresh documentation:**
Instead of restoring old docs, consider asking AI to:
1. Read the code at the specified line numbers
2. Generate updated documentation based on current implementation
3. This ensures docs are always in sync with code
"""
    
    def export_markdown(self, output_path: str):
        """Export archive index as markdown."""
        lines = [
            "# Archived Documentation Index",
            "",
            f"**Archived Date:** {datetime.now().strftime('%Y-%m-%d')}",
            f"**Total Documents:** {len(self.index.documents)}",
            f"**Location:** External Hard Drive `/backup-docs/`",
            "",
            "---",
            "",
            "## Quick Reference: When You Need These",
            "",
            "| Need | Look For |",
            "|------|----------|",
        ]
        
        for need, path in self.index.quick_reference.items():
            lines.append(f"| {need} | `{path}` |")
        
        lines.extend([
            "",
            "---",
            "",
            "## By Category",
            "",
        ])
        
        for category, paths in sorted(self.index.categories.items()):
            category_docs = [d for d in self.index.documents if d.original_path in paths]
            
            lines.append(f"### 📁 {category.title()} ({len(category_docs)} files)")
            lines.append(f"**When to reference:** {self._get_category_description(category)}")
            lines.append("")
            
            for doc in category_docs:
                importance_icon = {"critical": "🔴", "important": "🟡", "reference": "🟢", "noise": "⚪"}.get(doc.importance, "⚪")
                lines.append(f"- {importance_icon} `{doc.original_path}`")
                lines.append(f"  - **{doc.title}**")
                lines.append(f"  - {doc.description}")
                lines.append(f"  - Future relevance: {doc.future_relevance}")
                
                if doc.line_numbers:
                    lines.append(f"  - Code references:")
                    for code_file, line_list in list(doc.line_numbers.items())[:3]:
                        if line_list:
                            lines.append(f"    - `{code_file}`: lines {min(line_list)}-{max(line_list)}")
                
                lines.append("")
        
        lines.extend([
            "---",
            "",
            "## Importance Legend",
            "",
            "- 🔴 **Critical** - Essential documentation, needed for core understanding",
            "- 🟡 **Important** - Useful reference material",
            "- 🟢 **Reference** - May be helpful occasionally",
            "- ⚪ **Noise** - Likely safe to ignore",
            "",
            "---",
            "",
            self.index.recovery_instructions,
        ])
        
        content = "\n".join(lines)
        Path(output_path).write_text(content)
        logger.info(f"Archive index exported to {output_path}")
    
    def _get_category_description(self, category: str) -> str:
        """Get description for a category."""
        descriptions = {
            "architecture": "Understanding system design, component relationships",
            "planning": "Feature roadmaps, migration strategies, future development",
            "research": "Background information, competitor analysis, market research",
            "guides": "Development setup, deployment, troubleshooting",
            "fixes": "Historical bug fixes and debugging sessions",
            "internal": "Internal notes, changelogs, meeting notes",
            "mcp": "MCP plugin development and integration",
            "agents": "AI agent creation and configuration",
            "api": "API endpoints, request/response formats",
            "general": "Miscellaneous documentation",
        }
        return descriptions.get(category, "General reference material")
    
    def export_json(self, output_path: str):
        """Export archive index as JSON."""
        data = {
            "documents": [
                {
                    "path": d.original_path,
                    "title": d.title,
                    "description": d.description,
                    "category": d.category,
                    "importance": d.importance,
                    "future_relevance": d.future_relevance,
                    "keywords": d.keywords,
                    "code_connections": len(d.code_connections),
                    "line_numbers": d.line_numbers,
                    "content_hash": d.content_hash,
                    "archived_date": d.archived_date.isoformat(),
                }
                for d in self.index.documents
            ],
            "categories": self.index.categories,
            "quick_reference": self.index.quick_reference,
            "generated_at": datetime.now().isoformat(),
        }
        
        Path(output_path).write_text(json.dumps(data, indent=2))
        logger.info(f"Archive index exported to {output_path}")
