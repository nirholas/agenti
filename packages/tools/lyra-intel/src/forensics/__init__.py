"""
Forensic Analysis Module.

Provides:
- Complete codebase forensic mapping
- Bidirectional code↔doc relationships
- Dead code detection
- Complexity analysis
- Archive documentation indexer
"""

from .forensic_analyzer import ForensicAnalyzer, ForensicConfig
from .doc_mapper import DocumentationMapper
from .dead_code_detector import DeadCodeDetector
from .complexity_analyzer import ComplexityAnalyzer
from .archive_indexer import ArchiveIndexer

__all__ = [
    "ForensicAnalyzer",
    "ForensicConfig",
    "DocumentationMapper",
    "DeadCodeDetector",
    "ComplexityAnalyzer",
    "ArchiveIndexer",
]
