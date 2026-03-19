"""
Lambda handler for web-ui API proxy.

This is a lightweight proxy that forwards requests to AgentCore Runtime.
It handles SigV4 signing so the browser doesn't need AWS credentials.
"""

import json
import os
import uuid
import boto3
from urllib.request import urlopen, Request
from urllib.error import URLError

# Base Sepolia configuration
BASE_SEPOLIA_RPC = "https://sepolia.base.org"
USDC_CONTRACT = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"  # USDC on Base Sepolia

# Initialize client outside handler for connection reuse
_client = None

def get_client():
    global _client
    if _client is None:
        _client = boto3.client('bedrock-agentcore')
    return _client


def handler(event, context):
    """Lambda handler for API Gateway proxy integration."""
    
    # Handle CORS preflight
    http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method', 'GET')
    if http_method == 'OPTIONS':
        return cors_response(200, '')
    
    path = event.get('path') or event.get('rawPath', '')
    method = http_method
    
    # Route requests
    if path == '/health' and method == 'GET':
        return cors_response(200, {'status': 'healthy'})
    
    if path == '/info' and method == 'GET':
        return cors_response(200, {
            'mode': 'agentcore',
            'agent_runtime_arn': os.environ.get('AGENT_RUNTIME_ARN', 'Not configured'),
        })
    
    if path == '/wallet' and method == 'GET':
        return get_wallet_info()
    
    if path == '/invoke' and method == 'POST':
        return invoke_agent(event)
    
    return cors_response(404, {'error': 'Not found'})


def get_wallet_info():
    """Get the agent's wallet address and USDC balance from Base Sepolia."""
    wallet_address = os.environ.get('WALLET_ADDRESS', '')
    
    if not wallet_address:
        return cors_response(500, {'error': 'WALLET_ADDRESS not configured'})
    
    try:
        padded_address = wallet_address[2:].lower().zfill(64)
        call_data = f"0x70a08231{padded_address}"
        
        payload = json.dumps({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{"to": USDC_CONTRACT, "data": call_data}, "latest"],
            "id": 1
        }).encode()
        
        req = Request(BASE_SEPOLIA_RPC, data=payload, headers={
            "Content-Type": "application/json",
            "User-Agent": "x402-web-ui/1.0",
        })
        with urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
        
        balance_hex = result.get('result', '0x0')
        balance_wei = int(balance_hex, 16)
        balance_usdc = balance_wei / 1_000_000
        
        return cors_response(200, {
            'address': wallet_address,
            'balance': f"{balance_usdc:.6f}",
            'network': 'Base Sepolia',
            'currency': 'USDC',
        })
        
    except (URLError, json.JSONDecodeError, ValueError) as e:
        return cors_response(500, {'error': f'Failed to fetch balance: {str(e)}'})


def invoke_agent(event):
    """Invoke the AgentCore Runtime."""
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return cors_response(400, {'error': 'Invalid JSON'})
    
    prompt = body.get('prompt') or body.get('message')
    if not prompt:
        return cors_response(400, {'error': 'prompt or message field required'})
    
    # Basic input sanitization
    prompt = sanitize_prompt(prompt)
    
    session_id = body.get('session_id') or f"web-{uuid.uuid4().hex[:8]}-{uuid.uuid4().hex}"
    
    if len(session_id) < 33:
        session_id = f"web-session-{session_id}-{uuid.uuid4().hex}"
    
    runtime_arn = os.environ.get('AGENT_RUNTIME_ARN')
    if not runtime_arn:
        return cors_response(500, {'error': 'AGENT_RUNTIME_ARN not configured'})
    
    try:
        client = get_client()
        payload = json.dumps({'prompt': prompt}).encode()
        
        response = client.invoke_agent_runtime(
            agentRuntimeArn=runtime_arn,
            runtimeSessionId=session_id,
            payload=payload,
        )
        
        completion = ''
        if 'response' in response:
            resp = response['response']
            if hasattr(resp, 'read'):
                raw = resp.read()
                if isinstance(raw, bytes):
                    raw = raw.decode('utf-8')
                try:
                    data = json.loads(raw)
                    if isinstance(data, dict):
                        completion = data.get('response', data.get('completion', raw))
                    else:
                        completion = raw
                except json.JSONDecodeError:
                    completion = raw
            else:
                completion = str(resp)
        
        return cors_response(200, {
            'success': True,
            'completion': completion,
            'session_id': session_id,
        })
        
    except Exception as e:
        return cors_response(500, {
            'success': False,
            'error': str(e),
            'session_id': session_id,
        })


MAX_PROMPT_LENGTH = 4000

def sanitize_prompt(prompt: str) -> str:
    """Basic sanitization: enforce length limit and strip control characters."""
    prompt = prompt[:MAX_PROMPT_LENGTH]
    # Strip control characters (keep newlines and tabs for formatting)
    prompt = ''.join(
        ch for ch in prompt
        if ch in ('\n', '\t') or (ord(ch) >= 32)
    )
    return prompt.strip()


def cors_response(status_code, body):
    """Return response with CORS headers."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        'body': json.dumps(body) if isinstance(body, dict) else body,
    }
