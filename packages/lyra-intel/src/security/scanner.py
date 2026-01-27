# Compatibility shim - maps scanner to security_scanner
# Tests import from src.security.scanner but the actual file is security_scanner.py
from .security_scanner import SecurityScanner, SecurityConfig, SecurityResult, VulnerabilityLevel, SecurityFinding

__all__ = ["SecurityScanner", "SecurityConfig", "SecurityResult", "VulnerabilityLevel", "SecurityFinding"]
