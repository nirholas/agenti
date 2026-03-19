"""Tests for the payment tools module."""

from agent.tools.payment import analyze_payment


class TestAnalyzePayment:
    """Tests for the analyze_payment function."""

    def test_approve_valid_payment(self):
        """Test that a valid payment within budget is approved."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="0x1234567890123456789012345678901234567890",
            description="Premium article access",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is True
        assert result["risk_level"] == "low"
        assert "reasonable" in result["reasoning"].lower()

    def test_reject_insufficient_balance(self):
        """Test that payment is rejected when balance is insufficient."""
        result = analyze_payment(
            amount="0.1",
            currency="ETH",
            recipient="0x1234567890123456789012345678901234567890",
            description="Premium content",
            wallet_balance="0.05",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"
        assert "insufficient" in result["reasoning"].lower()

    def test_reject_amount_exceeds_threshold(self):
        """Test that payment is rejected when amount exceeds demo threshold."""
        result = analyze_payment(
            amount="0.02",
            currency="ETH",
            recipient="0x1234567890123456789012345678901234567890",
            description="Expensive content",
            wallet_balance="1.0",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "medium"
        assert "exceeds" in result["reasoning"].lower()

    def test_reject_invalid_recipient_address_format(self):
        """Test that payment is rejected for invalid recipient address."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="invalid-address",
            description="Content",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"
        assert "invalid" in result["reasoning"].lower()

    def test_reject_recipient_wrong_length(self):
        """Test that payment is rejected when recipient address has wrong length."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="0x1234",  # Too short
            description="Content",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"

    def test_reject_invalid_amount_format(self):
        """Test that payment is rejected for invalid amount format."""
        result = analyze_payment(
            amount="not-a-number",
            currency="ETH",
            recipient="0x1234567890123456789012345678901234567890",
            description="Content",
            wallet_balance="0.1",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"
        assert "invalid" in result["reasoning"].lower()

    def test_reject_invalid_balance_format(self):
        """Test that payment is rejected for invalid balance format."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="0x1234567890123456789012345678901234567890",
            description="Content",
            wallet_balance="invalid",
        )
        
        assert result["should_pay"] is False
        assert result["risk_level"] == "high"

    def test_exact_balance_equals_amount(self):
        """Test payment when balance exactly equals amount."""
        result = analyze_payment(
            amount="0.001",
            currency="ETH",
            recipient="0x1234567890123456789012345678901234567890",
            description="Content",
            wallet_balance="0.001",
        )
        
        # Should be approved since balance >= amount
        assert result["should_pay"] is True

    def test_boundary_amount_at_threshold(self):
        """Test payment at exactly the threshold amount."""
        result = analyze_payment(
            amount="0.01",
            currency="ETH",
            recipient="0x1234567890123456789012345678901234567890",
            description="Content",
            wallet_balance="1.0",
        )
        
        # 0.01 is exactly at threshold, should be rejected (> 0.01 check)
        assert result["should_pay"] is True

    def test_zero_amount(self):
        """Test payment with zero amount."""
        result = analyze_payment(
            amount="0",
            currency="ETH",
            recipient="0x1234567890123456789012345678901234567890",
            description="Free content",
            wallet_balance="0.1",
        )
        
        # Zero amount should be approved
        assert result["should_pay"] is True


from agent.tools.payment import (
    SUPPORTED_FAUCET_NETWORKS,
    SUPPORTED_FAUCET_ASSETS,
)


class TestFaucetConstants:
    """Tests for faucet-related constants and validation logic."""

    def test_supported_faucet_networks_contains_base_sepolia(self):
        """Test that base-sepolia is in supported faucet networks."""
        assert "base-sepolia" in SUPPORTED_FAUCET_NETWORKS

    def test_supported_faucet_networks_contains_ethereum_sepolia(self):
        """Test that ethereum-sepolia is in supported faucet networks."""
        assert "ethereum-sepolia" in SUPPORTED_FAUCET_NETWORKS

    def test_supported_faucet_networks_excludes_mainnet(self):
        """Test that mainnet networks are not in supported faucet networks."""
        assert "base-mainnet" not in SUPPORTED_FAUCET_NETWORKS
        assert "ethereum-mainnet" not in SUPPORTED_FAUCET_NETWORKS

    def test_base_sepolia_supports_eth(self):
        """Test that base-sepolia supports ETH faucet."""
        assert "eth" in SUPPORTED_FAUCET_ASSETS["base-sepolia"]

    def test_base_sepolia_supports_usdc(self):
        """Test that base-sepolia supports USDC faucet."""
        assert "usdc" in SUPPORTED_FAUCET_ASSETS["base-sepolia"]

    def test_base_sepolia_supports_eurc(self):
        """Test that base-sepolia supports EURC faucet."""
        assert "eurc" in SUPPORTED_FAUCET_ASSETS["base-sepolia"]

    def test_base_sepolia_supports_cbbtc(self):
        """Test that base-sepolia supports cbBTC faucet."""
        assert "cbbtc" in SUPPORTED_FAUCET_ASSETS["base-sepolia"]

    def test_ethereum_sepolia_supports_eth(self):
        """Test that ethereum-sepolia supports ETH faucet."""
        assert "eth" in SUPPORTED_FAUCET_ASSETS["ethereum-sepolia"]

    def test_all_supported_networks_have_assets(self):
        """Test that all supported networks have defined assets."""
        for network in SUPPORTED_FAUCET_NETWORKS:
            assert network in SUPPORTED_FAUCET_ASSETS
            assert len(SUPPORTED_FAUCET_ASSETS[network]) > 0
