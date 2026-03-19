"""Claude Code hook adapter for Ag402 x402 auto-payment.

This module provides a hook-based integration for Claude Code. When Claude
Code makes an HTTP request that returns 402 Payment Required, this hook
intercepts the response, automatically negotiates and completes payment,
then returns the paid response to Claude Code.

Usage (Claude Code settings.json):
    {
      "hooks": {
        "PreToolUse": [{
          "matcher": "mcp__.*|bash",
          "command": "ag402-claude-hook pre"
        }],
        "PostToolUse": [{
          "matcher": "mcp__.*|bash",
          "command": "ag402-claude-hook post"
        }]
      }
    }

Or use MCP mode (recommended — simpler, no hooks needed):
    ag402 install claude-code
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys

logger = logging.getLogger("ag402_claude.hook")


class ClaudeCodeHook:
    """Ag402 payment hook for Claude Code.

    Designed to be invoked as a Claude Code hook command. Reads tool input/output
    from stdin (JSON), detects 402 responses, and handles payment automatically.

    The hook operates in two phases:
      - pre:  Inspect the outbound request (passthrough, no modification).
      - post: Inspect the response. If 402 with x402 challenge, pay and retry.
    """

    def __init__(self) -> None:
        self._middleware = None
        self._wallet = None

    async def _ensure_initialized(self) -> None:
        """Lazily initialize ag402-core components."""
        if self._middleware is not None:
            return

        from ag402_core.config import load_config
        from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
        from ag402_core.payment.registry import PaymentProviderRegistry
        from ag402_core.wallet.agent_wallet import AgentWallet

        config = load_config()

        self._wallet = AgentWallet(db_path=config.wallet_db_path)
        await self._wallet.init_db()

        if config.is_test_mode:
            balance = await self._wallet.get_balance()
            if balance == 0:
                await self._wallet.deposit(100.0, note="ag402-claude auto-fund (test mode)")

        provider = PaymentProviderRegistry.get_provider(config=config)
        self._middleware = X402PaymentMiddleware(
            wallet=self._wallet,
            provider=provider,
            config=config,
        )

    async def handle_pre(self, tool_input: dict) -> dict:
        """Pre-tool hook: passthrough (no modification needed).

        Returns an empty dict to indicate "no override".
        """
        return {}

    async def handle_post(self, hook_data: dict) -> dict:
        """Post-tool hook: detect 402 responses and handle payment.

        Examines the tool output for HTTP 402 status codes with x402
        payment challenges. If found, pays and retries the request.

        Args:
            hook_data: Claude Code hook payload with tool_name, tool_input,
                       tool_output, etc.

        Returns:
            Empty dict if no action taken, or dict with replacement output
            if payment was made and request retried.
        """
        tool_output = hook_data.get("tool_output", "")

        # Quick check: does the output look like a 402 response?
        if "402" not in str(tool_output) or "x402" not in str(tool_output).lower():
            return {}

        # Try to extract URL and method from the tool input
        tool_input = hook_data.get("tool_input", {})
        url = self._extract_url(tool_input, tool_output)
        if not url:
            return {}

        method = tool_input.get("method", "GET").upper()

        logger.info("[HOOK] Detected 402 x402 challenge for %s %s", method, url)

        try:
            await self._ensure_initialized()
            result = await self._middleware.handle_request(
                method=method,
                url=url,
                headers=tool_input.get("headers"),
                body=tool_input.get("body", "").encode() if tool_input.get("body") else None,
            )

            if result.payment_made:
                logger.info(
                    "[HOOK] Payment completed: $%.4f (tx: %s)",
                    result.amount_paid,
                    result.tx_hash,
                )
                body_text = ""
                if result.body:
                    try:
                        body_text = result.body.decode("utf-8")
                    except UnicodeDecodeError:
                        body_text = f"<binary data, {len(result.body)} bytes>"

                return {
                    "status_code": result.status_code,
                    "body": body_text,
                    "payment_made": True,
                    "amount_paid": result.amount_paid,
                    "tx_hash": result.tx_hash,
                }

        except Exception as exc:
            logger.error("[HOOK] Payment failed: %s", exc)

        return {}

    @staticmethod
    def _extract_url(tool_input: dict, tool_output: str) -> str:
        """Try to extract the target URL from tool input or output."""
        # Direct URL field
        if "url" in tool_input:
            return tool_input["url"]

        # Bash command with curl/httpx/wget
        command = tool_input.get("command", "")
        if command:
            for prefix in ("curl ", "httpx ", "wget "):
                if prefix in command:
                    parts = command.split()
                    for part in parts:
                        if part.startswith(("http://", "https://")):
                            return part
        return ""

    async def close(self) -> None:
        """Cleanup resources."""
        if self._middleware is not None:
            await self._middleware.close()
        if self._wallet is not None:
            await self._wallet.close()


def main() -> None:
    """CLI entry point for ag402-claude-hook.

    Invoked by Claude Code hooks. Reads JSON from stdin, processes
    the hook phase (pre/post), and writes JSON result to stdout.
    """
    parser = argparse.ArgumentParser(
        description="Ag402 Claude Code hook — automatic x402 payment",
    )
    parser.add_argument(
        "phase",
        choices=["pre", "post"],
        help="Hook phase: 'pre' (before tool) or 'post' (after tool)",
    )
    args = parser.parse_args()

    # Read hook payload from stdin
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        payload = {}

    hook = ClaudeCodeHook()

    async def _run() -> dict:
        try:
            if args.phase == "pre":
                return await hook.handle_pre(payload)
            return await hook.handle_post(payload)
        finally:
            await hook.close()

    result = asyncio.run(_run())

    # Write result to stdout (Claude Code reads this)
    json.dump(result, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
