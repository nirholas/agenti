"""
Documentation Generator - Automatic documentation generation.

This module automatically generates documentation from code
including API docs, README, guides, and more.
"""

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import json


@dataclass
class DocConfig:
    """Configuration for documentation generation."""
    output_format: str = "markdown"  # markdown, html, json
    include_examples: bool = True
    include_source_links: bool = True
    include_toc: bool = True
    template: Optional[str] = None
    language: str = "en"


@dataclass
class DocResult:
    """Result of documentation generation."""
    success: bool
    content: str
    format: str
    sections: List[str]
    word_count: int
    metadata: Dict[str, Any] = field(default_factory=dict)


class DocumentationGenerator:
    """
    Generates documentation from code analysis.
    
    Features:
    - Generate API documentation
    - Generate README files
    - Generate architecture docs
    - Generate user guides
    """
    
    def __init__(self, config: Optional[DocConfig] = None):
        """Initialize documentation generator."""
        self.config = config or DocConfig()
    
    def generate_api_docs(
        self,
        ast_results: List[Dict[str, Any]],
        project_name: str = "API",
    ) -> DocResult:
        """
        Generate API documentation from AST analysis.
        
        Args:
            ast_results: AST analysis results
            project_name: Name of the project
            
        Returns:
            Generated documentation
        """
        sections = []
        content_parts = []
        
        content_parts.append(f"# {project_name} API Documentation")
        content_parts.append(f"\n_Generated on {datetime.now().strftime('%Y-%m-%d %H:%M')}_")
        
        # Table of contents
        if self.config.include_toc:
            content_parts.append("\n## Table of Contents\n")
            sections.append("Table of Contents")
        
        # Organize by file
        files_with_units = []
        for result in ast_results:
            if "error" in result:
                continue
            if result.get("code_units"):
                files_with_units.append(result)
        
        # Generate TOC entries
        if self.config.include_toc:
            for result in files_with_units:
                file_path = result.get("file_path", "unknown")
                file_name = Path(file_path).name
                content_parts.append(f"- [{file_name}](#{file_name.lower().replace('.', '')})")
        
        # Generate documentation for each file
        for result in files_with_units:
            file_path = result.get("file_path", "unknown")
            file_name = Path(file_path).name
            
            content_parts.append(f"\n---\n\n## {file_name}")
            sections.append(file_name)
            
            if self.config.include_source_links:
                content_parts.append(f"\n_Source: `{file_path}`_")
            
            # Group by type
            classes = [u for u in result.get("code_units", []) if u.get("type") == "class"]
            functions = [u for u in result.get("code_units", []) if u.get("type") == "function"]
            
            # Document classes
            if classes:
                content_parts.append("\n### Classes\n")
                for cls in classes:
                    content_parts.append(f"\n#### `{cls.get('name')}`")
                    if cls.get("docstring"):
                        content_parts.append(f"\n{cls.get('docstring')}")
                    if cls.get("bases"):
                        bases = ", ".join(cls.get("bases", []))
                        content_parts.append(f"\n**Extends**: {bases}")
            
            # Document functions
            if functions:
                content_parts.append("\n### Functions\n")
                for func in functions:
                    content_parts.append(f"\n#### `{func.get('name')}()`")
                    if func.get("docstring"):
                        content_parts.append(f"\n{func.get('docstring')}")
                    
                    # Parameters
                    params = func.get("parameters", [])
                    if params:
                        content_parts.append("\n**Parameters:**")
                        for p in params:
                            p_name = p if isinstance(p, str) else p.get("name", "")
                            p_type = p.get("type", "Any") if isinstance(p, dict) else ""
                            content_parts.append(f"- `{p_name}`: {p_type}")
                    
                    # Return type
                    ret_type = func.get("return_type")
                    if ret_type:
                        content_parts.append(f"\n**Returns**: `{ret_type}`")
        
        content = "\n".join(content_parts)
        
        return DocResult(
            success=True,
            content=content,
            format=self.config.output_format,
            sections=sections,
            word_count=len(content.split()),
        )
    
    def generate_readme(
        self,
        project_name: str,
        description: str,
        features: List[str],
        installation: str = "",
        usage: str = "",
        analysis_data: Optional[Dict[str, Any]] = None,
    ) -> DocResult:
        """
        Generate a README file.
        
        Args:
            project_name: Name of the project
            description: Project description
            features: List of features
            installation: Installation instructions
            usage: Usage examples
            analysis_data: Optional analysis data for stats
            
        Returns:
            Generated README
        """
        sections = []
        content_parts = []
        
        # Header
        content_parts.append(f"# {project_name}")
        content_parts.append(f"\n{description}")
        
        # Badges (if analysis data available)
        if analysis_data:
            stats = analysis_data.get("files", {})
            content_parts.append("\n")
            content_parts.append(f"![Files](https://img.shields.io/badge/files-{stats.get('total', 0)}-blue)")
            content_parts.append(f"![Lines](https://img.shields.io/badge/lines-{stats.get('total_lines', 0)}-green)")
        
        # Features
        if features:
            content_parts.append("\n## Features\n")
            sections.append("Features")
            for feature in features:
                content_parts.append(f"- {feature}")
        
        # Installation
        if installation:
            content_parts.append("\n## Installation\n")
            sections.append("Installation")
            content_parts.append(installation)
        
        # Usage
        if usage:
            content_parts.append("\n## Usage\n")
            sections.append("Usage")
            content_parts.append(usage)
        
        # Project Structure (if analysis data)
        if analysis_data and analysis_data.get("code_units"):
            content_parts.append("\n## Project Structure\n")
            sections.append("Project Structure")
            
            units = analysis_data.get("code_units", {})
            content_parts.append("```")
            content_parts.append(f"Functions: {units.get('functions', 0)}")
            content_parts.append(f"Classes: {units.get('classes', 0)}")
            content_parts.append("```")
        
        # License
        content_parts.append("\n## License\n")
        sections.append("License")
        content_parts.append("MIT License")
        
        content = "\n".join(content_parts)
        
        return DocResult(
            success=True,
            content=content,
            format="markdown",
            sections=sections,
            word_count=len(content.split()),
        )
    
    def generate_architecture_doc(
        self,
        project_name: str,
        analysis_data: Dict[str, Any],
        dependencies: Optional[Dict[str, Any]] = None,
    ) -> DocResult:
        """
        Generate architecture documentation.
        
        Args:
            project_name: Name of the project
            analysis_data: Full analysis data
            dependencies: Dependency analysis
            
        Returns:
            Architecture documentation
        """
        sections = []
        content_parts = []
        
        content_parts.append(f"# {project_name} Architecture")
        content_parts.append(f"\n_Generated on {datetime.now().strftime('%Y-%m-%d')}_")
        
        # Overview
        content_parts.append("\n## Overview\n")
        sections.append("Overview")
        
        files = analysis_data.get("files", {})
        content_parts.append(f"- **Total Files**: {files.get('total', 0)}")
        content_parts.append(f"- **Total Lines**: {files.get('total_lines', 0):,}")
        
        # Technology Stack
        content_parts.append("\n## Technology Stack\n")
        sections.append("Technology Stack")
        
        by_ext = files.get("by_extension", {})
        for ext, count in sorted(by_ext.items(), key=lambda x: x[1], reverse=True)[:10]:
            lang = self._extension_to_language(ext)
            content_parts.append(f"- **{lang}**: {count} files")
        
        # Code Structure
        content_parts.append("\n## Code Structure\n")
        sections.append("Code Structure")
        
        units = analysis_data.get("code_units", {})
        content_parts.append(f"- **Functions**: {units.get('functions', 0)}")
        content_parts.append(f"- **Classes**: {units.get('classes', 0)}")
        content_parts.append(f"- **Imports**: {units.get('total_imports', 0)}")
        
        # Dependencies
        if dependencies:
            content_parts.append("\n## Dependencies\n")
            sections.append("Dependencies")
            
            internal = dependencies.get("internal", 0)
            external = dependencies.get("external", 0)
            content_parts.append(f"- **Internal**: {internal}")
            content_parts.append(f"- **External**: {external}")
            
            circular = dependencies.get("circular", [])
            if circular:
                content_parts.append(f"\n⚠️ **Circular Dependencies**: {len(circular)}")
        
        # Diagram
        content_parts.append("\n## Diagram\n")
        sections.append("Diagram")
        content_parts.append("```mermaid")
        content_parts.append("graph TD")
        content_parts.append("    A[Entry Points] --> B[Core Modules]")
        content_parts.append("    B --> C[Utilities]")
        content_parts.append("    B --> D[Database]")
        content_parts.append("    B --> E[External Services]")
        content_parts.append("```")
        
        content = "\n".join(content_parts)
        
        return DocResult(
            success=True,
            content=content,
            format="markdown",
            sections=sections,
            word_count=len(content.split()),
        )
    
    def _extension_to_language(self, ext: str) -> str:
        """Map file extension to language name."""
        mapping = {
            ".py": "Python",
            ".js": "JavaScript",
            ".ts": "TypeScript",
            ".tsx": "TypeScript (React)",
            ".jsx": "JavaScript (React)",
            ".go": "Go",
            ".rs": "Rust",
            ".java": "Java",
            ".rb": "Ruby",
            ".php": "PHP",
            ".css": "CSS",
            ".html": "HTML",
            ".json": "JSON",
            ".yaml": "YAML",
            ".yml": "YAML",
            ".md": "Markdown",
        }
        return mapping.get(ext, ext.upper())
    
    def generate_changelog(
        self,
        commits: List[Dict[str, Any]],
        version: str = "Unreleased",
    ) -> DocResult:
        """
        Generate a changelog from commits.
        
        Args:
            commits: List of commit data
            version: Version string
            
        Returns:
            Changelog content
        """
        content_parts = []
        
        content_parts.append("# Changelog")
        content_parts.append(f"\n## [{version}] - {datetime.now().strftime('%Y-%m-%d')}\n")
        
        # Categorize commits
        features = []
        fixes = []
        other = []
        
        for commit in commits:
            message = commit.get("message", "")
            if message.lower().startswith(("feat", "feature", "add")):
                features.append(message)
            elif message.lower().startswith(("fix", "bug")):
                fixes.append(message)
            else:
                other.append(message)
        
        if features:
            content_parts.append("### Added\n")
            for f in features[:20]:
                content_parts.append(f"- {f}")
        
        if fixes:
            content_parts.append("\n### Fixed\n")
            for f in fixes[:20]:
                content_parts.append(f"- {f}")
        
        if other:
            content_parts.append("\n### Changed\n")
            for o in other[:20]:
                content_parts.append(f"- {o}")
        
        content = "\n".join(content_parts)
        
        return DocResult(
            success=True,
            content=content,
            format="markdown",
            sections=["Added", "Fixed", "Changed"],
            word_count=len(content.split()),
        )
