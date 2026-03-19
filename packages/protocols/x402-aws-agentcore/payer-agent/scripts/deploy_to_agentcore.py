#!/usr/bin/env python3
"""
Deploy the payer agent to AgentCore Runtime using container deployment.

This script:
1. Builds a Docker image with all dependencies
2. Pushes to ECR
3. Creates/updates the AgentCore Runtime with container configuration
"""

import boto3
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# Configuration
AGENT_NAME = "x402PayerAgent"
REGION = os.getenv("AWS_REGION") or os.getenv("CDK_DEFAULT_REGION") or os.getenv("AWS_DEFAULT_REGION", "us-west-2")
RUNTIME_ROLE_ARN = os.getenv("RUNTIME_ROLE_ARN")

# Get from CDK outputs if not set
if not RUNTIME_ROLE_ARN:
    cfn = boto3.client("cloudformation", region_name=REGION)
    try:
        response = cfn.describe_stacks(StackName="X402PayerAgentStack")
        outputs = {o["OutputKey"]: o["OutputValue"] for o in response["Stacks"][0]["Outputs"]}
        RUNTIME_ROLE_ARN = outputs.get("AgentRuntimeRoleArn")
    except Exception as e:
        print(f"Could not get role ARN from CloudFormation: {e}")
        print("Set RUNTIME_ROLE_ARN environment variable")
        sys.exit(1)


def get_ecr_repo() -> tuple[str, str]:
    """Get or create ECR repository. Returns (repo_uri, repo_name)."""
    account_id = boto3.client("sts").get_caller_identity()["Account"]
    repo_name = "x402-payer-agent"
    
    ecr = boto3.client("ecr", region_name=REGION)
    
    try:
        response = ecr.describe_repositories(repositoryNames=[repo_name])
        repo_uri = response["repositories"][0]["repositoryUri"]
    except ecr.exceptions.RepositoryNotFoundException:
        print(f"Creating ECR repository: {repo_name}")
        response = ecr.create_repository(
            repositoryName=repo_name,
            imageScanningConfiguration={"scanOnPush": True},
        )
        repo_uri = response["repository"]["repositoryUri"]
    
    return repo_uri, repo_name


def docker_login(repo_uri: str):
    """Login to ECR."""
    account_id = boto3.client("sts").get_caller_identity()["Account"]
    ecr = boto3.client("ecr", region_name=REGION)
    
    token = ecr.get_authorization_token()
    auth_data = token["authorizationData"][0]
    
    # Extract registry URL
    registry = auth_data["proxyEndpoint"]
    
    # Get password from token (base64 encoded "AWS:password")
    import base64
    auth_token = base64.b64decode(auth_data["authorizationToken"]).decode()
    password = auth_token.split(":")[1]
    
    # Login using docker
    result = subprocess.run(
        ["docker", "login", "--username", "AWS", "--password-stdin", registry],
        input=password.encode(),
        capture_output=True,
    )
    
    if result.returncode != 0:
        print(f"Docker login failed: {result.stderr.decode()}")
        sys.exit(1)
    
    print("  Logged in to ECR")


def build_and_push_image(repo_uri: str) -> str:
    """Build Docker image and push to ECR. Returns image URI with tag."""
    agent_dir = Path(__file__).parent.parent
    tag = f"{int(time.time())}"
    image_uri = f"{repo_uri}:{tag}"
    
    print(f"  Building image: {image_uri}")
    
    # Build
    result = subprocess.run(
        ["docker", "build", "-t", image_uri, "-f", "Dockerfile", "."],
        cwd=agent_dir,
        capture_output=True,
    )
    
    if result.returncode != 0:
        print(f"Docker build failed:")
        print(result.stdout.decode())
        print(result.stderr.decode())
        sys.exit(1)
    
    print("  Build complete")
    
    # Push
    print(f"  Pushing to ECR...")
    result = subprocess.run(
        ["docker", "push", image_uri],
        capture_output=True,
    )
    
    if result.returncode != 0:
        print(f"Docker push failed: {result.stderr.decode()}")
        sys.exit(1)
    
    print("  Push complete")
    
    return image_uri


def delete_existing_runtime():
    """Delete existing runtime if it exists."""
    client = boto3.client("bedrock-agentcore-control", region_name=REGION)
    
    response = client.list_agent_runtimes()
    for rt in response.get("agentRuntimes", []):
        if rt["agentRuntimeName"] == AGENT_NAME:
            print(f"Deleting existing runtime: {rt['agentRuntimeId']}")
            client.delete_agent_runtime(agentRuntimeId=rt["agentRuntimeId"])
            
            # Wait for deletion
            while True:
                try:
                    client.get_agent_runtime(agentRuntimeId=rt["agentRuntimeId"])
                    print("  Waiting for deletion...")
                    time.sleep(5)
                except client.exceptions.ResourceNotFoundException:
                    print("  Deleted")
                    break
                except Exception as e:
                    if "ResourceNotFoundException" in str(type(e)):
                        break
                    raise
            return


def get_env_vars() -> dict:
    """Get environment variables to pass to the runtime."""
    from dotenv import dotenv_values
    
    agent_dir = Path(__file__).parent.parent
    env_file = agent_dir / ".env"
    
    if not env_file.exists():
        print("Warning: .env file not found, runtime may not have required credentials")
        return {}
    
    env = dotenv_values(env_file)
    
    # Only include specific variables needed by the agent
    allowed_vars = [
        "AWS_REGION",
        "CDP_API_KEY_ID",
        "CDP_API_KEY_SECRET",
        "CDP_WALLET_SECRET",
        "CDP_WALLET_ADDRESS",
        "NETWORK_ID",
        "BEDROCK_MODEL_ID",
        "SELLER_API_URL",  # Required for content tools to reach CloudFront
    ]
    
    return {k: v for k, v in env.items() if k in allowed_vars and v}


def create_runtime(image_uri: str) -> dict:
    """Create the AgentCore Runtime with container configuration."""
    client = boto3.client("bedrock-agentcore-control", region_name=REGION)
    
    env_vars = get_env_vars()
    
    runtime_config = {
        "agentRuntimeName": AGENT_NAME,
        "description": "x402 payment agent for accessing paid content",
        "roleArn": RUNTIME_ROLE_ARN,
        "agentRuntimeArtifact": {
            "containerConfiguration": {
                "containerUri": image_uri,
            }
        },
        "networkConfiguration": {
            "networkMode": "PUBLIC",
        },
        "environmentVariables": env_vars,
    }
    
    print("Creating runtime...")
    response = client.create_agent_runtime(**runtime_config)
    
    return response


def wait_for_runtime(runtime_id: str, timeout: int = 600) -> bool:
    """Wait for runtime to be ready."""
    client = boto3.client("bedrock-agentcore-control", region_name=REGION)
    start = time.time()
    
    while time.time() - start < timeout:
        response = client.get_agent_runtime(agentRuntimeId=runtime_id)
        status = response["status"]
        print(f"  Status: {status}")
        
        if status == "READY":
            return True
        elif status in ["FAILED", "DELETING"]:
            print(f"Runtime failed: {response.get('failureReason', 'Unknown')}")
            return False
        
        time.sleep(10)
    
    print("Timeout waiting for runtime")
    return False


def test_invocation(runtime_arn: str) -> bool:
    """Test invoking the runtime."""
    client = boto3.client("bedrock-agentcore", region_name=REGION)
    
    print("Testing invocation...")
    try:
        response = client.invoke_agent_runtime(
            agentRuntimeArn=runtime_arn,
            payload=json.dumps({"message": "What is your wallet balance?"}).encode("utf-8"),
        )
        
        # Read streaming response
        result = b""
        for event in response.get("responseStream", []):
            if "chunk" in event:
                result += event["chunk"]["bytes"]
        
        print(f"  Response: {result.decode()[:200]}...")
        return True
    except Exception as e:
        print(f"  Invocation failed: {e}")
        return False


def update_env_file(key: str, value: str):
    """Update a key=value in payer-agent/.env, or append if missing."""
    env_file = Path(__file__).parent.parent / ".env"
    if not env_file.exists():
        return
    content = env_file.read_text()
    import re
    if re.search(rf'^{key}=', content, re.MULTILINE):
        content = re.sub(rf'^{key}=.*$', f'{key}={value}', content, flags=re.MULTILINE)
    else:
        content = content.rstrip('\n') + f'\n{key}={value}\n'
    env_file.write_text(content)
    print(f"  Updated .env → {key}={value}")


def main():
    print(f"Deploying {AGENT_NAME} to AgentCore Runtime (Container Mode)")
    print(f"  Region: {REGION}")
    print(f"  Role: {RUNTIME_ROLE_ARN}")
    print()
    
    # Get/create ECR repo
    print("Setting up ECR repository...")
    repo_uri, repo_name = get_ecr_repo()
    print(f"  Repository: {repo_uri}")
    
    # Login to ECR
    print("Logging in to ECR...")
    docker_login(repo_uri)
    
    # Build and push image
    print("Building and pushing Docker image...")
    image_uri = build_and_push_image(repo_uri)
    print(f"  Image: {image_uri}")
    
    # Delete existing runtime (can't update container config)
    print("Checking for existing runtime...")
    delete_existing_runtime()
    
    # Create runtime
    print("Creating AgentCore Runtime...")
    response = create_runtime(image_uri)
    runtime_id = response.get("agentRuntimeId")
    account_id = boto3.client("sts").get_caller_identity()["Account"]
    runtime_arn = f"arn:aws:bedrock-agentcore:{REGION}:{account_id}:runtime/{runtime_id}"
    print(f"  Runtime ID: {runtime_id}")
    
    # Wait for ready
    print("Waiting for runtime to be ready...")
    if wait_for_runtime(runtime_id):
        print()
        print("✅ Runtime deployed successfully!")
        print(f"   ARN: {runtime_arn}")
        update_env_file("AGENT_RUNTIME_ARN", runtime_arn)
        print()
        
        # Test invocation
        if test_invocation(runtime_arn):
            print("✅ Invocation test passed!")
        else:
            print("⚠️  Invocation test failed - check logs")
    else:
        print()
        print("❌ Runtime deployment failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
