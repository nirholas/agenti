"""OpenTelemetry tracing configuration for the x402 payer agent.

This module sets up distributed tracing with support for:
- AWS X-Ray integration via OTLP exporter
- Automatic httpx instrumentation for outbound HTTP calls
- Custom spans for payment operations
"""

import os
from functools import wraps
from typing import Any, Callable, TypeVar, ParamSpec

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.propagators.aws import AwsXRayPropagator
from opentelemetry.sdk.extension.aws.trace import AwsXRayIdGenerator
from opentelemetry.propagate import set_global_textmap
from opentelemetry.trace import Status, StatusCode

# Type variables for decorator
P = ParamSpec("P")
T = TypeVar("T")

# Global tracer instance
_tracer: trace.Tracer | None = None
_initialized = False


def init_tracing(
    service_name: str = "x402-payer-agent",
    otlp_endpoint: str | None = None,
    enable_console_export: bool = False,
) -> trace.Tracer:
    """Initialize OpenTelemetry tracing.
    
    Args:
        service_name: Name of the service for tracing
        otlp_endpoint: OTLP collector endpoint (e.g., "http://localhost:4317")
                      If None, uses OTEL_EXPORTER_OTLP_ENDPOINT env var
        enable_console_export: If True, also export spans to console (for debugging)
    
    Returns:
        Configured tracer instance
    """
    global _tracer, _initialized
    
    if _initialized and _tracer is not None:
        return _tracer
    
    # Create resource with service name
    resource = Resource.create({
        SERVICE_NAME: service_name,
        "service.version": "0.1.0",
        "deployment.environment": os.getenv("ENVIRONMENT", "development"),
    })
    
    # Create tracer provider with AWS X-Ray ID generator
    provider = TracerProvider(
        resource=resource,
        id_generator=AwsXRayIdGenerator(),
    )
    
    # Set up AWS X-Ray propagator for distributed tracing
    set_global_textmap(AwsXRayPropagator())
    
    # Configure OTLP exporter if endpoint is provided
    endpoint = otlp_endpoint or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if endpoint:
        otlp_exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    
    # Optionally add console exporter for debugging
    if enable_console_export or os.getenv("OTEL_CONSOLE_EXPORT", "").lower() == "true":
        console_exporter = ConsoleSpanExporter()
        provider.add_span_processor(BatchSpanProcessor(console_exporter))
    
    # Set the global tracer provider
    trace.set_tracer_provider(provider)
    
    # Get tracer instance
    _tracer = trace.get_tracer(service_name)
    _initialized = True
    
    # Instrument httpx for automatic HTTP tracing
    _instrument_httpx()
    
    return _tracer


def _instrument_httpx() -> None:
    """Instrument httpx for automatic HTTP request tracing."""
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentation
        HTTPXClientInstrumentation().instrument()
    except ImportError:
        pass  # httpx instrumentation not available


def get_tracer() -> trace.Tracer:
    """Get the configured tracer instance.
    
    Returns:
        Tracer instance (initializes with defaults if not already initialized)
    """
    global _tracer
    if _tracer is None:
        return init_tracing()
    return _tracer


def traced(
    name: str | None = None,
    attributes: dict[str, Any] | None = None,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """Decorator to add tracing to a function.
    
    Args:
        name: Span name (defaults to function name)
        attributes: Additional span attributes
    
    Returns:
        Decorated function with tracing
    """
    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        span_name = name or func.__name__
        
        @wraps(func)
        def sync_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            tracer = get_tracer()
            with tracer.start_as_current_span(span_name) as span:
                if attributes:
                    for key, value in attributes.items():
                        span.set_attribute(key, value)
                try:
                    result = func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise
        
        @wraps(func)
        async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            tracer = get_tracer()
            with tracer.start_as_current_span(span_name) as span:
                if attributes:
                    for key, value in attributes.items():
                        span.set_attribute(key, value)
                try:
                    result = await func(*args, **kwargs)  # type: ignore
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise
        
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper  # type: ignore
        return sync_wrapper
    
    return decorator


def add_payment_span_attributes(
    span: trace.Span,
    amount: str | None = None,
    currency: str | None = None,
    network: str | None = None,
    recipient: str | None = None,
    status: str | None = None,
) -> None:
    """Add payment-specific attributes to a span.
    
    Args:
        span: The span to add attributes to
        amount: Payment amount
        currency: Payment currency
        network: Blockchain network
        recipient: Recipient address
        status: Payment status
    """
    if amount:
        span.set_attribute("payment.amount", amount)
    if currency:
        span.set_attribute("payment.currency", currency)
    if network:
        span.set_attribute("payment.network", network)
    if recipient:
        span.set_attribute("payment.recipient", recipient)
    if status:
        span.set_attribute("payment.status", status)


def create_payment_span(
    operation: str,
    amount: str | None = None,
    currency: str | None = None,
    network: str | None = None,
) -> trace.Span:
    """Create a new span for a payment operation.
    
    Args:
        operation: Name of the payment operation
        amount: Payment amount
        currency: Payment currency
        network: Blockchain network
    
    Returns:
        New span for the payment operation
    """
    tracer = get_tracer()
    span = tracer.start_span(f"payment.{operation}")
    span.set_attribute("payment.operation", operation)
    if amount:
        span.set_attribute("payment.amount", amount)
    if currency:
        span.set_attribute("payment.currency", currency)
    if network:
        span.set_attribute("payment.network", network)
    return span
