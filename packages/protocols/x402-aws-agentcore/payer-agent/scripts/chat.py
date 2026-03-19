#!/usr/bin/env python3
"""Interactive chat with the deployed AgentCore agent."""

import argparse
import os
import boto3
import json

# Default runtime ARN - can be overridden via --runtime-arn or AGENT_RUNTIME_ARN env var
DEFAULT_RUNTIME_ARN = "arn:aws:bedrock-agentcore:us-west-2:633890776779:runtime/x402PayerAgent-ZRET5yCgTk"

def chat(runtime_arn: str):
    client = boto3.client('bedrock-agentcore', region_name='us-west-2')
    
    print("=" * 60)
    print("x402 Payer Agent - Interactive Chat")
    print("=" * 60)
    print("Type 'quit' to exit\n")
    
    while True:
        try:
            user_input = input("You: ").strip()
            if user_input.lower() in ['quit', 'exit', 'q']:
                print("Goodbye!")
                break
            if not user_input:
                continue
                
            print("Agent: ", end="", flush=True)
            
            response = client.invoke_agent_runtime(
                agentRuntimeArn=runtime_arn,
                payload=json.dumps({'message': user_input}).encode('utf-8'),
            )
            
            result = json.loads(response['response'].read())
            print(result.get('response', 'No response'))
            print()
            
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Interactive chat with x402 Payer Agent")
    parser.add_argument(
        "--runtime-arn",
        default=os.environ.get("AGENT_RUNTIME_ARN", DEFAULT_RUNTIME_ARN),
        help="AgentCore Runtime ARN (default: from AGENT_RUNTIME_ARN env var or built-in default)"
    )
    args = parser.parse_args()
    chat(args.runtime_arn)
