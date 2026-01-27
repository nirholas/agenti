"""
Example plugin implementations for Lyra Intel.

Demonstrates how to create custom plugins:
- Code quality plugin
- Custom security scanner
- Metrics collector
- Report generator
"""

import logging
from typing import Dict, Any, List
from ..plugins.plugin_base import (
    AnalyzerPlugin,
    ReportPlugin,
    ExporterPlugin,
    IntegrationPlugin,
)

logger = logging.getLogger(__name__)


class CodeQualityPlugin(AnalyzerPlugin):
    """
    Plugin for advanced code quality analysis.
    
    Analyzes:
    - Code duplication
    - Dead code
    - Code smells
    - Best practices violations
    """
    
    def get_name(self) -> str:
        return "code-quality"
    
    def get_version(self) -> str:
        return "1.0.0"
    
    def get_description(self) -> str:
        return "Advanced code quality analyzer"
    
    def analyze(self, code: str, language: str, **kwargs) -> Dict[str, Any]:
        """Run code quality analysis."""
        results = {
            "quality_score": 0.0,
            "issues": [],
            "metrics": {},
        }
        
        lines = code.split('\n')
        total_lines = len(lines)
        
        # Detect code duplication
        duplicates = self._detect_duplicates(lines)
        if duplicates:
            results["issues"].append({
                "type": "duplication",
                "severity": "medium",
                "count": len(duplicates),
                "description": f"Found {len(duplicates)} duplicate code blocks",
            })
        
        # Detect dead code
        dead_code = self._detect_dead_code(code, language)
        if dead_code:
            results["issues"].append({
                "type": "dead_code",
                "severity": "low",
                "items": dead_code,
                "description": f"Found {len(dead_code)} unused definitions",
            })
        
        # Detect long functions
        long_functions = self._detect_long_functions(code, language)
        if long_functions:
            results["issues"].append({
                "type": "long_function",
                "severity": "medium",
                "count": len(long_functions),
                "description": f"Found {len(long_functions)} functions longer than 50 lines",
            })
        
        # Calculate quality score
        issues_count = len(results["issues"])
        results["quality_score"] = max(0.0, 100.0 - (issues_count * 10.0))
        
        results["metrics"] = {
            "total_lines": total_lines,
            "duplicate_blocks": len(duplicates),
            "dead_code_items": len(dead_code),
            "long_functions": len(long_functions),
        }
        
        return results
    
    def _detect_duplicates(self, lines: List[str]) -> List[Dict[str, Any]]:
        """Detect duplicate code blocks."""
        duplicates = []
        block_size = 5
        seen_blocks = {}
        
        for i in range(len(lines) - block_size + 1):
            block = tuple(lines[i:i+block_size])
            block_str = '\n'.join(block).strip()
            
            if not block_str or len(block_str) < 20:
                continue
            
            if block in seen_blocks:
                duplicates.append({
                    "line_start": i + 1,
                    "line_end": i + block_size,
                    "duplicate_of": seen_blocks[block],
                })
            else:
                seen_blocks[block] = i + 1
        
        return duplicates
    
    def _detect_dead_code(self, code: str, language: str) -> List[str]:
        """Detect unused functions/classes."""
        dead = []
        
        if language == "python":
            # Simple heuristic: find def/class that's never called
            import re
            
            definitions = re.findall(r'^\s*(?:def|class)\s+(\w+)', code, re.MULTILINE)
            
            for defn in definitions:
                if defn.startswith('_'):  # Skip private
                    continue
                
                # Count references (excluding definition)
                pattern = rf'\b{re.escape(defn)}\b'
                matches = len(re.findall(pattern, code))
                
                if matches == 1:  # Only the definition itself
                    dead.append(defn)
        
        return dead
    
    def _detect_long_functions(self, code: str, language: str) -> List[Dict[str, Any]]:
        """Detect functions longer than threshold."""
        long_funcs = []
        
        if language == "python":
            import re
            
            # Find function definitions and measure length
            lines = code.split('\n')
            in_function = False
            func_start = 0
            func_name = ""
            indent_level = 0
            
            for i, line in enumerate(lines):
                stripped = line.lstrip()
                
                # Detect function start
                if stripped.startswith('def '):
                    if in_function:
                        # Previous function ended
                        func_length = i - func_start
                        if func_length > 50:
                            long_funcs.append({
                                "name": func_name,
                                "line_start": func_start + 1,
                                "line_end": i,
                                "length": func_length,
                            })
                    
                    in_function = True
                    func_start = i
                    func_name = re.match(r'def\s+(\w+)', stripped).group(1)
                    indent_level = len(line) - len(stripped)
                
                elif in_function:
                    # Check if function ended (dedent or EOF)
                    current_indent = len(line) - len(stripped)
                    
                    if stripped and current_indent <= indent_level and not stripped.startswith('#'):
                        func_length = i - func_start
                        if func_length > 50:
                            long_funcs.append({
                                "name": func_name,
                                "line_start": func_start + 1,
                                "line_end": i,
                                "length": func_length,
                            })
                        in_function = False
        
        return long_funcs


class MetricsCollectorPlugin(AnalyzerPlugin):
    """Plugin for collecting custom metrics."""
    
    def get_name(self) -> str:
        return "metrics-collector"
    
    def get_version(self) -> str:
        return "1.0.0"
    
    def get_description(self) -> str:
        return "Collects custom code metrics"
    
    def analyze(self, code: str, language: str, **kwargs) -> Dict[str, Any]:
        """Collect metrics."""
        lines = code.split('\n')
        
        return {
            "loc": {
                "total": len(lines),
                "code": sum(1 for l in lines if l.strip() and not l.strip().startswith('#')),
                "comments": sum(1 for l in lines if l.strip().startswith('#')),
                "blank": sum(1 for l in lines if not l.strip()),
            },
            "complexity": self._calculate_complexity(code),
            "maintainability": self._calculate_maintainability(code),
        }
    
    def _calculate_complexity(self, code: str) -> int:
        """Simple complexity calculation."""
        keywords = ['if', 'elif', 'else', 'for', 'while', 'try', 'except', 'with']
        complexity = 1
        
        for line in code.split('\n'):
            for keyword in keywords:
                if f' {keyword} ' in line or line.strip().startswith(f'{keyword} '):
                    complexity += 1
        
        return complexity
    
    def _calculate_maintainability(self, code: str) -> float:
        """Calculate maintainability index (0-100)."""
        lines = code.split('\n')
        loc = len([l for l in lines if l.strip()])
        complexity = self._calculate_complexity(code)
        comments = len([l for l in lines if l.strip().startswith('#')])
        
        if loc == 0:
            return 100.0
        
        comment_ratio = comments / loc
        complexity_penalty = min(complexity / loc * 20, 40)
        
        score = 100.0 - complexity_penalty + (comment_ratio * 20)
        return max(0.0, min(100.0, score))


class JSONReportPlugin(ReportPlugin):
    """Generate JSON reports."""
    
    def get_name(self) -> str:
        return "json-report"
    
    def get_version(self) -> str:
        return "1.0.0"
    
    def get_description(self) -> str:
        return "Generate JSON format reports"
    
    def generate_report(self, analysis_results: Dict[str, Any], **kwargs) -> str:
        """Generate JSON report."""
        import json
        return json.dumps(analysis_results, indent=2)
    
    def get_supported_formats(self) -> List[str]:
        return ["json"]


class HTMLReportPlugin(ReportPlugin):
    """Generate HTML reports."""
    
    def get_name(self) -> str:
        return "html-report"
    
    def get_version(self) -> str:
        return "1.0.0"
    
    def get_description(self) -> str:
        return "Generate interactive HTML reports"
    
    def generate_report(self, analysis_results: Dict[str, Any], **kwargs) -> str:
        """Generate HTML report."""
        title = kwargs.get("title", "Analysis Report")
        
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>{title}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        h1 {{ color: #333; }}
        .metric {{ background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }}
        .metric-value {{ font-size: 24px; font-weight: bold; color: #0066cc; }}
        table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
        th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
        th {{ background-color: #4CAF50; color: white; }}
        .severity-high {{ color: #d32f2f; }}
        .severity-medium {{ color: #f57c00; }}
        .severity-low {{ color: #fbc02d; }}
    </style>
</head>
<body>
    <h1>{title}</h1>
    <div class="metrics">
"""
        
        # Add metrics
        metrics = analysis_results.get("metrics", {})
        for key, value in metrics.items():
            html += f"""
        <div class="metric">
            <div>{key.replace('_', ' ').title()}</div>
            <div class="metric-value">{value}</div>
        </div>
"""
        
        # Add issues table
        issues = analysis_results.get("security", {}).get("findings", [])
        if issues:
            html += """
    </div>
    <h2>Issues Found</h2>
    <table>
        <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>File</th>
            <th>Line</th>
            <th>Description</th>
        </tr>
"""
            for issue in issues:
                severity = issue.get("severity", "low")
                html += f"""
        <tr>
            <td class="severity-{severity}">{severity.upper()}</td>
            <td>{issue.get('type', 'unknown')}</td>
            <td>{issue.get('file_path', '')}</td>
            <td>{issue.get('line', '')}</td>
            <td>{issue.get('description', '')}</td>
        </tr>
"""
            html += """
    </table>
"""
        
        html += """
</body>
</html>"""
        
        return html
    
    def get_supported_formats(self) -> List[str]:
        return ["html"]


class GitLabIntegrationPlugin(IntegrationPlugin):
    """GitLab integration plugin."""
    
    def get_name(self) -> str:
        return "gitlab"
    
    def get_version(self) -> str:
        return "1.0.0"
    
    def get_description(self) -> str:
        return "GitLab integration for issue tracking and MR comments"
    
    def connect(self, **config) -> bool:
        """Connect to GitLab."""
        self.api_url = config.get("api_url", "https://gitlab.com/api/v4")
        self.token = config.get("token", "")
        self.project_id = config.get("project_id", "")
        
        if not self.token:
            logger.error("GitLab token not provided")
            return False
        
        return True
    
    def send_notification(self, message: str, **kwargs) -> bool:
        """Send notification via GitLab issue or comment."""
        try:
            import requests
            
            url = f"{self.api_url}/projects/{self.project_id}/issues"
            headers = {"PRIVATE-TOKEN": self.token}
            data = {
                "title": kwargs.get("title", "Analysis Report"),
                "description": message,
                "labels": kwargs.get("labels", ["analysis"]),
            }
            
            response = requests.post(url, headers=headers, json=data, timeout=10)
            return response.status_code in [200, 201]
            
        except Exception as e:
            logger.error(f"GitLab notification failed: {e}")
            return False
