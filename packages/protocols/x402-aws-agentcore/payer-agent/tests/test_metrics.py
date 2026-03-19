"""Tests for the custom metrics module."""

import json
import sys
from io import StringIO
from unittest.mock import patch

import pytest

from agent.metrics import (
    MetricsEmitter,
    MetricDimensions,
    MetricUnit,
    PayerMetricName,
    get_metrics_emitter,
    init_metrics,
)


class TestMetricDimensions:
    """Tests for MetricDimensions dataclass."""

    def test_default_dimensions(self):
        """Test default dimension values."""
        dims = MetricDimensions()
        result = dims.to_dict()
        
        assert "Environment" in result
        assert result["Environment"] in ["development", "production", "test"]

    def test_custom_dimensions(self):
        """Test custom dimension values."""
        dims = MetricDimensions(
            environment="production",
            network="base-sepolia",
            currency="ETH",
        )
        result = dims.to_dict()
        
        assert result["Environment"] == "production"
        assert result["Network"] == "base-sepolia"
        assert result["Currency"] == "ETH"

    def test_none_dimensions_excluded(self):
        """Test that None dimensions are excluded from output."""
        dims = MetricDimensions(
            environment="test",
            network=None,
            currency="ETH",
        )
        result = dims.to_dict()
        
        assert "Network" not in result
        assert "Currency" in result


class TestMetricsEmitter:
    """Tests for MetricsEmitter class."""

    def test_emit_single_metric(self, capsys):
        """Test emitting a single metric."""
        emitter = MetricsEmitter(service_name="test-service")
        
        emitter.emit(
            PayerMetricName.PAYMENT_ANALYSIS_COUNT,
            1,
            MetricUnit.COUNT,
        )
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert "_aws" in output
        assert output["_aws"]["CloudWatchMetrics"][0]["Namespace"] == "X402PayerAgent"
        assert output["PaymentAnalysisCount"] == 1
        assert output["service"] == "test-service"

    def test_emit_multiple_metrics(self, capsys):
        """Test emitting multiple metrics at once."""
        emitter = MetricsEmitter()
        
        emitter.emit_multiple({
            PayerMetricName.PAYMENT_ANALYSIS_COUNT: (1, MetricUnit.COUNT),
            PayerMetricName.PAYMENT_ANALYSIS_LATENCY: (150.5, MetricUnit.MILLISECONDS),
        })
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert output["PaymentAnalysisCount"] == 1
        assert output["PaymentAnalysisLatency"] == 150.5
        
        # Check metric definitions
        metrics = output["_aws"]["CloudWatchMetrics"][0]["Metrics"]
        metric_names = [m["Name"] for m in metrics]
        assert "PaymentAnalysisCount" in metric_names
        assert "PaymentAnalysisLatency" in metric_names

    def test_record_payment_analysis_approved(self, capsys):
        """Test recording an approved payment analysis."""
        emitter = MetricsEmitter()
        
        emitter.record_payment_analysis(
            approved=True,
            latency_ms=100.0,
            amount="0.001",
            currency="ETH",
        )
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert output["PaymentAnalysisCount"] == 1
        assert output["PaymentApproved"] == 1
        assert "PaymentRejected" not in output
        assert output["PaymentAnalysisLatency"] == 100.0

    def test_record_payment_analysis_rejected(self, capsys):
        """Test recording a rejected payment analysis."""
        emitter = MetricsEmitter()
        
        emitter.record_payment_analysis(
            approved=False,
            latency_ms=50.0,
            amount="1.0",
            currency="ETH",
            rejection_reason="amount_too_high",
        )
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert output["PaymentAnalysisCount"] == 1
        assert output["PaymentRejected"] == 1
        assert "PaymentApproved" not in output
        assert output["rejectionReason"] == "amount_too_high"

    def test_record_payment_signing_success(self, capsys):
        """Test recording a successful payment signing."""
        emitter = MetricsEmitter()
        
        emitter.record_payment_signing(
            success=True,
            latency_ms=200.0,
            network="base-sepolia",
            amount="0.001",
        )
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert output["PaymentSigningCount"] == 1
        assert output["PaymentSigningSuccess"] == 1
        assert output["PaymentAmountETH"] == 0.001

    def test_record_payment_signing_failure(self, capsys):
        """Test recording a failed payment signing."""
        emitter = MetricsEmitter()
        
        emitter.record_payment_signing(
            success=False,
            latency_ms=50.0,
            network="base-sepolia",
            error="Wallet not initialized",
        )
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert output["PaymentSigningCount"] == 1
        assert output["PaymentSigningFailure"] == 1
        assert output["error"] == "Wallet not initialized"

    def test_record_content_request_success(self, capsys):
        """Test recording a successful content request."""
        emitter = MetricsEmitter()
        
        emitter.record_content_request(
            status_code=200,
            latency_ms=300.0,
            content_path="/api/premium-article",
        )
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert output["ContentRequestCount"] == 1
        assert output["ContentRequestSuccess"] == 1
        assert output["ContentRequestLatency"] == 300.0

    def test_record_content_request_402(self, capsys):
        """Test recording a 402 content request."""
        emitter = MetricsEmitter()
        
        emitter.record_content_request(
            status_code=402,
            latency_ms=100.0,
            content_path="/api/premium-article",
            payment_required=True,
        )
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert output["ContentRequestCount"] == 1
        assert output["ContentRequest402"] == 1

    def test_record_wallet_balance(self, capsys):
        """Test recording wallet balance."""
        emitter = MetricsEmitter()
        
        emitter.record_wallet_balance(
            balance_eth=0.5,
            network="base-sepolia",
            address="0x1234567890abcdef1234567890abcdef12345678",
        )
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert output["WalletBalanceCheck"] == 1
        assert output["WalletBalanceETH"] == 0.5
        assert output["network"] == "base-sepolia"

    def test_record_faucet_request_success(self, capsys):
        """Test recording a successful faucet request."""
        emitter = MetricsEmitter()
        
        emitter.record_faucet_request(
            success=True,
            network="base-sepolia",
            asset="eth",
        )
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert output["FaucetRequestCount"] == 1
        assert output["FaucetRequestSuccess"] == 1

    def test_record_error(self, capsys):
        """Test recording an error."""
        emitter = MetricsEmitter()
        
        emitter.record_error(
            error_type="wallet_error",
            error_message="Failed to connect to wallet provider",
            operation="get_balance",
        )
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        assert output["AgentErrorCount"] == 1
        assert output["errorType"] == "wallet_error"
        assert output["operation"] == "get_balance"


class TestGlobalMetricsEmitter:
    """Tests for global metrics emitter functions."""

    def test_get_metrics_emitter_singleton(self):
        """Test that get_metrics_emitter returns a singleton."""
        emitter1 = get_metrics_emitter()
        emitter2 = get_metrics_emitter()
        
        assert emitter1 is emitter2

    def test_init_metrics_creates_new_emitter(self):
        """Test that init_metrics creates a new emitter."""
        emitter1 = get_metrics_emitter()
        emitter2 = init_metrics("new-service")
        
        assert emitter2.service_name == "new-service"


class TestEMFFormat:
    """Tests for EMF format compliance."""

    def test_emf_timestamp_format(self, capsys):
        """Test that EMF timestamp is in milliseconds."""
        emitter = MetricsEmitter()
        
        emitter.emit(PayerMetricName.PAYMENT_ANALYSIS_COUNT, 1)
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        timestamp = output["_aws"]["Timestamp"]
        # Timestamp should be in milliseconds (13+ digits)
        assert timestamp > 1000000000000

    def test_emf_metric_units(self, capsys):
        """Test that EMF metric units are correct."""
        emitter = MetricsEmitter()
        
        emitter.emit_multiple({
            PayerMetricName.PAYMENT_ANALYSIS_COUNT: (1, MetricUnit.COUNT),
            PayerMetricName.PAYMENT_ANALYSIS_LATENCY: (100, MetricUnit.MILLISECONDS),
        })
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        metrics = output["_aws"]["CloudWatchMetrics"][0]["Metrics"]
        
        count_metric = next(m for m in metrics if m["Name"] == "PaymentAnalysisCount")
        latency_metric = next(m for m in metrics if m["Name"] == "PaymentAnalysisLatency")
        
        assert count_metric["Unit"] == "Count"
        assert latency_metric["Unit"] == "Milliseconds"

    def test_emf_namespace(self, capsys):
        """Test that EMF namespace is correct."""
        emitter = MetricsEmitter()
        
        emitter.emit(PayerMetricName.PAYMENT_ANALYSIS_COUNT, 1)
        
        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        
        namespace = output["_aws"]["CloudWatchMetrics"][0]["Namespace"]
        assert namespace == "X402PayerAgent"
