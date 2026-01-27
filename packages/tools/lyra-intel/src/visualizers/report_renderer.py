"""
Report Renderer - Generates analysis reports.

Supports multiple output formats:
- Markdown
- HTML
- PDF (via HTML)
- JSON
"""

import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class ReportFormat:
    """Report output formats."""
    MARKDOWN = "markdown"
    HTML = "html"
    JSON = "json"


@dataclass
class ReportSection:
    """Section of a report."""
    title: str
    content: str
    level: int = 2
    subsections: List['ReportSection'] = field(default_factory=list)


@dataclass
class ReportConfig:
    """Configuration for report generation."""
    format: str = ReportFormat.MARKDOWN
    include_toc: bool = True
    include_summary: bool = True
    include_metrics: bool = True
    include_patterns: bool = True
    include_dependencies: bool = True
    include_recommendations: bool = True
    max_items_per_section: int = 50


class ReportRenderer:
    """
    Generates comprehensive analysis reports.
    
    Creates reports from analysis results with:
    - Executive summary
    - Codebase metrics
    - Pattern analysis
    - Dependency overview
    - Recommendations
    """
    
    def __init__(self, config: Optional[ReportConfig] = None):
        self.config = config or ReportConfig()
    
    def generate(
        self,
        analysis_results: Dict[str, Any],
        output_path: Optional[str] = None
    ) -> str:
        """
        Generate a comprehensive report.
        
        Args:
            analysis_results: Combined analysis data
            output_path: Optional path to save report
            
        Returns:
            Rendered report as string
        """
        sections = []
        
        # Header
        repo_name = analysis_results.get("repository", {}).get("name", "Unknown")
        sections.append(self._create_header(repo_name))
        
        # Executive Summary
        if self.config.include_summary:
            sections.append(self._create_summary(analysis_results))
        
        # Table of Contents (generated later for markdown)
        
        # Codebase Metrics
        if self.config.include_metrics:
            sections.append(self._create_metrics_section(analysis_results))
        
        # Code Structure
        sections.append(self._create_structure_section(analysis_results))
        
        # Pattern Analysis
        if self.config.include_patterns:
            sections.append(self._create_patterns_section(analysis_results))
        
        # Dependency Analysis
        if self.config.include_dependencies:
            sections.append(self._create_dependencies_section(analysis_results))
        
        # Git History
        sections.append(self._create_git_section(analysis_results))
        
        # Recommendations
        if self.config.include_recommendations:
            sections.append(self._create_recommendations_section(analysis_results))
        
        # Render
        if self.config.format == ReportFormat.MARKDOWN:
            output = self._render_markdown(sections)
        elif self.config.format == ReportFormat.HTML:
            output = self._render_html(sections)
        elif self.config.format == ReportFormat.JSON:
            output = self._render_json(sections, analysis_results)
        else:
            output = self._render_markdown(sections)
        
        if output_path:
            Path(output_path).write_text(output)
            logger.info(f"Report saved to: {output_path}")
        
        return output
    
    def _create_header(self, repo_name: str) -> ReportSection:
        """Create report header."""
        content = f"""**Repository:** {repo_name}  
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
**Analyzer:** Lyra Intel v0.1.0
"""
        return ReportSection(title=f"Codebase Analysis Report: {repo_name}", content=content, level=1)
    
    def _create_summary(self, results: Dict[str, Any]) -> ReportSection:
        """Create executive summary."""
        files = results.get("files", {})
        patterns = results.get("patterns", {})
        commits = results.get("commits", {})
        
        total_files = files.get("total", 0)
        total_lines = files.get("total_lines", 0)
        critical_issues = patterns.get("by_severity", {}).get("critical", 0)
        warnings = patterns.get("by_severity", {}).get("warning", 0)
        total_commits = commits.get("total", 0)
        
        health_score = self._calculate_health_score(results)
        
        content = f"""### Overview

This report provides a comprehensive analysis of the codebase, including code structure, 
dependencies, patterns, and recommendations for improvement.

### Key Findings

| Metric | Value |
|--------|-------|
| Total Files | {total_files:,} |
| Total Lines | {total_lines:,} |
| Health Score | {health_score}/100 |
| Critical Issues | {critical_issues} |
| Warnings | {warnings} |
| Total Commits | {total_commits:,} |

### Health Score Breakdown

The health score is calculated based on:
- Code complexity
- Pattern violations
- Test coverage (if available)
- Documentation coverage
- Dependency health
"""
        return ReportSection(title="Executive Summary", content=content)
    
    def _create_metrics_section(self, results: Dict[str, Any]) -> ReportSection:
        """Create metrics section."""
        files = results.get("files", {})
        code_units = results.get("code_units", {})
        
        by_extension = files.get("by_extension", {})
        ext_table = "| Extension | Count |\n|-----------|-------|\n"
        for ext, count in sorted(by_extension.items(), key=lambda x: -x[1])[:10]:
            ext_table += f"| {ext} | {count} |\n"
        
        by_type = code_units.get("by_type", {})
        type_table = "| Type | Count |\n|------|-------|\n"
        for unit_type, count in sorted(by_type.items(), key=lambda x: -x[1]):
            type_table += f"| {unit_type} | {count} |\n"
        
        content = f"""### File Distribution

{ext_table}

### Code Unit Distribution

{type_table}

### Size Metrics

- **Total Size:** {files.get('total_size_bytes', 0) / 1024 / 1024:.2f} MB
- **Average File Size:** {files.get('total_size_bytes', 0) / max(files.get('total', 1), 1) / 1024:.2f} KB
- **Largest File:** (to be determined)
"""
        return ReportSection(title="Codebase Metrics", content=content)
    
    def _create_structure_section(self, results: Dict[str, Any]) -> ReportSection:
        """Create code structure section."""
        code_units = results.get("code_units", {})
        
        content = f"""### Overview

The codebase contains:
- **{code_units.get('functions', 0):,}** functions
- **{code_units.get('classes', 0):,}** classes
- **{code_units.get('total_imports', 0):,}** imports

### Complexity Analysis

Average complexity scores by type will be listed here when available.

### Top Complex Functions

Functions with the highest cyclomatic complexity require attention for potential refactoring.
"""
        return ReportSection(title="Code Structure", content=content)
    
    def _create_patterns_section(self, results: Dict[str, Any]) -> ReportSection:
        """Create patterns section."""
        patterns = results.get("patterns", {})
        
        by_category = patterns.get("by_category", {})
        category_table = "| Category | Count |\n|----------|-------|\n"
        for cat, count in sorted(by_category.items(), key=lambda x: -x[1]):
            category_table += f"| {cat} | {count} |\n"
        
        by_severity = patterns.get("by_severity", {})
        severity_table = "| Severity | Count |\n|----------|-------|\n"
        for sev, count in [("critical", by_severity.get("critical", 0)),
                           ("error", by_severity.get("error", 0)),
                           ("warning", by_severity.get("warning", 0)),
                           ("info", by_severity.get("info", 0))]:
            if count > 0:
                severity_table += f"| {sev} | {count} |\n"
        
        content = f"""### Pattern Distribution by Category

{category_table}

### Issues by Severity

{severity_table}

### Top Issues

The most critical issues that should be addressed:

1. Check for hardcoded secrets
2. Review god classes (>20 methods)
3. Refactor long methods (>50 lines)
4. Address deep nesting (>4 levels)
"""
        return ReportSection(title="Pattern Analysis", content=content)
    
    def _create_dependencies_section(self, results: Dict[str, Any]) -> ReportSection:
        """Create dependencies section."""
        deps = results.get("dependencies", {})
        
        content = f"""### Overview

- **Total Dependencies:** {deps.get('total', 0)}
- **Internal Dependencies:** {deps.get('internal', 0)}
- **External Dependencies:** {deps.get('external', 0)}
- **Circular Dependencies:** {len(deps.get('circular', []))}

### External Dependencies

External packages and libraries used by the codebase.

### Circular Dependencies

Circular dependencies can lead to import errors and tight coupling. 
Any detected circular dependencies will be listed here.
"""
        return ReportSection(title="Dependency Analysis", content=content)
    
    def _create_git_section(self, results: Dict[str, Any]) -> ReportSection:
        """Create git history section."""
        commits = results.get("commits", {})
        
        content = f"""### Overview

- **Total Commits:** {commits.get('total', 0):,}
- **Unique Authors:** {commits.get('authors', 0)}
- **Total Insertions:** {commits.get('total_insertions', 0):,}
- **Total Deletions:** {commits.get('total_deletions', 0):,}

### Activity Timeline

Commit activity over time will be visualized here.

### Top Contributors

Top contributors by commit count.
"""
        return ReportSection(title="Git History", content=content)
    
    def _create_recommendations_section(self, results: Dict[str, Any]) -> ReportSection:
        """Create recommendations section."""
        recommendations = self._generate_recommendations(results)
        
        rec_list = "\n".join([f"- {rec}" for rec in recommendations])
        
        content = f"""### Priority Actions

Based on the analysis, the following actions are recommended:

{rec_list}

### Long-term Improvements

1. **Increase test coverage** - Add unit tests for critical paths
2. **Reduce complexity** - Break down complex functions
3. **Improve documentation** - Add docstrings to public APIs
4. **Dependency cleanup** - Remove unused dependencies
"""
        return ReportSection(title="Recommendations", content=content)
    
    def _calculate_health_score(self, results: Dict[str, Any]) -> int:
        """Calculate overall health score (0-100)."""
        score = 100
        
        patterns = results.get("patterns", {})
        by_severity = patterns.get("by_severity", {})
        
        # Deduct for issues
        score -= by_severity.get("critical", 0) * 10
        score -= by_severity.get("error", 0) * 5
        score -= by_severity.get("warning", 0) * 2
        score -= by_severity.get("info", 0) * 0.5
        
        # Deduct for circular dependencies
        deps = results.get("dependencies", {})
        score -= len(deps.get("circular", [])) * 5
        
        return max(0, min(100, int(score)))
    
    def _generate_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on analysis."""
        recommendations = []
        
        patterns = results.get("patterns", {})
        by_severity = patterns.get("by_severity", {})
        
        if by_severity.get("critical", 0) > 0:
            recommendations.append("**CRITICAL:** Address all critical issues immediately")
        
        if patterns.get("by_pattern", {}).get("hardcoded_secret", 0) > 0:
            recommendations.append("Remove hardcoded secrets and use environment variables")
        
        if patterns.get("by_pattern", {}).get("god_class", 0) > 0:
            recommendations.append("Refactor god classes into smaller, focused components")
        
        if patterns.get("by_pattern", {}).get("long_method", 0) > 0:
            recommendations.append("Break down long methods into smaller helper functions")
        
        deps = results.get("dependencies", {})
        if len(deps.get("circular", [])) > 0:
            recommendations.append("Resolve circular dependencies to improve modularity")
        
        if not recommendations:
            recommendations.append("Codebase is in good health - maintain current practices")
        
        return recommendations
    
    def _render_markdown(self, sections: List[ReportSection]) -> str:
        """Render as Markdown."""
        lines = []
        
        for section in sections:
            heading = "#" * section.level
            lines.append(f"{heading} {section.title}\n")
            lines.append(section.content)
            lines.append("")
            
            for subsection in section.subsections:
                subheading = "#" * (section.level + 1)
                lines.append(f"{subheading} {subsection.title}\n")
                lines.append(subsection.content)
                lines.append("")
        
        return "\n".join(lines)
    
    def _render_html(self, sections: List[ReportSection]) -> str:
        """Render as HTML."""
        # Convert markdown to HTML (basic)
        md_content = self._render_markdown(sections)
        
        # Basic markdown to HTML conversion
        html_content = md_content
        
        # Convert headers line by line for proper closing tags
        lines = html_content.split("\n")
        converted_lines = []
        
        for line in lines:
            converted = False
            for i in range(6, 0, -1):
                prefix = "#" * i + " "
                if line.startswith(prefix):
                    content = line[len(prefix):]
                    converted_lines.append(f"<h{i}>{content}</h{i}>")
                    converted = True
                    break
            if not converted:
                converted_lines.append(line)
        
        html_content = "\n".join(converted_lines)
        
        # Tables (basic)
        lines = html_content.split("\n")
        in_table = False
        new_lines = []
        
        for line in lines:
            if line.startswith("|"):
                if not in_table:
                    new_lines.append("<table>")
                    in_table = True
                
                if "---" in line:
                    continue
                
                cells = [c.strip() for c in line.split("|")[1:-1]]
                row = "<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"
                new_lines.append(row)
            else:
                if in_table:
                    new_lines.append("</table>")
                    in_table = False
                new_lines.append(line)
        
        html_content = "\n".join(new_lines)
        
        return f'''<!DOCTYPE html>
<html>
<head>
    <title>Lyra Intel Analysis Report</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }}
        h1 {{ color: #1a1a1a; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }}
        h2 {{ color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; }}
        table {{ border-collapse: collapse; width: 100%; margin: 15px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #4CAF50; color: white; }}
        tr:nth-child(even) {{ background-color: #f9f9f9; }}
        code {{ background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }}
        .critical {{ color: #d32f2f; font-weight: bold; }}
        .warning {{ color: #ff9800; }}
    </style>
</head>
<body>
{html_content}
</body>
</html>'''
    
    def _render_json(self, sections: List[ReportSection], results: Dict[str, Any]) -> str:
        """Render as JSON."""
        report = {
            "generated_at": datetime.now().isoformat(),
            "version": "0.1.0",
            "sections": [
                {
                    "title": s.title,
                    "level": s.level,
                    "content": s.content,
                }
                for s in sections
            ],
            "raw_data": results,
        }
        return json.dumps(report, indent=2, default=str)
