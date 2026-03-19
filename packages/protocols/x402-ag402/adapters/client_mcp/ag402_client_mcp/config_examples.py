"""MCP configuration examples and auto-installer for various AI tools.

Generates ready-to-use MCP configuration JSON for:
- Claude Code / Claude Desktop
- Cursor
- OpenClaw (via mcporter)
- Generic MCP Client

Also provides `install_for_tool()` to auto-write configs to the correct
location — zero manual copy-paste needed.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path


def _find_python() -> str:
    """Find the current Python executable path."""
    return sys.executable


def _find_command(name: str) -> str:
    """Find a command in PATH, return path or placeholder."""
    path = shutil.which(name)
    return path or f"/path/to/{name}"


def get_stdio_config(
    env_vars: dict[str, str] | None = None,
) -> dict:
    """Generate MCP server config for stdio transport.

    This is the standard config format used by Claude Code, Cursor, etc.
    """
    python_path = _find_python()

    config: dict = {
        "command": python_path,
        "args": ["-m", "ag402_client_mcp.server"],
    }

    if env_vars:
        config["env"] = env_vars

    return config


def get_claude_code_config(env_vars: dict[str, str] | None = None) -> dict:
    """Generate claude_desktop_config.json / Claude Code MCP configuration.

    Add this to your Claude Code MCP settings:
    - Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json
    - Claude Code CLI: .claude/settings.local.json → mcpServers section
    """
    return {
        "mcpServers": {
            "ag402": get_stdio_config(env_vars=env_vars),
        }
    }


def get_cursor_config(env_vars: dict[str, str] | None = None) -> dict:
    """Generate Cursor MCP configuration.

    Add this to .cursor/mcp.json in your project or ~/.cursor/mcp.json globally.
    """
    return {
        "mcpServers": {
            "ag402": get_stdio_config(env_vars=env_vars),
        }
    }


def get_openclaw_config(env_vars: dict[str, str] | None = None) -> dict:
    """Generate OpenClaw MCP configuration.

    OpenClaw uses mcporter to bridge MCP servers.
    Returns the mcporter config add command instead of raw JSON.
    """
    python_path = _find_python()
    env_str = ""
    if env_vars:
        env_str = " ".join(f"--env {k}={v}" for k, v in env_vars.items())

    return {
        "type": "mcporter",
        "install_command": (
            f"mcporter config add ag402 "
            f"--command {python_path} "
            f"--arg -m --arg ag402_client_mcp.server "
            f"--scope home"
            + (f" {env_str}" if env_str else "")
        ),
        "verify_command": "mcporter list ag402 --schema",
        "note": "OpenClaw uses mcporter to bridge MCP servers. Run the install_command above.",
    }


def get_generic_config(env_vars: dict[str, str] | None = None) -> dict:
    """Generate generic MCP configuration for any MCP-compatible tool."""
    return {
        "mcpServers": {
            "ag402": get_stdio_config(env_vars=env_vars),
        }
    }


# ─── Auto-Install ─────────────────────────────────────────────────────

# Config file locations for each tool
_CONFIG_PATHS: dict[str, list[str]] = {
    "claude-desktop": [
        "~/Library/Application Support/Claude/claude_desktop_config.json",  # macOS
        "~/.config/claude/claude_desktop_config.json",  # Linux
    ],
    "claude-code": [
        ".claude/settings.local.json",  # project-local
    ],
    "cursor": [
        ".cursor/mcp.json",  # project-local
        "~/.cursor/mcp.json",  # global
    ],
}


def install_for_tool(
    tool: str,
    scope: str = "project",
    env_vars: dict[str, str] | None = None,
) -> tuple[bool, str]:
    """Auto-install MCP configuration for a specific AI tool.

    Args:
        tool: Tool name (claude-code, claude-desktop, cursor, openclaw)
        scope: "project" for project-local, "global" for user-level
        env_vars: Optional environment variables to include

    Returns:
        (success, message) tuple
    """
    tool_lower = tool.lower()

    # OpenClaw: use mcporter CLI
    if tool_lower == "openclaw":
        return _install_openclaw(env_vars)

    # Standard JSON-based tools
    config_gen = {
        "claude": get_claude_code_config,
        "claude-code": get_claude_code_config,
        "claude-desktop": get_claude_code_config,
        "cursor": get_cursor_config,
    }.get(tool_lower)

    if config_gen is None:
        supported = "claude-code, claude-desktop, cursor, openclaw"
        return False, f"Unknown tool: {tool}. Supported: {supported}"

    config = config_gen(env_vars=env_vars)

    # Determine target path
    paths = _CONFIG_PATHS.get(tool_lower, [])
    if not paths:
        return False, f"No known config path for {tool}"

    if scope == "global" and len(paths) > 1:
        target = Path(os.path.expanduser(paths[-1]))
    else:
        target = Path(os.path.expanduser(paths[0]))

    # Merge with existing config
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        existing: dict = {}
        if target.exists():
            existing = json.loads(target.read_text(encoding="utf-8"))

        # Deep merge mcpServers
        if "mcpServers" not in existing:
            existing["mcpServers"] = {}
        existing["mcpServers"]["ag402"] = config["mcpServers"]["ag402"]

        target.write_text(
            json.dumps(existing, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        return True, f"Installed to {target}"
    except Exception as e:
        return False, f"Failed to write {target}: {e}"


def _install_openclaw(env_vars: dict[str, str] | None = None) -> tuple[bool, str]:
    """Install ag402 into OpenClaw via mcporter."""
    import subprocess

    python_path = _find_python()
    cmd = [
        "mcporter", "config", "add", "ag402",
        "--command", python_path,
        "--arg", "-m", "--arg", "ag402_client_mcp.server",
        "--scope", "home",
    ]
    if env_vars:
        for k, v in env_vars.items():
            cmd.extend(["--env", f"{k}={v}"])

    mcporter = shutil.which("mcporter")
    if not mcporter:
        return False, (
            "mcporter not found. Install it first:\n"
            "  npm install -g mcporter\n"
            "Then retry: ag402 install openclaw"
        )

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return True, "Installed via mcporter. Verify with: mcporter list ag402 --schema"
    except subprocess.CalledProcessError as e:
        return False, f"mcporter failed: {e.stderr.strip()}"


# ─── Pretty Print ─────────────────────────────────────────────────────


def print_all_configs(env_vars: dict[str, str] | None = None) -> None:
    """Print MCP configurations for all supported tools."""
    configs = [
        ("Claude Code / Claude Desktop", get_claude_code_config, "~/Library/Application Support/Claude/claude_desktop_config.json"),
        ("Cursor", get_cursor_config, ".cursor/mcp.json"),
        ("OpenClaw (via mcporter)", get_openclaw_config, "mcporter config add"),
    ]

    for name, gen_fn, path in configs:
        print(f"\n{'=' * 60}")
        print(f"  {name}")
        print(f"  Config path: {path}")
        print(f"{'=' * 60}")
        result = gen_fn(env_vars=env_vars)
        if result.get("type") == "mcporter":
            print(f"  Run: {result['install_command']}")
            print(f"  Verify: {result['verify_command']}")
        else:
            print(json.dumps(result, indent=2))
        print()

    print("Tip: Use `ag402 install <tool>` to auto-write the config.")
    print("     Supported: claude-code, cursor, openclaw")
    print()


def get_config_for_tool(
    tool: str,
    env_vars: dict[str, str] | None = None,
) -> str:
    """Get MCP configuration JSON string for a specific tool.

    Returns a JSON string with the configuration, or an error JSON
    if the tool is not recognized.
    """
    generators = {
        "claude": get_claude_code_config,
        "claude-code": get_claude_code_config,
        "claude-desktop": get_claude_code_config,
        "cursor": get_cursor_config,
        "openclaw": get_openclaw_config,
        "generic": get_generic_config,
    }

    gen_fn = generators.get(tool.lower())
    if gen_fn is None:
        supported = ", ".join(sorted(generators.keys()))
        return json.dumps({"error": f"Unknown tool: {tool}. Supported: {supported}"}, indent=2)

    return json.dumps(gen_fn(env_vars=env_vars), indent=2)


# Backward-compatible alias
print_config_for_tool = get_config_for_tool
