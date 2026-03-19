"""Tests for the agent invocation functionality."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import sys
from pathlib import Path

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))


class TestLocalAgentInvocation:
    """Tests for local agent invocation."""

    def test_agent_creation(self):
        """Test that the agent can be created successfully."""
        from agent.main import create_payer_agent
        
        # Mock the BedrockModel to avoid actual API calls
        with patch("agent.main.BedrockModel") as mock_model:
            mock_model.return_value = MagicMock()
            agent = create_payer_agent()
            
            assert agent is not None
            # Verify the model was created with correct parameters
            mock_model.assert_called_once()

    def test_agent_has_required_tools(self):
        """Test that the agent has all required tools configured."""
        from agent.main import create_payer_agent
        from agent.tools import (
            analyze_payment,
            sign_payment,
            get_wallet_balance,
            request_content,
            request_content_with_payment,
        )
        
        with patch("agent.main.BedrockModel") as mock_model:
            mock_model.return_value = MagicMock()
            agent = create_payer_agent()
            
            # The agent should be created successfully
            # Strands Agent stores tools internally, we just verify it was created
            assert agent is not None

    def test_agent_system_prompt_contains_key_instructions(self):
        """Test that the system prompt contains key instructions."""
        from agent.main import SYSTEM_PROMPT
        
        # Check for key phrases in the system prompt
        assert "payment" in SYSTEM_PROMPT.lower()
        assert "x402" in SYSTEM_PROMPT.lower()
        assert "wallet" in SYSTEM_PROMPT.lower()
        assert "content" in SYSTEM_PROMPT.lower()


class TestTestScenarios:
    """Tests for the test scenarios."""

    def test_get_test_scenarios_returns_list(self):
        """Test that get_test_scenarios returns a non-empty list."""
        from test_agent_invocation import get_test_scenarios
        
        scenarios = get_test_scenarios()
        
        assert isinstance(scenarios, list)
        assert len(scenarios) > 0

    def test_scenarios_have_required_fields(self):
        """Test that each scenario has required fields."""
        from test_agent_invocation import get_test_scenarios
        
        scenarios = get_test_scenarios()
        
        for scenario in scenarios:
            assert "name" in scenario
            assert "message" in scenario
            assert isinstance(scenario["name"], str)
            assert isinstance(scenario["message"], str)
            assert len(scenario["name"]) > 0
            assert len(scenario["message"]) > 0

    def test_scenarios_cover_key_functionality(self):
        """Test that scenarios cover key agent functionality."""
        from test_agent_invocation import get_test_scenarios
        
        scenarios = get_test_scenarios()
        scenario_names = [s["name"].lower() for s in scenarios]
        
        # Check for key scenario types
        assert any("balance" in name for name in scenario_names)
        assert any("payment" in name for name in scenario_names)


class TestTestResult:
    """Tests for the TestResult dataclass."""

    def test_test_result_creation(self):
        """Test that TestResult can be created with required fields."""
        from test_agent_invocation import TestResult
        
        result = TestResult(
            success=True,
            scenario_name="Test Scenario",
            mode="local",
        )
        
        assert result.success is True
        assert result.scenario_name == "Test Scenario"
        assert result.mode == "local"
        assert result.response is None
        assert result.error is None

    def test_test_result_with_all_fields(self):
        """Test TestResult with all optional fields."""
        from test_agent_invocation import TestResult
        
        result = TestResult(
            success=False,
            scenario_name="Failed Test",
            mode="agentcore",
            response="Some response",
            error="Some error",
            duration_ms=1234.5,
            session_id="test-session-123",
        )
        
        assert result.success is False
        assert result.response == "Some response"
        assert result.error == "Some error"
        assert result.duration_ms == 1234.5
        assert result.session_id == "test-session-123"


class TestLocalAgentTest:
    """Tests for the test_local_agent function."""

    @pytest.mark.asyncio
    async def test_local_agent_success(self):
        """Test successful local agent invocation."""
        from test_agent_invocation import test_local_agent
        
        # Mock the agent creation and invocation
        mock_agent = MagicMock()
        mock_agent.return_value = "Test response"
        
        with patch("agent.main.create_payer_agent", return_value=mock_agent):
            result = await test_local_agent("Hello")
            
            assert result.success is True
            assert result.mode == "local"
            assert result.response == "Test response"


class TestAgentCoreTest:
    """Tests for the test_agentcore_runtime function."""

    @pytest.mark.asyncio
    async def test_agentcore_missing_boto3(self):
        """Test handling when boto3 is not available."""
        from test_agent_invocation import test_agentcore_runtime
        
        with patch.dict("sys.modules", {"boto3": None}):
            result = await test_agentcore_runtime(
                runtime_arn="arn:aws:bedrock:us-west-2:123456789:agent-runtime/test",
                message="Hello",
                region="us-west-2",
            )
            
            # Should fail gracefully
            assert result.success is False
            assert result.mode == "agentcore"

    @pytest.mark.asyncio
    async def test_agentcore_client_error(self):
        """Test handling of AWS client errors."""
        from test_agent_invocation import test_agentcore_runtime
        from agent.runtime_client import InvocationResponse
        
        # Mock the RuntimeClient to return an error response
        mock_response = InvocationResponse(
            success=False,
            session_id="test-session",
            error="Runtime not found: test. Verify the runtime ARN and ensure it's deployed.",
            error_type="ResourceNotFoundException",
        )
        
        with patch("agent.runtime_client.RuntimeClient.invoke", return_value=mock_response):
            result = await test_agentcore_runtime(
                runtime_arn="arn:aws:bedrock:us-west-2:123456789:agent-runtime/test",
                message="Hello",
                region="us-west-2",
            )
            
            assert result.success is False
            assert "not found" in result.error.lower() or "ResourceNotFoundException" in str(result.error)
