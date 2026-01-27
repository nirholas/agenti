"""
Grafana dashboard definitions for Lyra Intel monitoring.
"""

DASHBOARD_API_OVERVIEW = {
    "dashboard": {
        "title": "Lyra Intel - API Overview",
        "tags": ["lyra-intel", "api"],
        "timezone": "browser",
        "panels": [
            {
                "id": 1,
                "title": "Request Rate",
                "type": "graph",
                "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
                "targets": [
                    {
                        "expr": "rate(lyra_intel_requests_total[5m])",
                        "legendFormat": "{{method}} {{endpoint}}"
                    }
                ]
            },
            {
                "id": 2,
                "title": "Request Duration (p95)",
                "type": "graph",
                "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
                "targets": [
                    {
                        "expr": "histogram_quantile(0.95, rate(lyra_intel_request_duration_seconds_bucket[5m]))",
                        "legendFormat": "{{method}} {{endpoint}}"
                    }
                ]
            },
            {
                "id": 3,
                "title": "Error Rate",
                "type": "graph",
                "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
                "targets": [
                    {
                        "expr": "rate(lyra_intel_requests_total{status=~\"5..\"}[5m])",
                        "legendFormat": "{{endpoint}}"
                    }
                ]
            },
            {
                "id": 4,
                "title": "Active Analyses",
                "type": "graph",
                "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
                "targets": [
                    {
                        "expr": "lyra_intel_active_analyses",
                        "legendFormat": "Active Analyses"
                    }
                ]
            }
        ]
    }
}

DASHBOARD_ANALYSIS = {
    "dashboard": {
        "title": "Lyra Intel - Analysis Metrics",
        "tags": ["lyra-intel", "analysis"],
        "timezone": "browser",
        "panels": [
            {
                "id": 1,
                "title": "Analysis Rate by Type",
                "type": "graph",
                "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
                "targets": [
                    {
                        "expr": "rate(lyra_intel_analyses_total[5m])",
                        "legendFormat": "{{analyzer_type}}"
                    }
                ]
            },
            {
                "id": 2,
                "title": "Analysis Duration by Type",
                "type": "graph",
                "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
                "targets": [
                    {
                        "expr": "histogram_quantile(0.95, rate(lyra_intel_analysis_duration_seconds_bucket[5m]))",
                        "legendFormat": "{{analyzer_type}}"
                    }
                ]
            },
            {
                "id": 3,
                "title": "Files Analyzed by Language",
                "type": "piechart",
                "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
                "targets": [
                    {
                        "expr": "lyra_intel_files_analyzed_total",
                        "legendFormat": "{{language}}"
                    }
                ]
            },
            {
                "id": 4,
                "title": "Cache Hit Rate",
                "type": "graph",
                "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
                "targets": [
                    {
                        "expr": "rate(lyra_intel_cache_hits_total[5m]) / (rate(lyra_intel_cache_hits_total[5m]) + rate(lyra_intel_cache_misses_total[5m]))",
                        "legendFormat": "{{cache_type}}"
                    }
                ]
            }
        ]
    }
}

DASHBOARD_AI_PROVIDERS = {
    "dashboard": {
        "title": "Lyra Intel - AI Providers",
        "tags": ["lyra-intel", "ai"],
        "timezone": "browser",
        "panels": [
            {
                "id": 1,
                "title": "AI Request Rate",
                "type": "graph",
                "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
                "targets": [
                    {
                        "expr": "rate(lyra_intel_ai_requests_total[5m])",
                        "legendFormat": "{{provider}}"
                    }
                ]
            },
            {
                "id": 2,
                "title": "Token Usage",
                "type": "graph",
                "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
                "targets": [
                    {
                        "expr": "rate(lyra_intel_ai_tokens_total[5m])",
                        "legendFormat": "{{provider}} - {{type}}"
                    }
                ]
            },
            {
                "id": 3,
                "title": "AI Error Rate",
                "type": "graph",
                "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
                "targets": [
                    {
                        "expr": "rate(lyra_intel_ai_requests_total{status=\"error\"}[5m])",
                        "legendFormat": "{{provider}}"
                    }
                ]
            }
        ]
    }
}
