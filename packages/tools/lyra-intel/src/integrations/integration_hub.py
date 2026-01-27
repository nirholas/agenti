"""
Integration Hub - Central hub for external service integrations.

This module provides a unified interface for integrating
with external services like GitHub, Slack, Jira, etc.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Callable
from abc import ABC, abstractmethod


@dataclass
class IntegrationConfig:
    """Configuration for integrations."""
    enabled_integrations: List[str] = field(default_factory=list)
    credentials: Dict[str, Dict[str, str]] = field(default_factory=dict)
    webhooks: Dict[str, str] = field(default_factory=dict)


class BaseIntegration(ABC):
    """Base class for integrations."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Get integration name."""
        pass
    
    @abstractmethod
    def configure(self, config: Dict[str, Any]) -> bool:
        """Configure the integration."""
        pass
    
    @abstractmethod
    def test_connection(self) -> bool:
        """Test the connection."""
        pass
    
    @abstractmethod
    def send(self, event_type: str, data: Dict[str, Any]) -> bool:
        """Send data to the integration."""
        pass


class IntegrationHub:
    """
    Central hub for managing integrations.
    
    Features:
    - Register and manage integrations
    - Route events to integrations
    - Handle failures gracefully
    """
    
    def __init__(self, config: Optional[IntegrationConfig] = None):
        """Initialize integration hub."""
        self.config = config or IntegrationConfig()
        self._integrations: Dict[str, BaseIntegration] = {}
        self._event_handlers: Dict[str, List[str]] = {}
    
    def register(self, integration: BaseIntegration) -> bool:
        """
        Register an integration.
        
        Args:
            integration: Integration instance
            
        Returns:
            True if successful
        """
        name = integration.name
        
        # Configure if credentials available
        if name in self.config.credentials:
            if not integration.configure(self.config.credentials[name]):
                return False
        
        self._integrations[name] = integration
        return True
    
    def unregister(self, name: str) -> bool:
        """Unregister an integration."""
        if name in self._integrations:
            del self._integrations[name]
            return True
        return False
    
    def get_integration(self, name: str) -> Optional[BaseIntegration]:
        """Get an integration by name."""
        return self._integrations.get(name)
    
    def list_integrations(self) -> List[str]:
        """List all registered integrations."""
        return list(self._integrations.keys())
    
    def subscribe(self, event_type: str, integration_name: str) -> bool:
        """
        Subscribe an integration to an event type.
        
        Args:
            event_type: Type of event
            integration_name: Name of integration
            
        Returns:
            True if successful
        """
        if integration_name not in self._integrations:
            return False
        
        if event_type not in self._event_handlers:
            self._event_handlers[event_type] = []
        
        if integration_name not in self._event_handlers[event_type]:
            self._event_handlers[event_type].append(integration_name)
        
        return True
    
    def unsubscribe(self, event_type: str, integration_name: str) -> bool:
        """Unsubscribe an integration from an event type."""
        if event_type in self._event_handlers:
            if integration_name in self._event_handlers[event_type]:
                self._event_handlers[event_type].remove(integration_name)
                return True
        return False
    
    def emit(self, event_type: str, data: Dict[str, Any]) -> Dict[str, bool]:
        """
        Emit an event to all subscribed integrations.
        
        Args:
            event_type: Type of event
            data: Event data
            
        Returns:
            Dict of integration name -> success status
        """
        results = {}
        handlers = self._event_handlers.get(event_type, [])
        
        for integration_name in handlers:
            integration = self._integrations.get(integration_name)
            if integration:
                try:
                    results[integration_name] = integration.send(event_type, data)
                except Exception:
                    results[integration_name] = False
        
        return results
    
    def test_all(self) -> Dict[str, bool]:
        """Test all integration connections."""
        results = {}
        for name, integration in self._integrations.items():
            try:
                results[name] = integration.test_connection()
            except Exception:
                results[name] = False
        return results
