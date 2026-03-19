"""
API server for the x402 payer agent.

Supports two modes:
1. Local mode (default): Runs the agent locally using Strands SDK + Bedrock
2. AgentCore mode: Invokes a deployed AgentCore Runtime

Usage:
    # Local mode (default)
    python -m agent.api_server
    
    # AgentCore mode (set AGENT_RUNTIME_ARN)
    AGENT_RUNTIME_ARN=arn:aws:... python -m agent.api_server
"""

import json
import os
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(
    title="x402 Payer Agent API",
    description="API for invoking the x402 payer agent",
    version="1.0.0",
)

# CORS configuration for web UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-loaded components
_agent = None
_runtime_client = None
_imports_done = False


def _ensure_imports():
    """Lazy import to avoid nest_asyncio conflicts on Python 3.13."""
    global _imports_done
    if not _imports_done:
        global config, create_payer_agent, RuntimeClient, create_runtime_client
        from .config import config as _config
        from .main import create_payer_agent as _create_payer_agent
        from .runtime_client import RuntimeClient as _RuntimeClient
        from .runtime_client import create_runtime_client as _create_runtime_client
        config = _config
        create_payer_agent = _create_payer_agent
        RuntimeClient = _RuntimeClient
        create_runtime_client = _create_runtime_client
        _imports_done = True


def _use_local_mode() -> bool:
    """Check if we should use local mode (no AgentCore)."""
    _ensure_imports()
    return not config.agent_runtime_arn


def _get_local_agent():
    """Get or create the local Strands agent."""
    global _agent
    if _agent is None:
        _ensure_imports()
        _agent = create_payer_agent()
    return _agent


def _get_runtime_client():
    """Get or create the AgentCore runtime client."""
    global _runtime_client
    if _runtime_client is None:
        _ensure_imports()
        if not config.agent_runtime_arn:
            raise HTTPException(500, "AGENT_RUNTIME_ARN not set")
        _runtime_client = create_runtime_client(
            agent_runtime_arn=config.agent_runtime_arn,
            region=config.aws_region,
        )
    return _runtime_client


class InvokeRequest(BaseModel):
    prompt: Optional[str] = None
    message: Optional[str] = None  # Alternative field name for AgentCore
    session_id: Optional[str] = None
    
    @property
    def text(self) -> str:
        """Get the prompt text from either field."""
        return self.prompt or self.message or ""


class InvokeResponse(BaseModel):
    success: bool
    completion: str
    session_id: str
    error: Optional[str] = None


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/wallet")
async def get_wallet():
    """Get agent wallet info for the Web UI."""
    try:
        from .tools.payment import get_wallet_balance
        result = get_wallet_balance()
        if not result.get("success"):
            raise HTTPException(500, result.get("error", "Failed to get wallet"))
        return {
            "address": result["address"],
            "balance": result.get("usdc_balance", "0"),
            "network": result.get("network", "base-sepolia"),
            "currency": "USDC",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/ping")
async def ping():
    """AgentCore health check endpoint."""
    import time
    return {
        "status": "Healthy",
        "time_of_last_update": int(time.time())
    }


@app.post("/test")
async def test_endpoint(request: InvokeRequest):
    """Simple test endpoint that doesn't use the agent."""
    return {
        "response": f"Echo: {request.text}",
        "status": "success",
        "session_id": "test-session",
    }


@app.post("/invocations")
async def invocations(request: InvokeRequest):
    """AgentCore invocation endpoint - primary agent interaction."""
    import logging
    import traceback
    import sys
    
    logger = logging.getLogger(__name__)
    logger.info(f"Received invocation request: {request}")
    
    session_id = request.session_id or str(uuid.uuid4())
    prompt_text = request.text
    
    if not prompt_text:
        logger.error("No prompt or message provided")
        raise HTTPException(400, "Either 'prompt' or 'message' field is required")
    
    try:
        if _use_local_mode():
            # Local mode: use Strands agent directly
            agent = _get_local_agent()
            response = agent(prompt_text)
            return {
                "response": str(response),
                "status": "success",
                "session_id": session_id,
            }
        else:
            # AgentCore mode: invoke runtime
            client = _get_runtime_client()
            response = client.invoke(
                prompt=prompt_text,
                session_id=session_id,
            )
            if not response.success:
                raise HTTPException(500, response.error or "Agent invocation failed")
            return {
                "response": response.completion,
                "status": "success",
                "session_id": response.session_id,
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in invocations: {e}", exc_info=True)
        # Return error as response for AgentCore compatibility
        # AgentCore expects a valid JSON response, not an HTTP error
        return {
            "response": f"Error: {str(e)}",
            "status": "error",
            "session_id": session_id,
        }


@app.post("/invoke", response_model=InvokeResponse)
async def invoke_agent(request: InvokeRequest):
    """Invoke the agent with the given prompt."""
    session_id = request.session_id or str(uuid.uuid4())
    prompt_text = request.text
    
    if not prompt_text:
        raise HTTPException(400, "Either 'prompt' or 'message' field is required")
    
    try:
        if _use_local_mode():
            # Local mode: use Strands agent directly
            agent = _get_local_agent()
            response = agent(prompt_text)
            return InvokeResponse(
                success=True,
                completion=str(response),
                session_id=session_id,
            )
        else:
            # AgentCore mode: invoke runtime
            client = _get_runtime_client()
            response = client.invoke(
                prompt=prompt_text,
                session_id=session_id,
            )
            if not response.success:
                raise HTTPException(500, response.error or "Agent invocation failed")
            return InvokeResponse(
                success=True,
                completion=response.completion,
                session_id=response.session_id,
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/invoke-streaming")
async def invoke_agent_streaming(request: InvokeRequest):
    """Invoke the agent and stream the response (SSE)."""
    session_id = request.session_id or str(uuid.uuid4())
    prompt_text = request.text
    
    async def generate():
        try:
            if not prompt_text:
                yield f"data: {json.dumps({'type': 'error', 'error': 'Either prompt or message field is required'})}\n\n"
                return
                
            if _use_local_mode():
                # Local mode: run agent and return full response
                # (Strands doesn't support streaming yet)
                agent = _get_local_agent()
                response = str(agent(prompt_text))
                yield f"data: {json.dumps({'type': 'text', 'text': response})}\n\n"
            else:
                # AgentCore mode: stream from runtime
                client = _get_runtime_client()
                for chunk in client.invoke_streaming(
                    prompt=prompt_text,
                    session_id=session_id,
                ):
                    yield f"data: {json.dumps({'type': 'text', 'text': chunk})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@app.get("/info")
async def get_info():
    """Get agent configuration info."""
    _ensure_imports()
    return {
        "mode": "local" if _use_local_mode() else "agentcore",
        "agent_runtime_arn": config.agent_runtime_arn or "Not configured (local mode)",
        "region": config.aws_region,
        "seller_api_url": config.seller_api_url or "Not configured",
    }


if __name__ == "__main__":
    import asyncio
    import uvicorn
    
    port = int(os.getenv("API_PORT", "8080"))
    cfg = uvicorn.Config(app, host="0.0.0.0", port=port)
    server = uvicorn.Server(cfg)
    asyncio.run(server.serve())
