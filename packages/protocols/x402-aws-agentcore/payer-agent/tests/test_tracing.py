"""Tests for the OpenTelemetry tracing module."""

import pytest
from unittest.mock import patch, MagicMock
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from agent.tracing import (
    init_tracing,
    get_tracer,
    traced,
    add_payment_span_attributes,
    create_payment_span,
)


class TestTracingInitialization:
    """Tests for tracing initialization."""

    def test_init_tracing_returns_tracer(self):
        """Test that init_tracing returns a tracer instance."""
        # Reset global state for clean test
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        
        tracer = init_tracing(service_name="test-service")
        assert tracer is not None
        assert isinstance(tracer, trace.Tracer)

    def test_init_tracing_is_idempotent(self):
        """Test that calling init_tracing multiple times returns same tracer."""
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        
        tracer1 = init_tracing(service_name="test-service")
        tracer2 = init_tracing(service_name="test-service")
        assert tracer1 is tracer2

    def test_get_tracer_initializes_if_needed(self):
        """Test that get_tracer initializes tracing if not already done."""
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        
        tracer = get_tracer()
        assert tracer is not None


class TestTracedDecorator:
    """Tests for the @traced decorator."""

    def test_traced_sync_function(self):
        """Test tracing a synchronous function."""
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        init_tracing(service_name="test-service")
        
        @traced(name="test_operation")
        def sample_function(x: int) -> int:
            return x * 2
        
        result = sample_function(5)
        assert result == 10

    def test_traced_sync_function_with_exception(self):
        """Test that traced decorator records exceptions."""
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        init_tracing(service_name="test-service")
        
        @traced(name="failing_operation")
        def failing_function():
            raise ValueError("Test error")
        
        with pytest.raises(ValueError, match="Test error"):
            failing_function()

    @pytest.mark.asyncio
    async def test_traced_async_function(self):
        """Test tracing an asynchronous function."""
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        init_tracing(service_name="test-service")
        
        @traced(name="async_operation")
        async def async_sample_function(x: int) -> int:
            return x * 3
        
        result = await async_sample_function(4)
        assert result == 12

    def test_traced_with_attributes(self):
        """Test traced decorator with custom attributes."""
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        init_tracing(service_name="test-service")
        
        @traced(name="attributed_operation", attributes={"custom.key": "custom_value"})
        def attributed_function() -> str:
            return "success"
        
        result = attributed_function()
        assert result == "success"


class TestPaymentSpanHelpers:
    """Tests for payment-specific span helpers."""

    def test_add_payment_span_attributes(self):
        """Test adding payment attributes to a span."""
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        init_tracing(service_name="test-service")
        
        tracer = get_tracer()
        with tracer.start_as_current_span("test_span") as span:
            add_payment_span_attributes(
                span,
                amount="0.001",
                currency="ETH",
                network="base-sepolia",
                recipient="0x1234567890123456789012345678901234567890",
                status="approved",
            )
            # Span attributes are set - we just verify no exceptions

    def test_add_payment_span_attributes_partial(self):
        """Test adding partial payment attributes."""
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        init_tracing(service_name="test-service")
        
        tracer = get_tracer()
        with tracer.start_as_current_span("test_span") as span:
            add_payment_span_attributes(
                span,
                amount="0.001",
                currency="ETH",
            )
            # Should not raise with partial attributes

    def test_create_payment_span(self):
        """Test creating a payment span."""
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        init_tracing(service_name="test-service")
        
        span = create_payment_span(
            operation="verify",
            amount="0.001",
            currency="ETH",
            network="base-sepolia",
        )
        assert span is not None
        span.end()


class TestTracingWithConsoleExport:
    """Tests for tracing with console export enabled."""

    def test_init_with_console_export(self):
        """Test initialization with console export enabled."""
        import agent.tracing as tracing_module
        tracing_module._tracer = None
        tracing_module._initialized = False
        
        tracer = init_tracing(
            service_name="test-service",
            enable_console_export=True,
        )
        assert tracer is not None
