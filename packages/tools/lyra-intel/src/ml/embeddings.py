"""
Code embedding generation for semantic analysis.
"""

import hashlib
import math
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class EmbeddingModel(Enum):
    BOW = "bag_of_words"
    TFIDF = "tfidf"
    CODE2VEC = "code2vec"
    CODEBERT = "codebert"
    OPENAI = "openai"


@dataclass
class CodeEmbedding:
    file_path: str = ""
    model: EmbeddingModel = EmbeddingModel.BOW
    vector: list[float] = field(default_factory=list)
    dimension: int = 0
    metadata: dict = field(default_factory=dict)

    def similarity(self, other: "CodeEmbedding") -> float:
        if len(self.vector) != len(other.vector):
            return 0.0
        dot_product = sum(a * b for a, b in zip(self.vector, other.vector))
        norm_a = math.sqrt(sum(a * a for a in self.vector))
        norm_b = math.sqrt(sum(b * b for b in other.vector))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot_product / (norm_a * norm_b)


class EmbeddingGenerator:
    def __init__(self, model: EmbeddingModel = EmbeddingModel.BOW, dimension: int = 256):
        self.model = model
        self.dimension = dimension
        self.vocabulary: dict[str, int] = {}
        self.idf_scores: dict[str, float] = {}
        self.documents: list[list[str]] = []

    def fit(self, code_samples: list[str]) -> None:
        self.documents = []
        word_doc_count: dict[str, int] = {}

        for code in code_samples:
            tokens = self._tokenize(code)
            self.documents.append(tokens)

            unique_tokens = set(tokens)
            for token in unique_tokens:
                word_doc_count[token] = word_doc_count.get(token, 0) + 1

                if token not in self.vocabulary:
                    self.vocabulary[token] = len(self.vocabulary)

        # Calculate IDF scores
        num_docs = len(code_samples)
        for word, doc_count in word_doc_count.items():
            self.idf_scores[word] = math.log(num_docs / (1 + doc_count))

    def generate(self, code: str, file_path: str = "") -> CodeEmbedding:
        if self.model == EmbeddingModel.BOW:
            vector = self._generate_bow(code)
        elif self.model == EmbeddingModel.TFIDF:
            vector = self._generate_tfidf(code)
        else:
            vector = self._generate_hash(code)

        return CodeEmbedding(
            file_path=file_path,
            model=self.model,
            vector=vector,
            dimension=len(vector),
            metadata={"tokens": len(self._tokenize(code))},
        )

    def _tokenize(self, code: str) -> list[str]:
        # Simple tokenization for code
        code = re.sub(r'["\'].*?["\']', 'STRING', code)  # Replace strings
        code = re.sub(r'#.*$', '', code, flags=re.MULTILINE)  # Remove comments
        code = re.sub(r'//.*$', '', code, flags=re.MULTILINE)

        # Split on non-alphanumeric
        tokens = re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', code)

        # Convert camelCase and snake_case
        expanded = []
        for token in tokens:
            # Split camelCase
            parts = re.findall(r'[A-Z]?[a-z]+|[A-Z]+(?=[A-Z]|$)', token)
            if parts:
                expanded.extend([p.lower() for p in parts])
            else:
                expanded.append(token.lower())

        return expanded

    def _generate_bow(self, code: str) -> list[float]:
        tokens = self._tokenize(code)
        vector = [0.0] * min(self.dimension, len(self.vocabulary) + 1)

        for token in tokens:
            idx = self.vocabulary.get(token, len(self.vocabulary))
            if idx < len(vector):
                vector[idx] += 1.0

        # Normalize
        total = sum(vector)
        if total > 0:
            vector = [v / total for v in vector]

        return vector[:self.dimension]

    def _generate_tfidf(self, code: str) -> list[float]:
        tokens = self._tokenize(code)
        vector = [0.0] * min(self.dimension, len(self.vocabulary) + 1)

        # Calculate TF
        tf: dict[str, float] = {}
        for token in tokens:
            tf[token] = tf.get(token, 0) + 1
        for token in tf:
            tf[token] /= len(tokens) if tokens else 1

        # Calculate TF-IDF
        for token, term_freq in tf.items():
            idx = self.vocabulary.get(token)
            if idx is not None and idx < len(vector):
                idf = self.idf_scores.get(token, 1.0)
                vector[idx] = term_freq * idf

        # Normalize
        norm = math.sqrt(sum(v * v for v in vector))
        if norm > 0:
            vector = [v / norm for v in vector]

        return vector[:self.dimension]

    def _generate_hash(self, code: str) -> list[float]:
        tokens = self._tokenize(code)
        vector = [0.0] * self.dimension

        for token in tokens:
            # Hash token to get bucket
            hash_val = int(hashlib.md5(token.encode()).hexdigest(), 16)
            bucket = hash_val % self.dimension
            # Use another hash for sign
            sign = 1 if (hash_val // self.dimension) % 2 == 0 else -1
            vector[bucket] += sign

        # Normalize
        norm = math.sqrt(sum(v * v for v in vector))
        if norm > 0:
            vector = [v / norm for v in vector]

        return vector

    def generate_batch(self, files: list[dict]) -> list[CodeEmbedding]:
        # Fit on all code first if not already fit
        if not self.vocabulary:
            codes = [f.get("content", "") for f in files]
            self.fit(codes)

        results = []
        for file_data in files:
            code = file_data.get("content", "")
            path = file_data.get("path", "")
            embedding = self.generate(code, path)
            results.append(embedding)

        return results

    def find_similar(
        self,
        query_embedding: CodeEmbedding,
        embeddings: list[CodeEmbedding],
        top_k: int = 10,
    ) -> list[tuple[CodeEmbedding, float]]:
        similarities = []
        for emb in embeddings:
            if emb.file_path != query_embedding.file_path:
                sim = query_embedding.similarity(emb)
                similarities.append((emb, sim))

        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]

    def cluster_similar(self, embeddings: list[CodeEmbedding], threshold: float = 0.8) -> list[list[str]]:
        clusters: list[list[str]] = []
        assigned = set()

        for i, emb in enumerate(embeddings):
            if emb.file_path in assigned:
                continue

            cluster = [emb.file_path]
            assigned.add(emb.file_path)

            for j, other in enumerate(embeddings):
                if i != j and other.file_path not in assigned:
                    sim = emb.similarity(other)
                    if sim >= threshold:
                        cluster.append(other.file_path)
                        assigned.add(other.file_path)

            if len(cluster) > 1:
                clusters.append(cluster)

        return clusters
