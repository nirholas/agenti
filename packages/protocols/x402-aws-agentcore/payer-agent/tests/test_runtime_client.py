"""Tests for the AgentCore Runtime client."""

import json
import pytest
from unittest.mock import MagicMock, patch


class TestRuntimeClientConfig:
    """Tests for Runtime client configuration."""

    def test_runtime_client_default_config(self):
        """Test Runtime client with default configuration."""
        from agent.runtime_client import RuntimeClient

        with patch("agent.runtime_client.boto3.client"):
            client = RuntimeClient(
                agent_runtime_arn="arn:aws:bedrock:us-west-2:123456789012:agent-runtime/test123",
            )
            
            assert client.config.agent_runtime_arn == "arn:aws:bedrock:us-west-2:123456789012:agent-runtime/test123"
            assert client.config.region == "us-west-2"
            assert client.config.max_retries == 3
            assert client.config.timeout_seconds == 300

    def test_runtime_client_custom_config(self):
        """Test Runtime client with custom configuration."""
        from agent.runtime_client import RuntimeClient

        with patch("agent.runtime_client.boto3.client"):
            client = RuntimeClient(
                agent_runtime_arn="arn:aws:bedrock:eu-west-1:123456789012:agent-runtime/custom123",
                region="eu-west-1",
                max_retries=5,
                timeout_seconds=600,
            )
            
            assert client.config.agent_runtime_arn == "arn:aws:bedrock:eu-west-1:123456789012:agent-runtime/custom123"
            assert client.config.region == "eu-west-1"
            assert client.config.max_retries == 5
            assert client.config.timeout_seconds == 600


class TestRuntimeClientInvoke:
    """Tests for Runtime client invocation."""

    def test_invoke_success_json_response(self):
        """Test successful agent invocation with JSON response."""
        from agent.runtime_client import RuntimeClient

        mock_bedrock_client = MagicMock()
        mock_bedrock_client.invoke_agent_runtime.return_value = {
            "contentType": "application/json",
            "response": [b'{"response": "Hello, I am the agent!"}'],
        }

        with patch("agent.runtime_client.boto3.client", return_value=mock_bedrock_client):
            client = RuntimeClient(
                agent_runtime_arn="arn:aws:bedrock:us-west-2:123456789012:agent-runtime/test123",
            )
            
            response = client.invoke("Hello agent")
            
            assert response.success is True
            assert "Hello, I am the agent!" in response.completion
            assert response.session_id is not None

    def test_invoke_validation_error(self):
        """Test handling of validation errors."""
        from agent.runtime_client import RuntimeClient

        mock_bedrock_client = MagicMock()
        mock_bedrock_client.exceptions.ValidationException = type(
            "ValidationException", (Exception,), {}
        )
        mock_bedrock_client.invoke_agent_runtime.side_effect = (
            mock_bedrock_client.exceptions.ValidationException("Invalid input")
        )

        with patch("agent.runtime_client.boto3.client", return_value=mock_bedrock_client):
            client = RuntimeClient(
                agent_runtime_arn="arn:aws:bedrock:us-west-2:123456789012:agent-runtime/test123",
            )
            
            response = client.invoke("Invalid request")
            
            assert response.success is False
            assert response.error_type == "ValidationException"
            assert "Validation error" in response.error

    def test_invoke_resource_not_found(self):
        """Test handling of resource not found errors."""
        from agent.runtime_client import RuntimeClient

        mock_bedrock_client = MagicMock()
        
        # Create proper exception classes that inherit from Exception
        class ResourceNotFoundException(Exception):
            pass
        
        mock_bedrock_client.exceptions.ValidationException = type("ValidationException", (Exception,), {})
        mock_bedrock_client.exceptions.ResourceNotFoundException = ResourceNotFoundException
        mock_bedrock_client.exceptions.ThrottlingException = type("ThrottlingException", (Exception,), {})
        mock_bedrock_client.exceptions.AccessDeniedException = type("AccessDeniedException", (Exception,), {})
        mock_bedrock_client.invoke_agent_runtime.side_effect = ResourceNotFoundException("Agent not found")

        with patch("agent.runtime_client.boto3.client", return_value=mock_bedrock_client):
            client = RuntimeClient(
                agent_runtime_arn="arn:aws:bedrock:us-west-2:123456789012:agent-runtime/nonexistent",
            )
            # Replace the client with our mock
            client._client = mock_bedrock_client
            
            response = client.invoke("Hello")
            
            assert response.success is False
            assert response.error_type == "ResourceNotFoundException"
            assert "not found" in response.error

    def test_invoke_throttling_error(self):
        """Test handling of throttling errors."""
        from agent.runtime_client import RuntimeClient

        mock_bedrock_client = MagicMock()
        
        # Create proper exception class
        class ThrottlingException(Exception):
            pass
        
        mock_bedrock_client.exceptions.ValidationException = type("ValidationException", (Exception,), {})
        mock_bedrock_client.exceptions.ResourceNotFoundException = type("ResourceNotFoundException", (Exception,), {})
        mock_bedrock_client.exceptions.ThrottlingException = ThrottlingException
        mock_bedrock_client.exceptions.AccessDeniedException = type("AccessDeniedException", (Exception,), {})
        mock_bedrock_client.invoke_agent_runtime.side_effect = ThrottlingException("Rate exceeded")

        with patch("agent.runtime_client.boto3.client", return_value=mock_bedrock_client):
            client = RuntimeClient(
                agent_runtime_arn="arn:aws:bedrock:us-west-2:123456789012:agent-runtime/test123",
            )
            client._client = mock_bedrock_client
            
            response = client.invoke("Hello")
            
            assert response.success is False
            assert response.error_type == "ThrottlingException"
            assert "Rate limited" in response.error

    def test_invoke_access_denied(self):
        """Test handling of access denied errors."""
        from agent.runtime_client import RuntimeClient

        mock_bedrock_client = MagicMock()
        
        # Create proper exception class
        class AccessDeniedException(Exception):
            pass
        
        mock_bedrock_client.exceptions.ValidationException = type("ValidationException", (Exception,), {})
        mock_bedrock_client.exceptions.ResourceNotFoundException = type("ResourceNotFoundException", (Exception,), {})
        mock_bedrock_client.exceptions.ThrottlingException = type("ThrottlingException", (Exception,), {})
        mock_bedrock_client.exceptions.AccessDeniedException = AccessDeniedException
        mock_bedrock_client.invoke_agent_runtime.side_effect = AccessDeniedException("Access denied")

        with patch("agent.runtime_client.boto3.client", return_value=mock_bedrock_client):
            client = RuntimeClient(
                agent_runtime_arn="arn:aws:bedrock:us-west-2:123456789012:agent-runtime/test123",
            )
            client._client = mock_bedrock_client
            
            response = client.invoke("Hello")
            
            assert response.success is False
            assert response.error_type == "AccessDeniedException"
            assert "InvokeAgentRuntime permission" in response.error


class TestRuntimeClientCredentials:
    """Tests for credential verification."""

    def test_verify_credentials_success(self):
        """Test successful credential verification."""
        from agent.runtime_client import RuntimeClient

        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "123456789012",
            "Arn": "arn:aws:iam::123456789012:user/test",
            "UserId": "AIDAEXAMPLE",
        }

        with patch("agent.runtime_client.boto3.client") as mock_client:
            # Return different clients for different services
            def client_factory(service, **kwargs):
                if service == "sts":
                    return mock_sts
                return MagicMock()
            
            mock_client.side_effect = client_factory
            
            client = RuntimeClient(
                agent_runtime_arn="arn:aws:bedrock:us-west-2:123456789012:agent-runtime/test123",
            )
            
            # Reset the side_effect for the verify call
            with patch("agent.runtime_client.boto3.client", return_value=mock_sts):
                is_valid = client.verify_credentials()
                assert is_valid is True

    def test_get_caller_identity(self):
        """Test getting caller identity."""
        from agent.runtime_client import RuntimeClient

        mock_sts = MagicMock()
        mock_sts.get_caller_identity.return_value = {
            "Account": "123456789012",
            "Arn": "arn:aws:iam::123456789012:user/test",
            "UserId": "AIDAEXAMPLE",
        }

        with patch("agent.runtime_client.boto3.client"):
            client = RuntimeClient(
                agent_runtime_arn="arn:aws:bedrock:us-west-2:123456789012:agent-runtime/test123",
            )
            
            with patch("agent.runtime_client.boto3.client", return_value=mock_sts):
                identity = client.get_caller_identity()
                
                assert identity is not None
                assert identity["Account"] == "123456789012"


class TestCreateRuntimeClient:
    """Tests for create_runtime_client factory function."""

    def test_create_runtime_client_factory(self):
        """Test the factory function creates a client correctly."""
        from agent.runtime_client import create_runtime_client

        with patch("agent.runtime_client.boto3.client"):
            client = create_runtime_client(
                agent_runtime_arn="arn:aws:bedrock:eu-west-1:123456789012:agent-runtime/factory123",
                region="eu-west-1",
            )
            
            assert client.config.agent_runtime_arn == "arn:aws:bedrock:eu-west-1:123456789012:agent-runtime/factory123"
            assert client.config.region == "eu-west-1"
