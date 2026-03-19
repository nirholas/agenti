#!/usr/bin/env python3
"""
Gateway invocation script for x402 Payer Agent.

This script demonstrates how to invoke the AgentCore Gateway with IAM SigV4 authentication.
It can be used to test the deployed agent or as a reference for client implementations.

Usage:
    python invoke_gateway.py --agent-id <AGENT_ID> --message "Check my wallet balance"
    python invoke_gateway.py --agent-id <AGENT_ID> --message "Get the premium article" --session-id "my-session"
    python invoke_gateway.py --agent-id <AGENT_ID> --interactive
    python invoke_gateway.py --agent-id <AGENT_ID> --verify-auth  # Verify IAM credentials

Authentication:
    This script uses IAM SigV4 authentication. Ensure you have valid AWS credentials
    configured via one of these methods:
    - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    - AWS credentials file (~/.aws/credentials)
    - IAM role (when running on EC2/Lambda/ECS)
    - AWS profile (--profile option)
    
    Required IAM permissions:
    - bedrock:InvokeAgent
    - bedrock:InvokeAgentWithResponseStream
"""

import argparse
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Optional

import boto3
from botocore.config import Config

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from agent.auth import SigV4Auth, get_aws_credentials


def verify_aws_credentials(profile_name: Optional[str] = None) -> dict:
    """
    Verify AWS credentials and return caller identity.
    
    Args:
        profile_name: Optional AWS profile name
        
    Returns:
        Dictionary with credential verification results
    """
    result = {
        "valid": False,
        "identity": None,
        "error": None,
    }
    
    try:
        if profile_name:
            session = boto3.Session(profile_name=profile_name)
            sts = session.client("sts")
        else:
            sts = boto3.client("sts")
        
        identity = sts.get_caller_identity()
        result["valid"] = True
        result["identity"] = {
            "account": identity.get("Account"),
            "arn": identity.get("Arn"),
            "user_id": identity.get("UserId"),
        }
    except Exception as e:
        result["error"] = str(e)
    
    return result


def create_bedrock_client(
    region: str = "us-west-2",
    profile_name: Optional[str] = None,
) -> boto3.client:
    """
    Create a Bedrock Agent Runtime client with retry configuration.
    
    The client automatically handles IAM SigV4 signing for all requests.
    
    Args:
        region: AWS region
        profile_name: Optional AWS profile name
        
    Returns:
        Configured boto3 client
    """
    config = Config(
        region_name=region,
        retries={
            "max_attempts": 3,
            "mode": "adaptive",
        },
        read_timeout=300,
        connect_timeout=30,
    )
    
    if profile_name:
        session = boto3.Session(profile_name=profile_name)
        return session.client("bedrock-agent-runtime", config=config)
    
    return boto3.client("bedrock-agent-runtime", config=config)


def invoke_agent(
    client: boto3.client,
    agent_id: str,
    agent_alias_id: str,
    session_id: str,
    input_text: str,
    enable_trace: bool = False,
) -> dict:
    """
    Invoke the AgentCore Gateway with the given input.
    
    The boto3 client automatically handles IAM SigV4 signing for authentication.
    
    Args:
        client: Bedrock Agent Runtime client (with SigV4 auth)
        agent_id: The agent ID
        agent_alias_id: The agent alias ID
        session_id: Session ID for conversation context
        input_text: The user's input message
        enable_trace: Whether to include trace information
        
    Returns:
        Dictionary containing the agent's response and metadata
    """
    try:
        response = client.invoke_agent(
            agentId=agent_id,
            agentAliasId=agent_alias_id,
            sessionId=session_id,
            inputText=input_text,
            enableTrace=enable_trace,
        )
        
        # Process the streaming response
        completion = ""
        traces = []
        
        for event in response.get("completion", []):
            if "chunk" in event:
                chunk_data = event["chunk"]
                if "bytes" in chunk_data:
                    completion += chunk_data["bytes"].decode("utf-8")
            if "trace" in event and enable_trace:
                traces.append(event["trace"])
        
        return {
            "success": True,
            "completion": completion,
            "session_id": session_id,
            "traces": traces if enable_trace else None,
        }
        
    except client.exceptions.ValidationException as e:
        return {
            "success": False,
            "error": f"Validation error: {str(e)}",
            "error_type": "ValidationException",
        }
    except client.exceptions.ResourceNotFoundException as e:
        return {
            "success": False,
            "error": f"Agent not found: {str(e)}",
            "error_type": "ResourceNotFoundException",
        }
    except client.exceptions.ThrottlingException as e:
        return {
            "success": False,
            "error": f"Rate limited: {str(e)}",
            "error_type": "ThrottlingException",
        }
    except client.exceptions.AccessDeniedException as e:
        return {
            "success": False,
            "error": f"Access denied - verify IAM permissions: {str(e)}",
            "error_type": "AccessDeniedException",
            "help": "Ensure your IAM user/role has bedrock:InvokeAgent permission",
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
        }


def interactive_session(
    client: boto3.client,
    agent_id: str,
    agent_alias_id: str,
    session_id: Optional[str] = None,
) -> None:
    """
    Run an interactive session with the agent.
    
    Uses IAM SigV4 authentication for all requests.
    """
    if session_id is None:
        session_id = str(uuid.uuid4())
    
    print(f"\n🤖 x402 Payer Agent Interactive Session")
    print(f"   Session ID: {session_id}")
    print(f"   Authentication: IAM SigV4")
    print(f"   Type 'quit' or 'exit' to end the session")
    print(f"   Type 'new' to start a new session")
    print(f"   Type 'whoami' to show current IAM identity")
    print("-" * 50)
    
    while True:
        try:
            user_input = input("\n📝 You: ").strip()
            
            if not user_input:
                continue
            
            if user_input.lower() in ["quit", "exit"]:
                print("\n👋 Goodbye!")
                break
            
            if user_input.lower() == "new":
                session_id = str(uuid.uuid4())
                print(f"\n🔄 New session started: {session_id}")
                continue
            
            if user_input.lower() == "whoami":
                result = verify_aws_credentials()
                if result["valid"]:
                    print(f"\n🔐 IAM Identity:")
                    print(f"   Account: {result['identity']['account']}")
                    print(f"   ARN: {result['identity']['arn']}")
                else:
                    print(f"\n❌ Credential error: {result['error']}")
                continue
            
            print("\n⏳ Processing...")
            result = invoke_agent(
                client=client,
                agent_id=agent_id,
                agent_alias_id=agent_alias_id,
                session_id=session_id,
                input_text=user_input,
            )
            
            if result["success"]:
                print(f"\n🤖 Agent: {result['completion']}")
            else:
                print(f"\n❌ Error: {result['error']}")
                if result.get("help"):
                    print(f"   💡 {result['help']}")
                
        except KeyboardInterrupt:
            print("\n\n👋 Session interrupted. Goodbye!")
            break


def main():
    parser = argparse.ArgumentParser(
        description="Invoke the x402 Payer Agent via AgentCore Gateway with IAM SigV4 authentication"
    )
    parser.add_argument(
        "--agent-id",
        required=True,
        help="The AgentCore agent ID",
    )
    parser.add_argument(
        "--agent-alias-id",
        default="TSTALIASID",
        help="The agent alias ID (default: TSTALIASID for test alias)",
    )
    parser.add_argument(
        "--region",
        default="us-west-2",
        help="AWS region (default: us-west-2)",
    )
    parser.add_argument(
        "--profile",
        default=None,
        help="AWS profile name to use for credentials",
    )
    parser.add_argument(
        "--session-id",
        default=None,
        help="Session ID for conversation context (auto-generated if not provided)",
    )
    parser.add_argument(
        "--message",
        "-m",
        help="Message to send to the agent",
    )
    parser.add_argument(
        "--interactive",
        "-i",
        action="store_true",
        help="Start an interactive session",
    )
    parser.add_argument(
        "--trace",
        action="store_true",
        help="Enable trace output for debugging",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output response as JSON",
    )
    parser.add_argument(
        "--verify-auth",
        action="store_true",
        help="Verify IAM credentials and exit",
    )
    
    args = parser.parse_args()
    
    # Verify authentication if requested
    if args.verify_auth:
        print("\n🔐 Verifying IAM credentials...")
        result = verify_aws_credentials(args.profile)
        
        if result["valid"]:
            print("\n✅ Credentials are valid!")
            print(f"   Account: {result['identity']['account']}")
            print(f"   ARN: {result['identity']['arn']}")
            print(f"   User ID: {result['identity']['user_id']}")
            
            # Check for required permissions
            print("\n📋 Required IAM permissions for AgentCore Gateway:")
            print("   - bedrock:InvokeAgent")
            print("   - bedrock:InvokeAgentWithResponseStream")
            print("\n💡 Attach the 'x402-payer-agent-gateway-invoke' managed policy")
            print("   or add these permissions to your IAM user/role.")
        else:
            print(f"\n❌ Credential verification failed: {result['error']}")
            print("\n💡 Ensure you have valid AWS credentials configured:")
            print("   - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)")
            print("   - AWS credentials file (~/.aws/credentials)")
            print("   - IAM role (when running on EC2/Lambda/ECS)")
            print("   - Use --profile to specify a named profile")
            sys.exit(1)
        return
    
    # Validate arguments
    if not args.interactive and not args.message:
        parser.error("Either --message or --interactive is required (or use --verify-auth)")
    
    # Verify credentials before proceeding
    cred_result = verify_aws_credentials(args.profile)
    if not cred_result["valid"]:
        print(f"\n❌ AWS credential error: {cred_result['error']}")
        print("   Run with --verify-auth for more details")
        sys.exit(1)
    
    # Create client with SigV4 authentication
    client = create_bedrock_client(args.region, args.profile)
    
    # Generate session ID if not provided
    session_id = args.session_id or str(uuid.uuid4())
    
    if args.interactive:
        interactive_session(
            client=client,
            agent_id=args.agent_id,
            agent_alias_id=args.agent_alias_id,
            session_id=session_id,
        )
    else:
        result = invoke_agent(
            client=client,
            agent_id=args.agent_id,
            agent_alias_id=args.agent_alias_id,
            session_id=session_id,
            input_text=args.message,
            enable_trace=args.trace,
        )
        
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if result["success"]:
                print(f"\n🤖 Agent Response:\n{result['completion']}")
                if args.trace and result.get("traces"):
                    print(f"\n📊 Traces:\n{json.dumps(result['traces'], indent=2)}")
            else:
                print(f"\n❌ Error: {result['error']}")
                if result.get("help"):
                    print(f"   💡 {result['help']}")
                sys.exit(1)


if __name__ == "__main__":
    main()
