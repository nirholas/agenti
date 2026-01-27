"""
Template Engine - Code template management and rendering.

This module provides a template system for code generation.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class CodeTemplate:
    """Represents a code template."""
    name: str
    language: str
    content: str
    description: str = ""
    variables: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def render(self, context: Dict[str, Any]) -> str:
        """
        Render template with context.
        
        Args:
            context: Variable values
            
        Returns:
            Rendered template
        """
        result = self.content
        
        # Simple variable substitution
        for var in self.variables:
            if var in context:
                result = result.replace(f"{{{var}}}", str(context[var]))
        
        # Handle conditionals: {{#if var}}...{{/if}}
        result = self._process_conditionals(result, context)
        
        # Handle loops: {{#each items}}...{{/each}}
        result = self._process_loops(result, context)
        
        return result
    
    def _process_conditionals(self, content: str, context: Dict[str, Any]) -> str:
        """Process conditional blocks."""
        pattern = r'\{\{#if\s+(\w+)\}\}(.*?)\{\{/if\}\}'
        
        def replacer(match):
            var_name = match.group(1)
            inner = match.group(2)
            if context.get(var_name):
                return inner
            return ""
        
        return re.sub(pattern, replacer, content, flags=re.DOTALL)
    
    def _process_loops(self, content: str, context: Dict[str, Any]) -> str:
        """Process loop blocks."""
        pattern = r'\{\{#each\s+(\w+)\}\}(.*?)\{\{/each\}\}'
        
        def replacer(match):
            var_name = match.group(1)
            inner = match.group(2)
            items = context.get(var_name, [])
            
            results = []
            for item in items:
                rendered = inner
                if isinstance(item, dict):
                    for k, v in item.items():
                        rendered = rendered.replace(f"{{{{this.{k}}}}}", str(v))
                else:
                    rendered = rendered.replace("{{this}}", str(item))
                results.append(rendered)
            
            return "".join(results)
        
        return re.sub(pattern, replacer, content, flags=re.DOTALL)


class TemplateEngine:
    """
    Template engine for code generation.
    
    Features:
    - Template loading and caching
    - Variable substitution
    - Conditional blocks
    - Loop blocks
    - Template inheritance
    """
    
    def __init__(self, template_dir: Optional[str] = None):
        """Initialize template engine."""
        self.template_dir = Path(template_dir) if template_dir else None
        self._templates: Dict[str, CodeTemplate] = {}
        self._load_builtin_templates()
    
    def _load_builtin_templates(self) -> None:
        """Load built-in templates."""
        builtin = [
            CodeTemplate(
                name="python_module",
                language="python",
                content='''"""
{description}
"""

from typing import Any, Dict, List, Optional

{{#if imports}}
{imports}
{{/if}}

__all__ = [{exports}]

{{#each classes}}
{{{this}}}

{{/each}}

{{#each functions}}
{{{this}}}

{{/each}}
''',
                description="Python module template",
                variables=["description", "imports", "exports", "classes", "functions"],
            ),
            CodeTemplate(
                name="python_fastapi_router",
                language="python",
                content='''"""
{description}
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional

router = APIRouter(prefix="/{prefix}", tags=["{tag}"])

{{#each endpoints}}
@router.{{this.method}}("{{this.path}}")
async def {{this.name}}({{this.params}}):
    """{{this.description}}"""
    {{this.body}}

{{/each}}
''',
                description="FastAPI router template",
                variables=["description", "prefix", "tag", "endpoints"],
            ),
            CodeTemplate(
                name="typescript_react_component",
                language="typescript",
                content='''import React from 'react';
{{#if imports}}
{imports}
{{/if}}

interface {name}Props {{
{{#each props}}
    {{this.name}}{{#if this.optional}}?{{/if}}: {{this.type}};
{{/each}}
}}

export const {name}: React.FC<{name}Props> = ({{ {prop_names} }}) => {{
    {body}
    
    return (
        {jsx}
    );
}};

export default {name};
''',
                description="React component template",
                variables=["name", "imports", "props", "prop_names", "body", "jsx"],
            ),
            CodeTemplate(
                name="python_dataclass",
                language="python",
                content='''from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

@dataclass
class {name}:
    """
    {description}
    """
{{#each fields}}
    {{this.name}}: {{this.type}}{{#if this.default}} = {{this.default}}{{/if}}
{{/each}}
{{#if methods}}

{{#each methods}}
    {{{this}}}

{{/each}}
{{/if}}
''',
                description="Python dataclass template",
                variables=["name", "description", "fields", "methods"],
            ),
            CodeTemplate(
                name="python_test_class",
                language="python",
                content='''import pytest
{{#if imports}}
{imports}
{{/if}}


class Test{name}:
    """Tests for {target}."""
    
    @pytest.fixture
    def setup(self):
        """Set up test fixtures."""
        {setup}
    
{{#each test_methods}}
    def test_{{this.name}}(self{{#if this.fixtures}}, {{this.fixtures}}{{/if}}):
        """{{this.description}}"""
        {{this.body}}

{{/each}}
''',
                description="Python test class template",
                variables=["name", "target", "imports", "setup", "test_methods"],
            ),
        ]
        
        for template in builtin:
            self._templates[template.name] = template
    
    def register_template(self, template: CodeTemplate) -> None:
        """Register a template."""
        self._templates[template.name] = template
    
    def get_template(self, name: str) -> Optional[CodeTemplate]:
        """Get a template by name."""
        return self._templates.get(name)
    
    def list_templates(self, language: Optional[str] = None) -> List[CodeTemplate]:
        """List all templates."""
        templates = list(self._templates.values())
        if language:
            templates = [t for t in templates if t.language == language]
        return templates
    
    def render(self, template_name: str, context: Dict[str, Any]) -> str:
        """
        Render a template.
        
        Args:
            template_name: Name of template
            context: Variable values
            
        Returns:
            Rendered content
        """
        template = self._templates.get(template_name)
        if not template:
            raise ValueError(f"Template not found: {template_name}")
        
        return template.render(context)
    
    def render_string(self, content: str, context: Dict[str, Any]) -> str:
        """
        Render a template string.
        
        Args:
            content: Template content
            context: Variable values
            
        Returns:
            Rendered content
        """
        template = CodeTemplate(
            name="inline",
            language="unknown",
            content=content,
            variables=list(context.keys()),
        )
        return template.render(context)
    
    def load_from_file(self, file_path: str) -> CodeTemplate:
        """Load template from file."""
        path = Path(file_path)
        content = path.read_text()
        
        # Parse frontmatter if present
        name = path.stem
        language = "unknown"
        description = ""
        
        if content.startswith("---"):
            lines = content.split("\n")
            end_idx = lines[1:].index("---") + 1
            frontmatter = "\n".join(lines[1:end_idx])
            content = "\n".join(lines[end_idx + 1:])
            
            # Parse simple YAML-like frontmatter
            for line in frontmatter.split("\n"):
                if ":" in line:
                    key, value = line.split(":", 1)
                    key = key.strip()
                    value = value.strip()
                    if key == "name":
                        name = value
                    elif key == "language":
                        language = value
                    elif key == "description":
                        description = value
        
        # Extract variables
        variables = re.findall(r'\{(\w+)\}', content)
        
        template = CodeTemplate(
            name=name,
            language=language,
            content=content,
            description=description,
            variables=list(set(variables)),
        )
        
        self._templates[name] = template
        return template
    
    def save_to_file(self, template_name: str, file_path: str) -> None:
        """Save template to file."""
        template = self._templates.get(template_name)
        if not template:
            raise ValueError(f"Template not found: {template_name}")
        
        frontmatter = [
            "---",
            f"name: {template.name}",
            f"language: {template.language}",
            f"description: {template.description}",
            "---",
            "",
        ]
        
        content = "\n".join(frontmatter) + template.content
        Path(file_path).write_text(content)
