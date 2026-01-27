"""
AI Prompts - Template prompts for AI analysis.

Provides structured prompts for various analysis types.
"""

from typing import Dict, Any, Optional
from enum import Enum


class PromptTemplates:
    """Templates for AI analysis prompts."""
    
    SYSTEM_PROMPT = """You are an expert code analyst. Your task is to analyze code and provide structured, actionable insights. Be specific, accurate, and helpful. When identifying issues, always explain why something is a problem and how to fix it."""
    
    EXPLAIN_PROMPT = """Explain what this code does in clear, concise language. Include:
1. Main purpose of the code
2. Key algorithms or patterns used
3. Important dependencies or requirements
4. Any notable design decisions

Code ({language}):
```{language}
{code}
```

Provide a clear explanation that a developer can understand quickly."""
    
    BUGS_PROMPT = """Analyze this code for potential bugs, errors, and issues. For each issue found, provide:
1. Description of the bug
2. Location in the code
3. Severity (critical, high, medium, low)
4. Suggested fix

Code ({language}):
```{language}
{code}
```

Return a JSON array of bug objects with keys: description, location, severity, fix
If no bugs are found, return an empty array: []"""
    
    REFACTOR_PROMPT = """Suggest refactoring improvements for this code. Consider:
1. Code readability
2. Performance optimization
3. Design patterns
4. Best practices for {language}
5. Reducing complexity

Code ({language}):
```{language}
{code}
```

Return a JSON array of suggestion objects with keys: suggestion, priority, impact, before_example, after_example"""
    
    DOCUMENT_PROMPT = """Generate comprehensive documentation for this code. Include:
1. Module/function docstrings
2. Parameter descriptions
3. Return value descriptions
4. Usage examples
5. Notes on edge cases

Code ({language}):
```{language}
{code}
```

Generate documentation in the appropriate format for {language}."""
    
    SECURITY_PROMPT = """Perform a security audit on this code. Look for:
1. Injection vulnerabilities (SQL, command, etc.)
2. Authentication/authorization issues
3. Data exposure risks
4. Cryptographic weaknesses
5. Input validation problems
6. Hardcoded secrets

Code ({language}):
```{language}
{code}
```

Return a JSON array of finding objects with keys: vulnerability, severity (critical, high, medium, low), location, description, recommendation"""
    
    REVIEW_PROMPT = """Perform a comprehensive code review. Analyze:
1. Code quality and style
2. Logic correctness
3. Error handling
4. Performance
5. Security
6. Test coverage needs
7. Documentation

Code ({language}):
```{language}
{code}
```

Return a JSON object with keys: summary, score (1-10), issues (array), suggestions (array), highlights (array of positive aspects)"""
    
    SUMMARIZE_PROMPT = """Summarize what this code file does in 2-3 sentences. Be specific about:
- The main functionality
- Key public interfaces
- Important dependencies

Code ({language}):
```{language}
{code}
```

Provide a brief, accurate summary."""
    
    TEST_CASES_PROMPT = """Generate test cases for this code. Include:
1. Unit tests for each public function
2. Edge cases
3. Error scenarios
4. Integration points

Code ({language}):
```{language}
{code}
```

Return a JSON array of test case objects with keys: name, description, input, expected_output, test_type (unit, integration, edge_case)"""
    
    @classmethod
    def get_prompt(
        cls,
        analysis_type: 'AnalysisType',
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Get the appropriate prompt for an analysis type.
        
        Args:
            analysis_type: Type of analysis
            code: Code to analyze
            context: Additional context
            
        Returns:
            Formatted prompt string
        """
        from .ai_analyzer import AnalysisType
        
        context = context or {}
        language = context.get("language", "python")
        file_path = context.get("file_path", "")
        
        prompt_map = {
            AnalysisType.EXPLAIN: cls.EXPLAIN_PROMPT,
            AnalysisType.BUGS: cls.BUGS_PROMPT,
            AnalysisType.REFACTOR: cls.REFACTOR_PROMPT,
            AnalysisType.DOCUMENT: cls.DOCUMENT_PROMPT,
            AnalysisType.SECURITY: cls.SECURITY_PROMPT,
            AnalysisType.REVIEW: cls.REVIEW_PROMPT,
            AnalysisType.SUMMARIZE: cls.SUMMARIZE_PROMPT,
            AnalysisType.TEST_CASES: cls.TEST_CASES_PROMPT,
        }
        
        template = prompt_map.get(analysis_type, cls.EXPLAIN_PROMPT)
        
        return template.format(
            code=code,
            language=language,
            file_path=file_path,
            **context
        )
    
    @classmethod
    def custom_prompt(
        cls,
        template: str,
        code: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create a custom prompt from a template.
        
        Args:
            template: Prompt template with {code} and {language} placeholders
            code: Code to analyze
            context: Additional context
            
        Returns:
            Formatted prompt string
        """
        context = context or {}
        language = context.get("language", "python")
        
        return template.format(
            code=code,
            language=language,
            **context
        )
