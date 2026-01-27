"""
Event Types - Standard event type definitions.

Provides consistent event type naming across the system.
"""

from enum import Enum


class EventType(str, Enum):
    """Standard event types for the system."""
    
    # Analysis events
    ANALYSIS_STARTED = "analysis.started"
    ANALYSIS_PROGRESS = "analysis.progress"
    ANALYSIS_COMPLETED = "analysis.completed"
    ANALYSIS_FAILED = "analysis.failed"
    
    # File events
    FILE_DISCOVERED = "file.discovered"
    FILE_ANALYZED = "file.analyzed"
    FILE_CHANGED = "file.changed"
    
    # Code events
    CODE_UNIT_FOUND = "code.unit_found"
    CODE_PATTERN_DETECTED = "code.pattern_detected"
    CODE_COMPLEXITY_HIGH = "code.complexity_high"
    
    # Dependency events
    DEPENDENCY_FOUND = "dependency.found"
    DEPENDENCY_CIRCULAR = "dependency.circular"
    DEPENDENCY_EXTERNAL = "dependency.external"
    
    # Git events
    COMMIT_PROCESSED = "git.commit_processed"
    CONTRIBUTOR_FOUND = "git.contributor_found"
    BRANCH_ANALYZED = "git.branch_analyzed"
    
    # Worker events
    WORKER_STARTED = "worker.started"
    WORKER_TASK_ASSIGNED = "worker.task_assigned"
    WORKER_TASK_COMPLETED = "worker.task_completed"
    WORKER_FAILED = "worker.failed"
    WORKER_IDLE = "worker.idle"
    
    # Search events
    SEARCH_STARTED = "search.started"
    SEARCH_COMPLETED = "search.completed"
    SEARCH_INDEX_UPDATED = "search.index_updated"
    
    # Report events
    REPORT_GENERATING = "report.generating"
    REPORT_COMPLETED = "report.completed"
    
    # System events
    SYSTEM_STARTUP = "system.startup"
    SYSTEM_SHUTDOWN = "system.shutdown"
    SYSTEM_ERROR = "system.error"
    SYSTEM_METRIC = "system.metric"
    
    # Cache events
    CACHE_HIT = "cache.hit"
    CACHE_MISS = "cache.miss"
    CACHE_INVALIDATED = "cache.invalidated"
    
    # Plugin events
    PLUGIN_LOADED = "plugin.loaded"
    PLUGIN_UNLOADED = "plugin.unloaded"
    PLUGIN_ERROR = "plugin.error"
    
    # AI events
    AI_REQUEST_STARTED = "ai.request_started"
    AI_REQUEST_COMPLETED = "ai.request_completed"
    AI_ANALYSIS_RESULT = "ai.analysis_result"
