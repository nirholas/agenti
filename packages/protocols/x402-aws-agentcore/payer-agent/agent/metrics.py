"""
Custom CloudWatch metrics for the x402 payer agent.

This module provides CloudWatch metrics emission using the Embedded Metric Format (EMF)
for efficient metric publishing without requiring explicit PutMetricData API calls.

Metrics are organized into the following categories:
- Payment Analysis: Decisions made by the agent
- Payment Signing: Wallet operations and transaction signing
- Content Requests: HTTP requests to seller infrastructure
- Wallet Operations: Balance checks and faucet requests
"""

import json
import logging
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class MetricUnit(str, Enum):
    """CloudWatch metric units."""
    COUNT = "Count"
    MILLISECONDS = "Milliseconds"
    BYTES = "Bytes"
    PERCENT = "Percent"
    NONE = "None"


class PayerMetricName(str, Enum):
    """Metric names for the payer agent."""
    # Payment Analysis Metrics
    PAYMENT_ANALYSIS_COUNT = "PaymentAnalysisCount"
    PAYMENT_APPROVED = "PaymentApproved"
    PAYMENT_REJECTED = "PaymentRejected"
    PAYMENT_ANALYSIS_LATENCY = "PaymentAnalysisLatency"
    
    # Payment Signing Metrics
    PAYMENT_SIGNING_COUNT = "PaymentSigningCount"
    PAYMENT_SIGNING_SUCCESS = "PaymentSigningSuccess"
    PAYMENT_SIGNING_FAILURE = "PaymentSigningFailure"
    PAYMENT_SIGNING_LATENCY = "PaymentSigningLatency"
    
    # Content Request Metrics
    CONTENT_REQUEST_COUNT = "ContentRequestCount"
    CONTENT_REQUEST_SUCCESS = "ContentRequestSuccess"
    CONTENT_REQUEST_402 = "ContentRequest402"
    CONTENT_REQUEST_ERROR = "ContentRequestError"
    CONTENT_REQUEST_LATENCY = "ContentRequestLatency"
    
    # Wallet Metrics
    WALLET_BALANCE_CHECK = "WalletBalanceCheck"
    WALLET_BALANCE_ETH = "WalletBalanceETH"
    FAUCET_REQUEST_COUNT = "FaucetRequestCount"
    FAUCET_REQUEST_SUCCESS = "FaucetRequestSuccess"
    FAUCET_REQUEST_FAILURE = "FaucetRequestFailure"
    
    # Payment Amount Metrics
    PAYMENT_AMOUNT_WEI = "PaymentAmountWei"
    PAYMENT_AMOUNT_ETH = "PaymentAmountETH"
    
    # MCP Tool Discovery Metrics
    MCP_DISCOVERY_COUNT = "MCPDiscoveryCount"
    MCP_DISCOVERY_SUCCESS = "MCPDiscoverySuccess"
    MCP_DISCOVERY_FAILURE = "MCPDiscoveryFailure"
    MCP_DISCOVERY_LATENCY = "MCPDiscoveryLatency"
    MCP_TOOLS_DISCOVERED = "MCPToolsDiscovered"
    
    # MCP Tool Invocation Metrics
    MCP_INVOCATION_COUNT = "MCPInvocationCount"
    MCP_INVOCATION_SUCCESS = "MCPInvocationSuccess"
    MCP_INVOCATION_FAILURE = "MCPInvocationFailure"
    MCP_INVOCATION_402 = "MCPInvocation402"
    MCP_INVOCATION_LATENCY = "MCPInvocationLatency"
    
    # Error Metrics
    AGENT_ERROR_COUNT = "AgentErrorCount"
    VALIDATION_ERROR_COUNT = "ValidationErrorCount"


@dataclass
class MetricDimensions:
    """Dimensions for CloudWatch metrics."""
    environment: str = field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
    network: Optional[str] = None
    currency: Optional[str] = None
    rejection_reason: Optional[str] = None
    error_type: Optional[str] = None
    content_path: Optional[str] = None
    
    def to_dict(self) -> dict[str, str]:
        """Convert to dictionary, excluding None values."""
        result = {"Environment": self.environment}
        if self.network:
            result["Network"] = self.network
        if self.currency:
            result["Currency"] = self.currency
        if self.rejection_reason:
            result["RejectionReason"] = self.rejection_reason
        if self.error_type:
            result["ErrorType"] = self.error_type
        if self.content_path:
            result["ContentPath"] = self.content_path
        return result


class MetricsEmitter:
    """
    CloudWatch metrics emitter using Embedded Metric Format (EMF).
    
    EMF allows publishing metrics by simply logging JSON in a specific format.
    CloudWatch automatically extracts metrics from these logs.
    """
    
    NAMESPACE = "X402PayerAgent"
    
    def __init__(self, service_name: str = "x402-payer-agent"):
        """
        Initialize the metrics emitter.
        
        Args:
            service_name: Service name for metric attribution
        """
        self.service_name = service_name
        self._pending_metrics: list[dict[str, Any]] = []
        self._dimensions = MetricDimensions()
    
    def _create_emf_log(
        self,
        metrics: dict[str, tuple[float, MetricUnit]],
        dimensions: Optional[MetricDimensions] = None,
        properties: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Create an EMF-formatted log entry.
        
        Args:
            metrics: Dictionary of metric name to (value, unit) tuples
            dimensions: Optional custom dimensions
            properties: Additional properties to include in the log
            
        Returns:
            EMF-formatted dictionary
        """
        dims = dimensions or self._dimensions
        dim_dict = dims.to_dict()
        
        # Build metrics array for EMF
        metrics_array = [
            {"Name": name, "Unit": unit.value}
            for name, (_, unit) in metrics.items()
        ]
        
        emf_log: dict[str, Any] = {
            "_aws": {
                "Timestamp": int(time.time() * 1000),
                "CloudWatchMetrics": [
                    {
                        "Namespace": self.NAMESPACE,
                        "Dimensions": [list(dim_dict.keys())],
                        "Metrics": metrics_array,
                    }
                ],
            },
            "service": self.service_name,
            **dim_dict,
        }
        
        # Add metric values
        for name, (value, _) in metrics.items():
            emf_log[name] = value
        
        # Add additional properties
        if properties:
            emf_log.update(properties)
        
        return emf_log
    
    def emit(
        self,
        metric_name: PayerMetricName,
        value: float,
        unit: MetricUnit = MetricUnit.COUNT,
        dimensions: Optional[MetricDimensions] = None,
        properties: Optional[dict[str, Any]] = None,
    ) -> None:
        """
        Emit a single metric.
        
        Args:
            metric_name: Name of the metric
            value: Metric value
            unit: Metric unit
            dimensions: Optional custom dimensions
            properties: Additional properties to log
        """
        emf_log = self._create_emf_log(
            {metric_name.value: (value, unit)},
            dimensions,
            properties,
        )
        # Print to stdout for CloudWatch to pick up
        print(json.dumps(emf_log))
    
    def emit_multiple(
        self,
        metrics: dict[PayerMetricName, tuple[float, MetricUnit]],
        dimensions: Optional[MetricDimensions] = None,
        properties: Optional[dict[str, Any]] = None,
    ) -> None:
        """
        Emit multiple metrics in a single log entry.
        
        Args:
            metrics: Dictionary of metric name to (value, unit) tuples
            dimensions: Optional custom dimensions
            properties: Additional properties to log
        """
        metrics_dict = {name.value: value_unit for name, value_unit in metrics.items()}
        emf_log = self._create_emf_log(metrics_dict, dimensions, properties)
        print(json.dumps(emf_log))
    
    # Convenience methods for common metrics
    
    def record_payment_analysis(
        self,
        approved: bool,
        latency_ms: float,
        amount: Optional[str] = None,
        currency: Optional[str] = None,
        rejection_reason: Optional[str] = None,
    ) -> None:
        """
        Record a payment analysis decision.
        
        Args:
            approved: Whether the payment was approved
            latency_ms: Time taken for analysis in milliseconds
            amount: Payment amount
            currency: Payment currency
            rejection_reason: Reason for rejection (if rejected)
        """
        dims = MetricDimensions(
            currency=currency,
            rejection_reason=rejection_reason if not approved else None,
        )
        
        metrics: dict[PayerMetricName, tuple[float, MetricUnit]] = {
            PayerMetricName.PAYMENT_ANALYSIS_COUNT: (1, MetricUnit.COUNT),
            PayerMetricName.PAYMENT_ANALYSIS_LATENCY: (latency_ms, MetricUnit.MILLISECONDS),
        }
        
        if approved:
            metrics[PayerMetricName.PAYMENT_APPROVED] = (1, MetricUnit.COUNT)
        else:
            metrics[PayerMetricName.PAYMENT_REJECTED] = (1, MetricUnit.COUNT)
        
        properties = {}
        if amount:
            properties["amount"] = amount
        if currency:
            properties["currency"] = currency
        if rejection_reason:
            properties["rejectionReason"] = rejection_reason
        
        self.emit_multiple(metrics, dims, properties)
    
    def record_payment_signing(
        self,
        success: bool,
        latency_ms: float,
        network: Optional[str] = None,
        amount: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        """
        Record a payment signing operation.
        
        Args:
            success: Whether signing was successful
            latency_ms: Time taken for signing in milliseconds
            network: Blockchain network
            amount: Payment amount
            error: Error message if failed
        """
        dims = MetricDimensions(
            network=network,
            error_type=error[:50] if error else None,
        )
        
        metrics: dict[PayerMetricName, tuple[float, MetricUnit]] = {
            PayerMetricName.PAYMENT_SIGNING_COUNT: (1, MetricUnit.COUNT),
            PayerMetricName.PAYMENT_SIGNING_LATENCY: (latency_ms, MetricUnit.MILLISECONDS),
        }
        
        if success:
            metrics[PayerMetricName.PAYMENT_SIGNING_SUCCESS] = (1, MetricUnit.COUNT)
            if amount:
                try:
                    amount_float = float(amount)
                    metrics[PayerMetricName.PAYMENT_AMOUNT_ETH] = (amount_float, MetricUnit.NONE)
                except ValueError:
                    pass
        else:
            metrics[PayerMetricName.PAYMENT_SIGNING_FAILURE] = (1, MetricUnit.COUNT)
        
        properties = {"network": network} if network else {}
        if error:
            properties["error"] = error
        
        self.emit_multiple(metrics, dims, properties)
    
    def record_content_request(
        self,
        status_code: int,
        latency_ms: float,
        content_path: str,
        payment_required: bool = False,
        error: Optional[str] = None,
    ) -> None:
        """
        Record a content request.
        
        Args:
            status_code: HTTP status code
            latency_ms: Request latency in milliseconds
            content_path: Content URL path
            payment_required: Whether 402 was returned
            error: Error message if request failed
        """
        dims = MetricDimensions(
            content_path=content_path[:50] if content_path else None,
        )
        
        metrics: dict[PayerMetricName, tuple[float, MetricUnit]] = {
            PayerMetricName.CONTENT_REQUEST_COUNT: (1, MetricUnit.COUNT),
            PayerMetricName.CONTENT_REQUEST_LATENCY: (latency_ms, MetricUnit.MILLISECONDS),
        }
        
        if status_code == 200:
            metrics[PayerMetricName.CONTENT_REQUEST_SUCCESS] = (1, MetricUnit.COUNT)
        elif status_code == 402:
            metrics[PayerMetricName.CONTENT_REQUEST_402] = (1, MetricUnit.COUNT)
        else:
            metrics[PayerMetricName.CONTENT_REQUEST_ERROR] = (1, MetricUnit.COUNT)
        
        properties = {
            "statusCode": status_code,
            "contentPath": content_path,
        }
        if error:
            properties["error"] = error
        
        self.emit_multiple(metrics, dims, properties)
    
    def record_wallet_balance(
        self,
        balance_eth: float,
        network: str,
        address: str,
    ) -> None:
        """
        Record a wallet balance check.
        
        Args:
            balance_eth: Balance in ETH
            network: Blockchain network
            address: Wallet address
        """
        dims = MetricDimensions(network=network)
        
        metrics: dict[PayerMetricName, tuple[float, MetricUnit]] = {
            PayerMetricName.WALLET_BALANCE_CHECK: (1, MetricUnit.COUNT),
            PayerMetricName.WALLET_BALANCE_ETH: (balance_eth, MetricUnit.NONE),
        }
        
        self.emit_multiple(metrics, dims, {
            "address": address[:10] + "..." if address else None,
            "network": network,
        })
    
    def record_faucet_request(
        self,
        success: bool,
        network: str,
        asset: str,
        error: Optional[str] = None,
    ) -> None:
        """
        Record a faucet request.
        
        Args:
            success: Whether the request was successful
            network: Blockchain network
            asset: Asset requested
            error: Error message if failed
        """
        dims = MetricDimensions(
            network=network,
            currency=asset,
        )
        
        metrics: dict[PayerMetricName, tuple[float, MetricUnit]] = {
            PayerMetricName.FAUCET_REQUEST_COUNT: (1, MetricUnit.COUNT),
        }
        
        if success:
            metrics[PayerMetricName.FAUCET_REQUEST_SUCCESS] = (1, MetricUnit.COUNT)
        else:
            metrics[PayerMetricName.FAUCET_REQUEST_FAILURE] = (1, MetricUnit.COUNT)
        
        properties = {"asset": asset, "network": network}
        if error:
            properties["error"] = error
        
        self.emit_multiple(metrics, dims, properties)
    
    def record_error(
        self,
        error_type: str,
        error_message: str,
        operation: Optional[str] = None,
    ) -> None:
        """
        Record an error.
        
        Args:
            error_type: Type of error
            error_message: Error message
            operation: Operation that failed
        """
        dims = MetricDimensions(error_type=error_type[:50])
        
        self.emit(
            PayerMetricName.AGENT_ERROR_COUNT,
            1,
            MetricUnit.COUNT,
            dims,
            {
                "errorType": error_type,
                "errorMessage": error_message[:200],
                "operation": operation,
            },
        )
    
    def record_mcp_discovery(
        self,
        success: bool,
        latency_ms: float,
        tools_count: int = 0,
        error: Optional[str] = None,
    ) -> None:
        """
        Record an MCP tool discovery operation.
        
        Args:
            success: Whether discovery was successful
            latency_ms: Time taken for discovery in milliseconds
            tools_count: Number of tools discovered
            error: Error message if failed
        """
        dims = MetricDimensions(
            error_type=error[:50] if error else None,
        )
        
        metrics: dict[PayerMetricName, tuple[float, MetricUnit]] = {
            PayerMetricName.MCP_DISCOVERY_COUNT: (1, MetricUnit.COUNT),
            PayerMetricName.MCP_DISCOVERY_LATENCY: (latency_ms, MetricUnit.MILLISECONDS),
        }
        
        if success:
            metrics[PayerMetricName.MCP_DISCOVERY_SUCCESS] = (1, MetricUnit.COUNT)
            metrics[PayerMetricName.MCP_TOOLS_DISCOVERED] = (tools_count, MetricUnit.COUNT)
        else:
            metrics[PayerMetricName.MCP_DISCOVERY_FAILURE] = (1, MetricUnit.COUNT)
        
        properties = {"toolsCount": tools_count}
        if error:
            properties["error"] = error
        
        self.emit_multiple(metrics, dims, properties)
    
    def record_mcp_invocation(
        self,
        success: bool,
        tool_name: str,
        latency_ms: float,
        payment_required: bool = False,
        error: Optional[str] = None,
    ) -> None:
        """
        Record an MCP tool invocation.
        
        Args:
            success: Whether invocation was successful
            tool_name: Name of the tool invoked
            latency_ms: Time taken for invocation in milliseconds
            payment_required: Whether 402 was returned
            error: Error message if failed
        """
        dims = MetricDimensions(
            error_type=error[:50] if error else None,
        )
        
        metrics: dict[PayerMetricName, tuple[float, MetricUnit]] = {
            PayerMetricName.MCP_INVOCATION_COUNT: (1, MetricUnit.COUNT),
            PayerMetricName.MCP_INVOCATION_LATENCY: (latency_ms, MetricUnit.MILLISECONDS),
        }
        
        if success:
            metrics[PayerMetricName.MCP_INVOCATION_SUCCESS] = (1, MetricUnit.COUNT)
        elif payment_required:
            metrics[PayerMetricName.MCP_INVOCATION_402] = (1, MetricUnit.COUNT)
        else:
            metrics[PayerMetricName.MCP_INVOCATION_FAILURE] = (1, MetricUnit.COUNT)
        
        properties = {"toolName": tool_name}
        if error:
            properties["error"] = error
        
        self.emit_multiple(metrics, dims, properties)


# Global metrics emitter instance
_metrics_emitter: Optional[MetricsEmitter] = None


def get_metrics_emitter() -> MetricsEmitter:
    """Get the global metrics emitter instance."""
    global _metrics_emitter
    if _metrics_emitter is None:
        _metrics_emitter = MetricsEmitter()
    return _metrics_emitter


def init_metrics(service_name: str = "x402-payer-agent") -> MetricsEmitter:
    """
    Initialize the global metrics emitter.
    
    Args:
        service_name: Service name for metric attribution
        
    Returns:
        Configured MetricsEmitter instance
    """
    global _metrics_emitter
    _metrics_emitter = MetricsEmitter(service_name)
    return _metrics_emitter
