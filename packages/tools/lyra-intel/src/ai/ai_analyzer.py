"""
AI Analyzer - AI/LLM-powered code analysis.

Provides:
- Code explanation
- Bug detection
- Refactoring suggestions
- Documentation generation
- Security analysis
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import json

logger = logging.getLogger(__name__)


class AnalysisType(Enum):
    """Types of AI analysis available."""
    EXPLAIN = "explain"
    BUGS = "bugs"
    REFACTOR = "refactor"
    DOCUMENT = "document"
    SECURITY = "security"
    REVIEW = "review"
    SUMMARIZE = "summarize"
    TEST_CASES = "test_cases"


@dataclass
class AIConfig:
    """Configuration for AI analyzer."""
    provider: str = "openai"  # openai, anthropic, local, mock
    model: str = "gpt-4"
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    max_tokens: int = 4096
    temperature: float = 0.3
    timeout: int = 60
    retry_count: int = 3
    batch_size: int = 10
    cache_responses: bool = True


@dataclass
class AIResponse:
    """Response from AI analysis."""
    analysis_type: AnalysisType
    content: str
    confidence: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    tokens_used: int = 0
    model: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "analysis_type": self.analysis_type.value,
            "content": self.content,
            "confidence": self.confidence,
            "metadata": self.metadata,
            "tokens_used": self.tokens_used,
            "model": self.model,
        }


class AIAnalyzer:
    """
    AI-powered code analyzer.
    
    Uses LLMs for:
    - Code explanation
    - Bug detection
    - Refactoring suggestions
    - Documentation generation
    - Security vulnerability detection
    """
    
    def __init__(self, config: Optional[AIConfig] = None):
        self.config = config or AIConfig()
        self._provider = None
        self._cache: Dict[str, AIResponse] = {}
        self._stats = {
            "requests": 0,
            "tokens_used": 0,
            "cache_hits": 0,
        }
    
    async def initialize(self) -> None:
        """Initialize the AI provider."""
        from .providers import get_provider
        self._provider = get_provider(self.config)
        logger.info(f"AI Analyzer initialized with {self.config.provider}/{self.config.model}")
    
    async def analyze(
        self,
        code: str,
        analysis_type: AnalysisType,
        context: Optional[Dict[str, Any]] = None
    ) -> AIResponse:
        """
        Analyze code using AI.
        
        Args:
            code: Code to analyze
            analysis_type: Type of analysis to perform
            context: Additional context (file path, language, etc.)
            
        Returns:
            AI analysis response
        """
        context = context or {}
        
        # Check cache
        cache_key = self._make_cache_key(code, analysis_type, context)
        if self.config.cache_responses and cache_key in self._cache:
            self._stats["cache_hits"] += 1
            return self._cache[cache_key]
        
        # Build prompt
        from .prompts import PromptTemplates
        prompt = PromptTemplates.get_prompt(analysis_type, code, context)
        
        # Call provider
        self._stats["requests"] += 1
        
        try:
            result = await self._call_provider(prompt, analysis_type)
            
            # Cache result
            if self.config.cache_responses:
                self._cache[cache_key] = result
            
            return result
            
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return AIResponse(
                analysis_type=analysis_type,
                content=f"Analysis failed: {str(e)}",
                confidence=0.0,
                metadata={"error": str(e)},
            )
    
    async def explain_code(
        self,
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Get a natural language explanation of code."""
        response = await self.analyze(code, AnalysisType.EXPLAIN, context)
        return response.content
    
    async def find_bugs(
        self,
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Find potential bugs in code."""
        response = await self.analyze(code, AnalysisType.BUGS, context)
        
        # Parse structured response
        try:
            bugs = json.loads(response.content)
            if isinstance(bugs, list):
                return bugs
        except json.JSONDecodeError:
            pass
        
        return [{"description": response.content, "severity": "unknown"}]
    
    async def suggest_refactoring(
        self,
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Get refactoring suggestions."""
        response = await self.analyze(code, AnalysisType.REFACTOR, context)
        
        try:
            suggestions = json.loads(response.content)
            if isinstance(suggestions, list):
                return suggestions
        except json.JSONDecodeError:
            pass
        
        return [{"suggestion": response.content}]
    
    async def generate_documentation(
        self,
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate documentation for code."""
        response = await self.analyze(code, AnalysisType.DOCUMENT, context)
        return response.content
    
    async def security_audit(
        self,
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Perform security analysis on code."""
        response = await self.analyze(code, AnalysisType.SECURITY, context)
        
        try:
            findings = json.loads(response.content)
            if isinstance(findings, list):
                return findings
        except json.JSONDecodeError:
            pass
        
        return [{"finding": response.content, "severity": "unknown"}]
    
    async def code_review(
        self,
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Perform comprehensive code review."""
        response = await self.analyze(code, AnalysisType.REVIEW, context)
        
        try:
            review = json.loads(response.content)
            if isinstance(review, dict):
                return review
        except json.JSONDecodeError:
            pass
        
        return {
            "summary": response.content,
            "issues": [],
            "suggestions": [],
        }
    
    async def summarize_file(
        self,
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Summarize what a file does."""
        response = await self.analyze(code, AnalysisType.SUMMARIZE, context)
        return response.content
    
    async def generate_test_cases(
        self,
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Generate test cases for code."""
        response = await self.analyze(code, AnalysisType.TEST_CASES, context)
        
        try:
            tests = json.loads(response.content)
            if isinstance(tests, list):
                return tests
        except json.JSONDecodeError:
            pass
        
        return [{"test": response.content}]
    
    async def batch_analyze(
        self,
        items: List[tuple],  # (code, analysis_type, context)
    ) -> List[AIResponse]:
        """
        Batch analyze multiple code items.
        
        Args:
            items: List of (code, analysis_type, context) tuples
            
        Returns:
            List of AI responses
        """
        results = []
        
        # Process in batches
        for i in range(0, len(items), self.config.batch_size):
            batch = items[i:i + self.config.batch_size]
            
            # Run batch concurrently
            tasks = [
                self.analyze(code, atype, ctx)
                for code, atype, ctx in batch
            ]
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    results.append(AIResponse(
                        analysis_type=AnalysisType.EXPLAIN,
                        content=str(result),
                        confidence=0.0,
                        metadata={"error": True},
                    ))
                else:
                    results.append(result)
        
        return results
    
    async def _call_provider(
        self,
        prompt: str,
        analysis_type: AnalysisType
    ) -> AIResponse:
        """Call the AI provider."""
        if self._provider is None:
            await self.initialize()
        
        response = await self._provider.complete(prompt)
        
        self._stats["tokens_used"] += response.get("tokens_used", 0)
        
        return AIResponse(
            analysis_type=analysis_type,
            content=response.get("content", ""),
            confidence=response.get("confidence", 0.8),
            metadata=response.get("metadata", {}),
            tokens_used=response.get("tokens_used", 0),
            model=self.config.model,
        )
    
    def _make_cache_key(
        self,
        code: str,
        analysis_type: AnalysisType,
        context: Dict[str, Any]
    ) -> str:
        """Create a cache key using hashes to avoid memory issues with large code."""
        import hashlib
        # Hash the code content instead of including it directly
        code_hash = hashlib.sha256(code.encode()).hexdigest()
        context_hash = hashlib.sha256(json.dumps(context, sort_keys=True).encode()).hexdigest()
        key_data = f"{analysis_type.value}:{code_hash}:{context_hash}"
        return hashlib.sha256(key_data.encode()).hexdigest()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get analyzer statistics."""
        return {
            **self._stats,
            "cache_size": len(self._cache),
            "provider": self.config.provider,
            "model": self.config.model,
        }
    
    def clear_cache(self) -> int:
        """Clear the response cache."""
        count = len(self._cache)
        self._cache.clear()
        return count
