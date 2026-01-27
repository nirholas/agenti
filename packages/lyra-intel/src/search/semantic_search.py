"""
Semantic Search - Vector-based code search.

Uses embeddings for semantic similarity search:
- Natural language to code search
- Similar code detection
- Concept-based search
"""

import json
import hashlib
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import logging
import math

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Search result with relevance score."""
    id: str
    content: str
    file_path: str
    line_start: int
    line_end: int
    score: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "file_path": self.file_path,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "score": self.score,
            "metadata": self.metadata,
        }


@dataclass
class SearchConfig:
    """Configuration for semantic search."""
    embedding_dim: int = 384  # Default for small models
    max_results: int = 20
    similarity_threshold: float = 0.5
    chunk_size: int = 500  # Characters per chunk
    chunk_overlap: int = 100
    use_gpu: bool = False
    model_name: str = "all-MiniLM-L6-v2"  # Sentence transformer model


class SemanticSearch:
    """
    Semantic search engine using vector embeddings.
    
    Features:
    - Natural language to code search
    - Similar code detection
    - Concept-based search
    - Hybrid search (semantic + keyword)
    """
    
    def __init__(self, config: Optional[SearchConfig] = None):
        self.config = config or SearchConfig()
        self._embeddings: Dict[str, List[float]] = {}
        self._documents: Dict[str, Dict[str, Any]] = {}
        self._model = None
        self._use_simple_embeddings = True  # Fallback to simple embeddings
        
        # Try to load sentence-transformers
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.config.model_name)
            self._use_simple_embeddings = False
            logger.info(f"Loaded semantic model: {self.config.model_name}")
        except ImportError:
            logger.warning("sentence-transformers not available, using fallback embeddings")
        except Exception as e:
            logger.warning(f"Failed to load semantic model: {e}, using fallback")
    
    def _simple_embed(self, text: str) -> List[float]:
        """
        Create a simple embedding using character/word statistics.
        
        This is a fallback when ML libraries aren't available.
        Real implementation would use sentence-transformers.
        """
        # Normalize text
        text = text.lower()
        
        # Create feature vector
        features = []
        
        # Character frequency features (26 letters + 10 digits + common symbols)
        chars = "abcdefghijklmnopqrstuvwxyz0123456789_()[]{}.:;,!?"
        text_len = max(len(text), 1)
        for char in chars:
            features.append(text.count(char) / text_len)
        
        # Word-level features
        words = text.split()
        num_words = max(len(words), 1)
        
        # Average word length
        if words:
            features.append(sum(len(w) for w in words) / num_words / 20)
        else:
            features.append(0)
        
        # Code-specific keywords
        code_keywords = [
            "def", "function", "class", "if", "else", "for", "while",
            "return", "import", "from", "async", "await", "try", "except",
            "const", "let", "var", "public", "private", "static"
        ]
        for keyword in code_keywords:
            features.append(1.0 if keyword in words else 0.0)
        
        # Normalize to unit vector
        magnitude = math.sqrt(sum(f * f for f in features))
        if magnitude > 0:
            features = [f / magnitude for f in features]
        
        # Pad or truncate to embedding_dim
        while len(features) < self.config.embedding_dim:
            features.append(0.0)
        features = features[:self.config.embedding_dim]
        
        return features
    
    def embed(self, text: str) -> List[float]:
        """
        Generate embedding for text.
        
        Uses sentence-transformers if available, falls back to simple method.
        """
        if self._use_simple_embeddings:
            return self._simple_embed(text)
        
        try:
            # Use sentence-transformers for real embeddings
            embedding = self._model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            logger.warning(f"Embedding failed, using fallback: {e}")
            return self._simple_embed(text)
    
    def index_code(self, code_units: List[Dict[str, Any]], file_contents: Dict[str, str]):
        """
        Index code units for semantic search.
        
        Args:
            code_units: List of code unit dictionaries
            file_contents: Map of file paths to file contents
        """
        logger.info(f"Indexing {len(code_units)} code units...")
        
        for unit in code_units:
            file_path = unit.get("file_path", "")
            name = unit.get("name", "")
            unit_type = unit.get("type", "")
            docstring = unit.get("docstring", "")
            line_start = unit.get("line_start", 0)
            line_end = unit.get("line_end", 0)
            
            # Get code content
            content = ""
            if file_path in file_contents and line_start and line_end:
                lines = file_contents[file_path].split("\n")
                content = "\n".join(lines[line_start-1:line_end])
            
            # Create document ID
            doc_id = hashlib.md5(f"{file_path}::{name}::{line_start}".encode()).hexdigest()
            
            # Create text for embedding (combine name, docstring, content)
            embed_text = f"{name} {docstring} {content}"
            
            # Generate embedding
            embedding = self.embed(embed_text)
            
            # Store
            self._embeddings[doc_id] = embedding
            self._documents[doc_id] = {
                "id": doc_id,
                "name": name,
                "type": unit_type,
                "file_path": file_path,
                "line_start": line_start,
                "line_end": line_end,
                "content": content[:500],  # Truncate for storage
                "docstring": docstring,
            }
        
        logger.info(f"Indexed {len(self._documents)} documents")
    
    def search(self, query: str, top_k: int = None) -> List[SearchResult]:
        """
        Search for code semantically similar to query.
        
        Args:
            query: Natural language query
            top_k: Number of results to return
            
        Returns:
            List of search results sorted by relevance
        """
        top_k = top_k or self.config.max_results
        
        # Embed query
        query_embedding = self.embed(query)
        
        # Calculate similarities
        similarities = []
        for doc_id, doc_embedding in self._embeddings.items():
            score = self._cosine_similarity(query_embedding, doc_embedding)
            if score >= self.config.similarity_threshold:
                similarities.append((doc_id, score))
        
        # Sort by score
        similarities.sort(key=lambda x: -x[1])
        
        # Build results
        results = []
        for doc_id, score in similarities[:top_k]:
            doc = self._documents.get(doc_id, {})
            results.append(SearchResult(
                id=doc_id,
                content=doc.get("content", ""),
                file_path=doc.get("file_path", ""),
                line_start=doc.get("line_start", 0),
                line_end=doc.get("line_end", 0),
                score=score,
                metadata={
                    "name": doc.get("name"),
                    "type": doc.get("type"),
                    "docstring": doc.get("docstring"),
                },
            ))
        
        return results
    
    def find_similar(self, doc_id: str, top_k: int = 10) -> List[SearchResult]:
        """
        Find documents similar to a given document.
        
        Args:
            doc_id: Document ID to find similar documents for
            top_k: Number of results
            
        Returns:
            List of similar documents
        """
        if doc_id not in self._embeddings:
            return []
        
        query_embedding = self._embeddings[doc_id]
        
        similarities = []
        for other_id, other_embedding in self._embeddings.items():
            if other_id != doc_id:
                score = self._cosine_similarity(query_embedding, other_embedding)
                similarities.append((other_id, score))
        
        similarities.sort(key=lambda x: -x[1])
        
        results = []
        for other_id, score in similarities[:top_k]:
            doc = self._documents.get(other_id, {})
            results.append(SearchResult(
                id=other_id,
                content=doc.get("content", ""),
                file_path=doc.get("file_path", ""),
                line_start=doc.get("line_start", 0),
                line_end=doc.get("line_end", 0),
                score=score,
                metadata={
                    "name": doc.get("name"),
                    "type": doc.get("type"),
                },
            ))
        
        return results
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        if len(vec1) != len(vec2):
            return 0.0
        
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(b * b for b in vec2))
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def save_index(self, path: str):
        """Save the index to disk."""
        data = {
            "embeddings": self._embeddings,
            "documents": self._documents,
            "config": {
                "embedding_dim": self.config.embedding_dim,
                "model_name": self.config.model_name,
            }
        }
        
        Path(path).write_text(json.dumps(data))
        logger.info(f"Index saved to: {path}")
    
    def load_index(self, path: str):
        """Load the index from disk."""
        data = json.loads(Path(path).read_text())
        
        self._embeddings = data.get("embeddings", {})
        self._documents = data.get("documents", {})
        
        logger.info(f"Index loaded: {len(self._documents)} documents")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get search index statistics."""
        return {
            "total_documents": len(self._documents),
            "total_embeddings": len(self._embeddings),
            "embedding_dim": self.config.embedding_dim,
            "model_name": self.config.model_name,
        }
