"""
AgentCore Runtime Client.

This module provides a client for invoking agents deployed to AgentCore Runtime
using the correct bedrock-agentcore service and invoke_agent_runtime API.

Usage:
    from agent.runtime_client import RuntimeClient
    
    # Create client
    client = RuntimeClient(
        agent_runtime_arn="arn:aws:bedrock:us-west-2:123456789012:agent-runtime/abc123",
        region="us-west-2"
    )
    
    # Invoke agent
    response = client.invoke("Check my wallet balance")
    print(response.completion)
    
    # With session for multi-turn
    response = client.invoke("Get premium content", session_id="my-session")
"""

import json
import uuid
from dataclasses import dataclass, field
from typing import Iterator, Optional

import boto3
from botocore.config import Config


@dataclass
class InvocationResponse:
    """Response from an agent invocation."""
    success: bool
    completion: str = ""
    session_id: str = ""
    content_type: str = ""
    error: Optional[str] = None
    error_type: Optional[str] = None


@dataclass
class RuntimeClientConfig:
    """Configuration for the Runtime client."""
    agent_runtime_arn: str
    region: str = "us-west-2"
    profile_name: Optional[str] = None
    max_retries: int = 3
    timeout_seconds: int = 300


class RuntimeClient:
    """
    Client for invoking AgentCore Runtime agents.
    
    Uses the bedrock-agentcore service with invoke_agent_runtime API.
    
    Attributes:
        config: Runtime client configuration
    """
    
    def __init__(
        self,
        agent_runtime_arn: str,
        region: str = "us-west-2",
        profile_name: Optional[str] = None,
        max_retries: int = 3,
        timeout_seconds: int = 300,
    ):
        """
        Initialize the Runtime client.
        
        Args:
            agent_runtime_arn: The AgentCore Runtime ARN
            region: AWS region
            profile_name: Optional AWS profile name
            max_retries: Maximum retry attempts
            timeout_seconds: Request timeout
        """
        self.config = RuntimeClientConfig(
            agent_runtime_arn=agent_runtime_arn,
            region=region,
            profile_name=profile_name,
            max_retries=max_retries,
            timeout_seconds=timeout_seconds,
        )
        
        # Create boto3 client for bedrock-agentcore
        boto_config = Config(
            region_name=region,
            retries={
                "max_attempts": max_retries,
                "mode": "adaptive",
            },
            read_timeout=timeout_seconds,
            connect_timeout=30,
        )
        
        if profile_name:
            session = boto3.Session(profile_name=profile_name)
            self._client = session.client("bedrock-agentcore", config=boto_config)
        else:
            self._client = boto3.client("bedrock-agentcore", config=boto_config)
    
    def invoke(
        self,
        prompt: str,
        session_id: Optional[str] = None,
    ) -> InvocationResponse:
        """
        Invoke the agent with the given prompt.
        
        Args:
            prompt: The user's input message
            session_id: Optional session ID for conversation context
            
        Returns:
            InvocationResponse with the agent's response
        """
        session_id = session_id or str(uuid.uuid4())
        
        # Prepare payload as JSON
        payload = json.dumps({"prompt": prompt}).encode()
        
        try:
            response = self._client.invoke_agent_runtime(
                agentRuntimeArn=self.config.agent_runtime_arn,
                runtimeSessionId=session_id,
                payload=payload,
            )
            
            content_type = response.get("contentType", "")
            
            # Process response based on content type
            if "text/event-stream" in content_type:
                # Handle streaming response
                completion = self._process_streaming_response(response)
            elif content_type == "application/json":
                # Handle JSON response
                completion = self._process_json_response(response)
            else:
                # Handle raw response
                completion = self._process_raw_response(response)
            
            return InvocationResponse(
                success=True,
                completion=completion,
                session_id=session_id,
                content_type=content_type,
            )
            
        except self._client.exceptions.ValidationException as e:
            return InvocationResponse(
                success=False,
                session_id=session_id,
                error=f"Validation error: {str(e)}",
                error_type="ValidationException",
            )
        except self._client.exceptions.ResourceNotFoundException as e:
            return InvocationResponse(
                success=False,
                session_id=session_id,
                error=f"Agent runtime not found: {str(e)}",
                error_type="ResourceNotFoundException",
            )
        except self._client.exceptions.ThrottlingException as e:
            return InvocationResponse(
                success=False,
                session_id=session_id,
                error=f"Rate limited: {str(e)}",
                error_type="ThrottlingException",
            )
        except self._client.exceptions.AccessDeniedException as e:
            return InvocationResponse(
                success=False,
                session_id=session_id,
                error=f"Access denied - need bedrock-agentcore:InvokeAgentRuntime permission: {str(e)}",
                error_type="AccessDeniedException",
            )
        except Exception as e:
            return InvocationResponse(
                success=False,
                session_id=session_id,
                error=str(e),
                error_type=type(e).__name__,
            )
    
    def _process_streaming_response(self, response: dict) -> str:
        """Process a streaming (text/event-stream) response."""
        content = []
        for line in response["response"].iter_lines(chunk_size=10):
            if line:
                line = line.decode("utf-8")
                if line.startswith("data: "):
                    content.append(line[6:])
        return "\n".join(content)
    
    def _process_json_response(self, response: dict) -> str:
        """Process a JSON response."""
        content = []
        for chunk in response.get("response", []):
            content.append(chunk.decode("utf-8"))
        try:
            data = json.loads("".join(content))
            # If it's a dict with a 'response' or 'completion' key, extract it
            if isinstance(data, dict):
                return data.get("response", data.get("completion", json.dumps(data)))
            return json.dumps(data)
        except json.JSONDecodeError:
            return "".join(content)
    
    def _process_raw_response(self, response: dict) -> str:
        """Process a raw response."""
        if "response" in response:
            return str(response["response"])
        return str(response)
    
    def invoke_streaming(
        self,
        prompt: str,
        session_id: Optional[str] = None,
    ) -> Iterator[str]:
        """
        Invoke the agent and yield response chunks as they arrive.
        
        Args:
            prompt: The user's input message
            session_id: Optional session ID for conversation context
            
        Yields:
            Response text chunks as they arrive
        """
        session_id = session_id or str(uuid.uuid4())
        payload = json.dumps({"prompt": prompt}).encode()
        
        response = self._client.invoke_agent_runtime(
            agentRuntimeArn=self.config.agent_runtime_arn,
            runtimeSessionId=session_id,
            payload=payload,
        )
        
        content_type = response.get("contentType", "")
        
        if "text/event-stream" in content_type:
            for line in response["response"].iter_lines(chunk_size=10):
                if line:
                    line = line.decode("utf-8")
                    if line.startswith("data: "):
                        yield line[6:]
        else:
            # For non-streaming, yield the whole response
            for chunk in response.get("response", []):
                yield chunk.decode("utf-8")
    
    def verify_credentials(self) -> bool:
        """
        Verify that AWS credentials are valid.
        
        Returns:
            True if credentials are valid, False otherwise
        """
        try:
            sts = boto3.client("sts")
            sts.get_caller_identity()
            return True
        except Exception:
            return False
    
    def get_caller_identity(self) -> Optional[dict]:
        """
        Get the AWS caller identity for debugging.
        
        Returns:
            Dictionary with Account, Arn, and UserId, or None if failed
        """
        try:
            sts = boto3.client("sts")
            return sts.get_caller_identity()
        except Exception:
            return None


def create_runtime_client(
    agent_runtime_arn: str,
    region: str = "us-west-2",
    **kwargs,
) -> RuntimeClient:
    """
    Factory function to create a Runtime client.
    
    Args:
        agent_runtime_arn: The AgentCore Runtime ARN
        region: AWS region
        **kwargs: Additional configuration options
        
    Returns:
        Configured RuntimeClient instance
    """
    return RuntimeClient(
        agent_runtime_arn=agent_runtime_arn,
        region=region,
        **kwargs,
    )
