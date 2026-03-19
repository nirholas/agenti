"""CLI entry point for ag402-core.

Provides a rich set of commands for wallet management, status monitoring,
transaction inspection, health diagnostics, and demo execution.
Cross-platform compatible (macOS, Linux, Windows).

Ag402: Powered by the Open402 standard.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import os
import platform
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ag402_core.terminal import (
    _c,
)
from ag402_core.terminal import (
    bold as _bold,
)
from ag402_core.terminal import (
    cyan as _cyan,
)
from ag402_core.terminal import (
    dim as _dim,
)
from ag402_core.terminal import (
    green as _green,
)
from ag402_core.terminal import (
    red as _red,
)
from ag402_core.terminal import (
    yellow as _yellow,
)

_DEFAULT_DB = str(Path.home() / ".ag402" / "wallet.db")
from ag402_core import __version__ as _VERSION

# ─── CLI-specific display helpers ────────────────────────────────────


def _bar(used: float, total: float, width: int = 20) -> str:
    """Render a progress bar."""
    used, total = float(used), float(total)
    if total <= 0:
        return " " * width
    ratio = min(used / total, 1.0)
    filled = int(ratio * width)
    empty = width - filled
    pct = ratio * 100
    color = "32" if pct < 60 else ("33" if pct < 85 else "31")
    bar_str = "█" * filled + "░" * empty
    return _c(color, bar_str) + f" {pct:.0f}%"


def _short_addr(addr: str, max_len: int = 20) -> str:
    """Shorten a blockchain address for display."""
    if not addr or len(addr) <= max_len:
        return addr or "-"
    return addr[:8] + "..." + addr[-8:]


def _time_ago(ts: float) -> str:
    """Human-readable time-ago string."""
    diff = time.time() - ts
    if diff < 60:
        return f"{diff:.0f}s ago"
    if diff < 3600:
        return f"{diff / 60:.0f}m ago"
    if diff < 86400:
        return f"{diff / 3600:.0f}h ago"
    return f"{diff / 86400:.0f}d ago"


# ─── Parser ──────────────────────────────────────────────────────────────

def _build_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser (exposed for testing)."""
    parser = argparse.ArgumentParser(
        prog="ag402",
        description="Ag402 — Payment Engine for AI Agents (Powered by the Open402 standard)",
        add_help=False,  # We provide our own 'help' subcommand
    )
    parser.add_argument("--version", action="version", version=f"ag402 {_VERSION}")
    parser.add_argument("-h", "--help", action="store_true", dest="show_help",
                        help="Show help and exit")
    sub = parser.add_subparsers(dest="command")

    # --- setup (NEW — interactive wizard) ---
    setup_p = sub.add_parser("setup", help="Interactive setup wizard (recommended for first use)")
    setup_p.add_argument("--show-examples", action="store_true",
                         help="Show example .env configurations for each network")

    # --- init (legacy, still works) ---
    init_p = sub.add_parser("init", help="Initialize wallet + deposit test funds")
    init_p.add_argument("--db", default=_DEFAULT_DB, help="Wallet database path")

    # --- run (NEW — launch Agent with payment injection) ---
    run_p = sub.add_parser("run", help="Launch an Agent with automatic x402 payment")
    run_p.add_argument("target", nargs="?", default=None,
                       help="Target command, or use '--' prefix for arbitrary commands")
    run_p.add_argument("extra_args", nargs=argparse.REMAINDER, default=[],
                       help="Arguments to pass to the target command")

    # --- env (NEW — .env file management) ---
    env_p = sub.add_parser("env", help="Manage configuration (.env file)")
    env_sub = env_p.add_subparsers(dest="env_action")
    env_sub.add_parser("init", help="Create .env file interactively")
    env_sub.add_parser("show", help="Show current configuration and sources")
    env_set_p = env_sub.add_parser("set", help="Set a single config value")
    env_set_p.add_argument("key", help="Config key (e.g. X402_DAILY_LIMIT)")
    env_set_p.add_argument("value", help="Config value")

    # --- mcp (NEW — MCP client server for Claude Code / Cursor / OpenClaw) ---
    mcp_p = sub.add_parser("mcp", help="Start MCP payment server (for Claude Code / Cursor / OpenClaw)")
    mcp_p.add_argument("--sse", action="store_true", help="Use SSE transport instead of stdio")
    mcp_p.add_argument("--port", type=int, default=14021, help="SSE server port (default: 14021)")
    mcp_p.add_argument("--host", type=str, default="127.0.0.1", help="SSE server host (default: 127.0.0.1)")

    # --- mcp-config (NEW — generate MCP configuration for AI tools) ---
    mcp_cfg_p = sub.add_parser("mcp-config", help="Generate MCP config for Claude Code / Cursor / OpenClaw")
    mcp_cfg_p.add_argument("tool", nargs="?", default=None,
                           help="Target tool: claude, cursor, openclaw (default: show all)")

    # --- install (NEW — one-command MCP setup for AI tools) ---
    install_p = sub.add_parser("install", help="One-command MCP setup for AI tools (zero config)")
    install_p.add_argument("tool", help="Target tool: claude-code, cursor, openclaw")
    install_p.add_argument("--global", dest="global_scope", action="store_true",
                           help="Install globally instead of project-local")

    # --- serve (NEW — provider mode gateway) ---
    serve_p = sub.add_parser("serve", help="Start payment gateway (provider mode)")
    serve_p.add_argument("--target", default="", help="Backend API URL")
    serve_p.add_argument("--host", default="0.0.0.0",
                         help="Host to bind (default: 0.0.0.0, use 127.0.0.1 for local-only)")
    serve_p.add_argument("--port", type=int, default=4020, help="Gateway port")
    serve_p.add_argument("--price", default="0.02", help="Price per API call (USDC)")
    serve_p.add_argument("--address", default="", help="Receiving wallet address")
    serve_p.add_argument("--localnet", action="store_true",
                         help="Use local Solana validator (http://127.0.0.1:8899)")

    # --- upgrade (NEW — test → production migration) ---
    sub.add_parser("upgrade", help="Upgrade from test mode to production")

    # --- help (NEW — beautiful help page) ---
    sub.add_parser("help", help="Show all commands with descriptions")

    # --- status ---
    sub.add_parser("status", help="Show comprehensive status dashboard")

    # --- balance ---
    bal_p = sub.add_parser("balance", help="Check wallet balance and budget usage")
    bal_p.add_argument("--db", default=_DEFAULT_DB, help="Wallet database path")

    # --- history ---
    hist_p = sub.add_parser("history", help="Show transaction history with stats")
    hist_p.add_argument("--db", default=_DEFAULT_DB, help="Wallet database path")
    hist_p.add_argument("-n", "--limit", type=int, default=20, help="Number of transactions")
    hist_p.add_argument(
        "--format", choices=["table", "json", "csv"], default="table",
        help="Output format (default: table)",
    )
    hist_p.add_argument(
        "--output", default="", help="Output file path (for json/csv export)",
    )

    # --- tx ---
    tx_p = sub.add_parser("tx", help="View single transaction details")
    tx_p.add_argument("tx_id", help="Transaction ID (or prefix)")
    tx_p.add_argument("--db", default=_DEFAULT_DB, help="Wallet database path")

    # --- config ---
    sub.add_parser("config", help="Show safety limits and configuration")

    # --- info ---
    sub.add_parser("info", help="Show protocol and version info")

    # --- doctor ---
    sub.add_parser("doctor", help="Run environment health checks")

    # --- demo ---
    demo_p = sub.add_parser("demo", help="Run E2E payment demo (test mode, zero config)")
    demo_p.add_argument(
        "--mode", choices=["mock", "localnet", "devnet"], default="mock",
        help="Demo mode: mock (default), localnet (solana-test-validator), devnet",
    )
    demo_p.add_argument("--localnet", action="store_true", help="Shortcut for --mode localnet")
    demo_p.add_argument("--devnet", action="store_true", help="Shortcut for --mode devnet")

    # --- pay (NEW — single request with auto-payment) ---
    pay_p = sub.add_parser("pay", help="Send a single request with auto-payment")
    pay_p.add_argument("url", help="Target URL (e.g. http://127.0.0.1:4020/weather?city=Tokyo)")
    pay_p.add_argument("-X", "--method", default="GET", help="HTTP method (default: GET)")
    pay_p.add_argument("--db", default=_DEFAULT_DB, help="Wallet database path")

    # --- prepaid (NEW — prepaid credential management) ---
    prepaid_p = sub.add_parser("prepaid", help="Manage prepaid credentials")
    prepaid_sub = prepaid_p.add_subparsers(dest="prepaid_action")
    prepaid_sub.add_parser("status", help="Show all prepaid credentials and remaining calls")
    prepaid_sub.add_parser("purge", help="Remove expired and depleted credentials")
    prepaid_sub.add_parser("pending", help="Show in-flight purchase (if any) waiting for recovery")
    buy_p = prepaid_sub.add_parser("buy", help="Purchase a prepaid package from a gateway")
    buy_p.add_argument("gateway_url", help="Gateway URL (e.g. http://localhost:8001)")
    buy_p.add_argument("package_id", help="Package ID (e.g. p30d_1000)")
    buy_p.add_argument("--buyer-address", default="",
                       help="Buyer wallet address (default: use configured wallet)")
    recover_p = prepaid_sub.add_parser(
        "recover",
        help="Recover a credential after a failed purchase (use if `buy` timed out)",
    )
    recover_p.add_argument("gateway_url", help="Gateway URL (e.g. http://localhost:8001)")
    recover_p.add_argument("tx_hash", nargs="?", default="",
                           help="Transaction hash (auto-detected from last buy if omitted)")
    recover_p.add_argument("package_id", nargs="?", default="",
                           help="Package ID (auto-detected from last buy if omitted)")
    recover_p.add_argument("--buyer-address", default="",
                           help="Buyer wallet address (default: use configured wallet)")

    # --- export ---
    exp_p = sub.add_parser("export", help="Export transaction history to file")
    exp_p.add_argument("--db", default=_DEFAULT_DB, help="Wallet database path")
    exp_p.add_argument(
        "--format", choices=["json", "csv"], default="json",
        help="Export format (default: json)",
    )
    exp_p.add_argument(
        "--output", default="", help="Output file path (default: ag402_history.<fmt>)",
    )

    return parser


# ─── Main dispatch ───────────────────────────────────────────────────────

def main() -> None:
    from ag402_core.friendly_errors import friendly_cli_wrapper
    from ag402_core.security.key_guard import install_key_guard

    install_key_guard()

    @friendly_cli_wrapper
    def _main_inner():
        parser = _build_parser()
        args = parser.parse_args()

        if getattr(args, "show_help", False) or args.command is None:
            if args.command is None:
                _print_banner()
                _cmd_help()
            else:
                _cmd_help()
            sys.exit(0)

        dispatch = {
            "setup": lambda: _cmd_setup(args),
            "init": lambda: asyncio.run(_cmd_init(args.db)),
            "run": lambda: _cmd_run(args),
            "env": lambda: _cmd_env(args),
            "mcp": lambda: _cmd_mcp(args),
            "mcp-config": lambda: _cmd_mcp_config(args),
            "install": lambda: _cmd_install(args),
            "serve": lambda: _cmd_serve(args),
            "upgrade": lambda: _cmd_upgrade(),
            "help": lambda: _cmd_help(),
            "status": lambda: asyncio.run(_cmd_status()),
            "balance": lambda: asyncio.run(_cmd_balance(args.db)),
            "history": lambda: asyncio.run(_cmd_history(args.db, args.limit, args.format, args.output)),
            "tx": lambda: asyncio.run(_cmd_tx(args.db, args.tx_id)),
            "config": _cmd_config,
            "info": _cmd_info,
            "doctor": _cmd_doctor,
            "demo": lambda: asyncio.run(_cmd_demo(_resolve_demo_mode(args))),
            "pay": lambda: asyncio.run(_cmd_pay(args.url, args.method, args.db)),
            "prepaid": lambda: asyncio.run(_cmd_prepaid(args)),
            "export": lambda: asyncio.run(_cmd_export(args.db, args.format, args.output)),
        }

        handler = dispatch.get(args.command)
        if handler:
            handler()
        else:
            _cmd_help()

    _main_inner()


# ─── Banner ──────────────────────────────────────────────────────────────

def _print_banner() -> None:
    print()
    print(_bold("  ╔══════════════════════════════════════════════════════╗"))
    print(_bold("  ║") + _cyan("  Ag402") + f" v{_VERSION}" + " — Payment Engine for AI Agents  " + _bold("║"))
    print(_bold("  ║") + "  Powered by the Open402 standard                    " + _bold("║"))
    print(_bold("  ╚══════════════════════════════════════════════════════╝"))
    print()


# ─── NEW Commands ────────────────────────────────────────────────────────


def _cmd_help() -> None:
    """Beautiful help page — categorized with usage hints."""
    print()
    print(f"  {_bold('Ag402')} v{_VERSION} — Payment Engine for AI Agents")
    print("  " + "─" * 50)
    print()
    print(f"  {_bold('Quick Start')}")
    print(f"    {'setup':<24s} Interactive setup wizard (recommended for first use)")
    print(f"    {'demo':<24s} Run a full payment demo (mock mode)")
    print(f"    {'demo --localnet':<24s} Demo with local Solana validator")
    print(f"    {'demo --devnet':<24s} Demo with Solana devnet")
    print(f"    {'pay <url>':<24s} Send a single request with auto-payment")
    print()
    print(f"  {_bold('Agent Integration')}")
    print(f"    {'run <command>':<24s} Launch an Agent with payment injection")
    print(f"    {'run -- python ...':<24s} Any Python script or agent")
    print(f"    {'mcp':<24s} Start MCP payment server (Claude Code / Cursor / OpenClaw)")
    print(f"    {'install <tool>':<24s} One-command MCP setup (claude-code, cursor, openclaw)")
    print(f"    {'mcp-config [tool]':<24s} Generate MCP config for AI tools")
    print()
    print(f"  {_bold('Wallet')}")
    print(f"    {'status':<24s} Full status dashboard")
    print(f"    {'balance':<24s} Quick balance check")
    print(f"    {'history':<24s} Transaction history")
    print(f"    {'tx <id>':<24s} Transaction details")
    print()
    print(f"  {_bold('Configuration')}")
    print(f"    {'config':<24s} View safety limits")
    print(f"    {'env show':<24s} Show current configuration")
    print(f"    {'env set <key> <val>':<24s} Set a config value")
    print(f"    {'doctor':<24s} Environment health check")
    print(f"    {'info':<24s} Protocol and version info")
    print()
    print(f"  {_bold('Service Provider')}")
    print(f"    {'serve':<24s} Start payment gateway")
    print(f"    {'upgrade':<24s} Switch from test to production mode")
    print()
    print(f"  {_bold('Examples')}")
    print(f"    $ {_cyan('ag402 setup')}")
    print(f"    $ {_cyan('ag402 demo --localnet')}")
    print(f"    $ {_cyan('ag402 install cursor')}")
    print(f"    $ {_cyan('ag402 run -- python my_agent.py')}")
    print(f"    $ {_cyan('ag402 pay http://127.0.0.1:4020/')}")
    print()
    print(f"  Use {_cyan('ag402 <command> --help')} for command details")
    print()


def _cmd_install(args) -> None:
    """One-command MCP setup — auto-write config for Claude Code, Cursor, OpenClaw."""
    try:
        from ag402_client_mcp.config_examples import install_for_tool
    except ImportError:
        print(f"\n  {_red('✗')} ag402-client-mcp not installed")
        print("  → Run: pip install ag402-client-mcp")
        print("  → Or:  pip install -e adapters/client_mcp/")
        print()
        return

    tool = args.tool
    scope = "global" if getattr(args, "global_scope", False) else "project"

    print()
    print(f"  Installing Ag402 MCP for {_bold(tool)}...")

    success, message = install_for_tool(tool, scope=scope)

    if success:
        print(f"  {_green('✓')} {message}")
        print()
        print(f"  {_bold('What happens next:')}")
        print(f"    1. Restart {tool} (or reload MCP config)")
        print("    2. The 'fetch_with_autopay' tool will appear in your AI tool")
        print("    3. Ask your AI to call a paid API — Ag402 handles the rest")
        print()
        print(f"  {_dim('Test it:')} Ask your AI: \"Check my Ag402 wallet balance\"")
    else:
        print(f"  {_red('✗')} {message}")

    print()


def _cmd_mcp(args) -> None:
    """Start the MCP client payment server for Claude Code / Cursor / OpenClaw."""
    try:
        from ag402_client_mcp.server import main as mcp_main
    except ImportError:
        print(f"\n  {_red('✗')} ag402-client-mcp not installed")
        print("  → Run: pip install ag402-client-mcp")
        print("  → Or:  pip install -e adapters/client_mcp/")
        print()
        return

    import sys as _sys
    original_argv = _sys.argv
    new_argv = ["ag402-mcp-client"]
    if getattr(args, "sse", False):
        new_argv.append("--sse")
        new_argv.extend(["--port", str(args.port)])
        new_argv.extend(["--host", str(args.host)])

    try:
        _sys.argv = new_argv
        mcp_main()
    finally:
        _sys.argv = original_argv


def _cmd_mcp_config(args) -> None:
    """Generate MCP configuration for various AI tools."""
    try:
        from ag402_client_mcp.config_examples import print_all_configs, print_config_for_tool
    except ImportError:
        print(f"\n  {_red('✗')} ag402-client-mcp not installed")
        print("  → Run: pip install ag402-client-mcp")
        print("  → Or:  pip install -e adapters/client_mcp/")
        print()
        return

    tool = getattr(args, "tool", None)
    if tool:
        result = print_config_for_tool(tool)
        print(result)
    else:
        print_all_configs()


def _cmd_setup(args) -> None:
    """Launch the interactive setup wizard."""
    from ag402_core.setup_wizard import (
        init_wallet_after_setup,
        print_env_examples,
        run_setup_wizard,
    )

    if getattr(args, "show_examples", False):
        print_env_examples()
        return

    result = run_setup_wizard()
    # Initialize wallet DB and deposit test funds
    asyncio.run(init_wallet_after_setup(result))


def _cmd_run(args) -> None:
    """Launch an Agent process with x402 payment proxy injection."""
    import shutil
    import subprocess

    target = args.target
    extra = args.extra_args or []

    # Strip leading '--' from extra args
    if extra and extra[0] == "--":
        extra = extra[1:]

    if not target and not extra:
        print()
        print(f"  {_bold('ag402 run')} — Launch an Agent with x402 payment injection")
        print()
        print("  Usage:")
        print("    ag402 run -- python my_agent.py    Generic mode")
        print("    ag402 run -- <any command>          Generic proxy mode")
        print()
        print(f"  {_dim('HTTP requests that receive 402 will be auto-paid by Ag402.')}")
        print()
        return

    # Determine the actual command to run
    if target and target != "--":
        cmd = [target, *extra]
        label = target
    else:
        cmd = extra
        label = extra[0] if extra else "command"

    # Verify command exists
    if not shutil.which(cmd[0]):
        print(f"\n  {_red('✗')} Command not found: {cmd[0]}")
        print("  → Make sure it is installed and available in PATH\n")
        return

    # Load config for status display
    from ag402_core.config import load_config
    config = load_config()
    mode_str = _yellow("TEST") if config.is_test_mode else _red("PRODUCTION")

    print()
    print(f"  {_green('✓')} Ag402 payment engine active ({mode_str} mode)")
    print(f"  {_green('✓')} Python HTTP auto-pay: ag402.enable() injected")
    print(f"  {_green('✓')} Starting {label}...")
    print("  " + "─" * 50)
    print()

    # Build environment with AG402_ENABLED=1 + sitecustomize injection
    env = os.environ.copy()
    env["AG402_ENABLED"] = "1"

    # For Python commands, inject via sitecustomize.py + PYTHONPATH
    # (PYTHONSTARTUP only works for interactive shells, NOT for scripts)
    import tempfile
    tmpdir = None
    if _is_python_command(cmd):
        tmpdir = tempfile.mkdtemp(prefix="ag402_")
        # S2-2 FIX: Restrict tmpdir permissions to owner-only (0o700)
        os.chmod(tmpdir, 0o700)  # nosemgrep: insecure-file-permissions  (dir: owner-only is correct)
        sc_path = os.path.join(tmpdir, "sitecustomize.py")
        with open(sc_path, "w") as f:
            f.write(
                "try:\n"
                "    import ag402_core; ag402_core.enable()\n"
                "except Exception:\n"
                "    pass\n"
            )
        existing = env.get("PYTHONPATH", "")
        env["PYTHONPATH"] = f"{tmpdir}{os.pathsep}{existing}" if existing else tmpdir

    # Print proxy mode info for non-Python commands
    if not _is_python_command(cmd):
        print(f"  {_yellow('⚠')} Proxy mode active for HTTP only.")
        print(f"  {_dim('For HTTPS auto-pay, use Python SDK injection: ag402_core.enable()')}")
        print()

    try:
        result = subprocess.run(cmd, env=env)
        sys.exit(result.returncode)
    except KeyboardInterrupt:
        print(f"\n  {_yellow('⚠')} Stopped")
        sys.exit(130)
    finally:
        if tmpdir:
            import shutil as _shutil
            _shutil.rmtree(tmpdir, ignore_errors=True)


def _is_python_command(cmd: list[str]) -> bool:
    """Check if a command is a Python interpreter."""
    if not cmd:
        return False
    base = os.path.basename(cmd[0])
    return base.startswith("python")


def _cmd_env(args) -> None:
    """Manage .env configuration file."""
    from ag402_core.env_manager import get_env_path, parse_env_file, set_env_value

    action = getattr(args, "env_action", None)

    if action is None or action == "show":
        # Show current config
        env_path = get_env_path()
        entries = parse_env_file()

        print()
        print(_bold("  Ag402 Configuration"))
        print(f"  {_dim(f'File: {env_path}')}")
        print("  " + "─" * 45)
        print()

        if not entries:
            print(f"  {_yellow('⚠')} Config file is empty or does not exist")
            print(f"  → Run {_cyan('ag402 setup')} to generate configuration")
        else:
            for key, value in sorted(entries.items()):
                # Mask sensitive values
                if any(s in key.lower() for s in ("key", "password", "secret")):
                    display = "********" if value else "(empty)"
                else:
                    display = value
                # Show if overridden by env var
                env_val = os.environ.get(key)
                source = ""
                if env_val and env_val != value:
                    source = f" {_yellow('← env override')}"
                print(f"  {key:<35s} {display}{source}")
        print()

    elif action == "init":
        # Same as setup but only the env part
        _cmd_setup(argparse.Namespace(show_examples=False))

    elif action == "set":
        key = args.key
        value = args.value
        set_env_value(key, value)
        if any(s in key.lower() for s in ("key", "password", "secret")):
            display = "********"
        else:
            display = value
        print(f"\n  {_green('✓')} {key} = {display}\n")
        print(f"  {_dim('Saved to ~/.ag402/.env')}\n")


def _check_port_available(host: str, port: int) -> bool:
    """Check if a port is available (nothing listening)."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex((host, port)) != 0


def _cmd_serve(args) -> None:
    """Start the payment gateway in provider mode."""
    from ag402_core.config import load_config as _load_cfg

    target = args.target
    port = args.port

    # S1-2 FIX: Mode-aware host selection.
    # If user explicitly passed --host, use it; otherwise pick based on X402_MODE.
    _cfg = _load_cfg()
    user_specified_host = getattr(args, "host", "0.0.0.0")
    _parser_default_host = "0.0.0.0"
    if user_specified_host == _parser_default_host and _cfg.is_test_mode:
        host = "127.0.0.1"
    else:
        host = user_specified_host
    if _cfg.is_test_mode and host == "0.0.0.0":
        print(f"  {_yellow('⚠')} {_bold('Security Warning')}: Binding 0.0.0.0 in test mode!")
        print("     Test mode has no on-chain verification — do NOT expose publicly.")
        print()
    price = args.price
    address = args.address
    use_localnet = getattr(args, "localnet", False)

    if use_localnet:
        if not _check_localnet_ready():
            print(f"\n  {_red('✗')} Local Solana validator not running on port 8899")
            print(f"  → Run: {_cyan('solana-test-validator --reset')}")
            print()
            return
        print(f"\n  {_cyan('ℹ')} Localnet mode: using solana-test-validator at http://127.0.0.1:8899\n")

    if not target:
        # Try to load from .env
        from ag402_core.env_manager import parse_env_file
        entries = parse_env_file()
        target = entries.get("AG402_TARGET_API", "")
        price = entries.get("AG402_API_PRICE", price)
        address = entries.get("AG402_RECEIVE_ADDRESS", address)

    if not target:
        print(f"\n  {_red('✗')} No backend API URL specified")
        print(f"  → Use {_cyan('ag402 serve --target http://localhost:8000')}")
        print(f"  → Or run {_cyan('ag402 setup')} to configure\n")
        return

    # Detect if the backend is reachable; if not, offer built-in demo API
    use_builtin_backend = False
    try:
        from urllib.parse import urlparse
        parsed = urlparse(target)
        backend_host = parsed.hostname or "localhost"
        backend_port = parsed.port or 80
        if _check_port_available(backend_host, backend_port):
            use_builtin_backend = True
    except Exception:
        pass

    print()
    print(f"  {_bold('Ag402 Gateway')} — Service Provider Mode")
    print("  " + "═" * 55)
    print()
    print(f"  {_yellow('⚠')} {_bold('Security Note')}: Sellers only need a PUBLIC receiving address.")
    print("     Ag402 gateway does NOT require any private key to operate.")
    print("     Never configure a private key for the seller/provider role.")
    print()

    try:
        import uvicorn
        from ag402_mcp.gateway import X402Gateway

        from ag402_core.gateway.auth import PaymentVerifier

        builtin_server = None
        if use_builtin_backend:
            # Start built-in demo API since the configured backend is not running
            from starlette.applications import Starlette
            from starlette.responses import JSONResponse as StarletteJSON
            from starlette.routing import Route

            async def _demo_api_handler(request):
                """Built-in demo API that returns sample data."""
                path = request.url.path
                params = dict(request.query_params)
                return StarletteJSON({
                    "service": "Ag402 Demo API",
                    "message": "This response was paid for via x402!",
                    "path": path,
                    "params": params,
                    "price": f"${price} USDC",
                })

            demo_app = Starlette(routes=[Route("/{path:path}", _demo_api_handler)])
            parsed = urlparse(target)
            backend_port_int = parsed.port or 8000
            demo_cfg = uvicorn.Config(
                demo_app, host="127.0.0.1", port=backend_port_int,
                log_level="error", lifespan="off",
            )
            builtin_server = uvicorn.Server(demo_cfg)
            builtin_server.install_signal_handlers = lambda: None

            import threading
            threading.Thread(target=builtin_server.run, daemon=True).start()
            # Wait for it to start
            for _ in range(30):
                time.sleep(0.1)
                if builtin_server.started:
                    break

            print(f"  {_yellow('⚠')} Backend {_cyan(target)} not running — auto-started built-in Demo API")
            print()

        print(f"  {_bold('Configuration')}")
        if use_builtin_backend:
            print(f"    Backend:    {_cyan(target)} {_dim('(built-in demo)')}")
        else:
            print(f"    Backend:    {_cyan(target)}")
        print(f"    Price:      {_green(f'${price} USDC')}/call")
        print(f"    Address:    {_dim(address[:20] + '...' if len(address) > 20 else address)}")
        print(f"    Port:       {_bold(str(port))}")
        print()

        verifier = PaymentVerifier()
        gateway = X402Gateway(
            target_url=target,
            price=price,
            chain="solana",
            token="USDC",
            address=address,
            verifier=verifier,
        )
        app = gateway.create_app()

        # Add pretty request logging middleware
        @app.middleware("http")
        async def _serve_log_middleware(request, call_next):
            _method = request.method
            _path = request.url.path
            _qs = str(request.url.query)
            _url = _path + (f"?{_qs}" if _qs else "")
            _client = request.client.host if request.client else "?"

            _t = time.monotonic()
            response = await call_next(request)
            _elapsed = time.monotonic() - _t

            sc = response.status_code
            if sc == 402:
                tag = _yellow("402 PAYMENT REQUIRED")
                icon = "💰"
            elif sc == 200:
                tag = _green("200 OK")
                icon = "✓"
            elif sc == 403:
                tag = _red("403 FORBIDDEN")
                icon = "✗"
            elif sc >= 500:
                tag = _red(f"{sc} ERROR")
                icon = "✗"
            else:
                tag = f"{sc}"
                icon = "·"
            print(f"  {icon} {_dim(_client)} {_bold(_method)} {_url} → {tag} {_dim(f'({_elapsed:.2f}s)')}")
            return response

        print(f"  {_green('✓')} Gateway started: {_cyan(f'http://{host}:{port}')}")
        print()
        print(f"  {_bold('Workflow')}")
        print(f"    Client → {_yellow('402 Payment Required')} → Client pays → Gateway verifies → {_green('200 OK')}")
        print()
        print("  " + "─" * 55)
        print(f"  {_bold('Try it')} (open another terminal):")
        print()
        gw_url = f"http://{'127.0.0.1' if host == '0.0.0.0' else host}:{port}/"
        print(f"    {_green('▶')} {_cyan('ag402 pay ' + gw_url)}")
        print(f"      {_dim('↑ Buyer view: discover price → pay → get data')}")
        print()
        print("  " + "─" * 55)
        print(f"  {_dim('Press Ctrl+C to stop')}")
        print()
        print(f"  {_bold('Request log:')}")
        print()

        # B1 FIX: Explicitly use loop="asyncio" to avoid uvloop + aiosqlite conflicts.
        # uvicorn auto-selects uvloop when installed, which breaks aiosqlite's
        # background thread connection mechanism.
        try:
            config = uvicorn.Config(app, host=host, port=port, log_level="warning", loop="asyncio")
            server = uvicorn.Server(config)
            asyncio.run(server.serve())
        finally:
            # Ensure built-in demo server stops cleanly on exit
            if builtin_server is not None:
                builtin_server.should_exit = True

    except ImportError:
        print(f"  {_red('✗')} Missing dependency: ag402-mcp")
        print("  → Run: pip install ag402-mcp")
        print()


def _cmd_upgrade() -> None:
    """Guide user through test → production migration."""
    import getpass

    from ag402_core.config import load_config
    from ag402_core.env_manager import save_env_file

    config = load_config()
    if not config.is_test_mode:
        print(f"\n  {_yellow('⚠')} Already in production mode\n")
        return

    print()
    print(_bold("  Ag402 — Upgrade to Production Mode"))
    print("  " + "─" * 40)
    print()
    print(f"  Current mode: {_yellow('TEST')}")
    print()
    print("  Switching to production mode requires:")
    print("  1. A Solana wallet (private key)")
    print("  2. Some USDC deposited (recommended $5-10 to start)")
    print()

    confirm = input("  Continue? [Y/n] ").strip().lower()
    if confirm and confirm != "y":
        print(f"\n  {_yellow('⚠')} Cancelled\n")
        return

    print()
    private_key = getpass.getpass("  Enter Solana private key (base58): ")
    if not private_key.strip():
        print(f"\n  {_red('✗')} No private key provided\n")
        return

    # Encrypt the key — REQUIRED for production mode
    key_saved = False
    try:
        from ag402_core.security.wallet_encryption import (
            encrypt_private_key,
            save_encrypted_wallet,
        )

        password = getpass.getpass("  Set wallet password (min 8 chars): ")
        if len(password) < 8:
            print(f"\n  {_red('✗')} Password must be at least 8 characters\n")
            return
        password2 = getpass.getpass("  Confirm password: ")
        if password != password2:
            print(f"\n  {_red('✗')} Passwords do not match\n")
            return

        encrypted = encrypt_private_key(password, private_key)
        wallet_path = os.path.expanduser("~/.ag402/wallet.key")
        save_encrypted_wallet(wallet_path, encrypted)
        print(f"  {_green('✓')} Private key encrypted and saved: {wallet_path}")
        key_saved = True
    except ImportError:
        print(f"\n  {_red('✗')} cryptography package is required for production mode")
        print("  → Run: pip install cryptography")
        print()
        return

    if not key_saved:
        print(f"\n  {_red('✗')} Private key was not saved. Aborting upgrade.\n")
        return

    # Set daily limit
    raw_limit = input("\n  Set daily spending limit: [$10] ").strip()
    try:
        daily_limit = float(raw_limit) if raw_limit else 10.0
    except ValueError:
        print(f"  {_yellow('⚠')} Invalid number '{raw_limit}', using default $10.00")
        daily_limit = 10.0
    daily_limit = min(daily_limit, 1000.0)
    print(f"  {_green('✓')} Daily limit: ${daily_limit:.2f}")

    # Save to .env (private key is in encrypted wallet.key, NOT in .env)
    env_entries = {
        "X402_MODE": "production",
        "X402_NETWORK": "mainnet",
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com",
        "USDC_MINT_ADDRESS": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "X402_DAILY_LIMIT": str(daily_limit),
    }
    save_env_file(env_entries, merge=True)

    print()
    print(f"  {_green('✓')} Production mode enabled!")
    print(f"  {_yellow('⚠')} Reminder: This is a hot wallet. Only deposit small amounts.")
    print()


# ─── Original Commands ───────────────────────────────────────────────────


async def _probe_rpc(rpc_url: str, timeout: float = 5.0) -> bool:
    """Return True if the RPC endpoint responds to a basic health probe."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                rpc_url,
                json={"jsonrpc": "2.0", "id": 1, "method": "getHealth"},
                headers={"Content-Type": "application/json"},
            )
            return resp.status_code < 500
    except Exception:
        return False


async def _cmd_init(db_path: str) -> None:
    from ag402_core.config import load_config
    from ag402_core.wallet.agent_wallet import AgentWallet

    config = load_config()
    is_test = config.is_test_mode

    _print_banner()

    print(f"  [INIT] Creating wallet at {_cyan(db_path)} ... ", end="", flush=True)
    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()
    print(_green("✓"))

    mode_str = _yellow("TEST") + " (no real money, safe to experiment)" if is_test else _red("PRODUCTION")
    print(f"  [INIT] Mode: {mode_str}")

    # Auto-deposit test funds
    if is_test:
        balance = float(await wallet.get_balance())
        if balance == 0:
            await wallet.deposit(100.0, note="Test mode auto-fund")
            print(f"  [INIT] Depositing {_green('$100.00')} test funds ... {_green('✓')}")
        else:
            print(f"  [INIT] Wallet already funded: ${balance:.2f}")

    balance = float(await wallet.get_balance())
    daily = float(await wallet.get_daily_spend())

    print()
    print("  ┌─────────────── Wallet Status ───────────────┐")
    print(f"  │  Balance:       {_green(f'${balance:.4f}'):>37s}│")
    print(f"  │  Daily Limit:   ${config.daily_spend_limit:.2f} (used: ${daily:.2f})      │")
    print(f"  │  Per-Minute:    ${config.per_minute_limit:.2f} / {config.per_minute_count} txns             │")
    print(f"  │  Network:       {'solana-devnet (mock)' if is_test else config.effective_rpc_url[:25]:25s}│")
    print(f"  │  Security:      {_green('6 layers active ✓'):>37s}│")
    print("  └─────────────────────────────────────────────┘")
    print()

    # Connectivity probe (production only — test mode uses mock, no RPC needed)
    if not is_test:
        print("  [INIT] Checking RPC connectivity ... ", end="", flush=True)
        rpc_ok = await _probe_rpc(config.effective_rpc_url)
        if rpc_ok:
            print(_green("✓"))
        else:
            print(_yellow("⚠ unreachable"))
            print(f"  {_yellow('⚠')} Cannot reach {config.effective_rpc_url}")
            print("  → Payments will fail until the RPC is reachable.")
            print("  → Check your network, or run `ag402 doctor` for diagnosis.")
            print()

    print(f"  Next: Run {_cyan('ag402 demo')} to see an AI agent auto-pay for an API call!")
    print(f"        Run {_cyan('ag402 status')} to view the full dashboard.")
    print()

    await wallet.close()


async def _cmd_status() -> None:
    from ag402_core.config import MAX_SINGLE_TX, load_config
    from ag402_core.wallet.agent_wallet import AgentWallet

    config = load_config()
    is_test = config.is_test_mode
    db_path = config.wallet_db_path
    daily_limit = config.daily_spend_limit

    print()
    print(_bold("  Ag402 Status Dashboard"))
    print("  " + "═" * 50)
    print()

    mode_str = _yellow("TEST 🧪") + " (safe, no real funds)" if is_test else _red("PRODUCTION")
    print(f"  Mode:        {mode_str}")
    print(f"  Network:     {_dim(str(config.network.value))}")
    print(f"  Wallet:      {_dim(db_path)}")

    if not os.path.exists(db_path):
        print()
        print(f"  {_yellow('⚠')}  Wallet not initialized. Run: {_cyan('ag402 init')}")
        print()
        return

    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()

    balance = float(await wallet.get_balance())
    daily = float(await wallet.get_daily_spend())
    minute = float(await wallet.get_minute_spend())
    minute_count = await wallet.get_minute_count()

    # On-chain balance (production mode with private key)
    if not is_test and config.solana_private_key:
        try:
            from ag402_core.payment.registry import PaymentProviderRegistry
            provider = PaymentProviderRegistry.get_provider(config=config)
            on_chain = await provider.check_balance()
            print(f"  On-chain:    {_green(f'${on_chain:.4f} USDC')}  {_dim(f'({config.effective_rpc_url})')}")
        except Exception as exc:
            print(f"  On-chain:    {_red('unavailable')}  {_dim(str(exc)[:60])}")
    elif not is_test:
        print(f"  On-chain:    {_yellow('no private key')}  {_dim('set SOLANA_PRIVATE_KEY to query')}")

    bal_label = "Ledger" if not is_test else "Balance"
    bal_suffix = _dim("  (local bookkeeping)") if not is_test else ""
    print(f"  {bal_label}:      {_green(f'${balance:.4f}')}{bal_suffix}")
    print()

    # Budget bars
    print(f"  Daily Budget    {_bar(daily, daily_limit)}  ${daily:.2f} / ${daily_limit:.2f}")
    print(f"  Minute Budget   {_bar(minute, config.per_minute_limit)}  ${minute:.2f} / ${config.per_minute_limit:.2f}")
    print(f"  Minute TXs      {_bar(minute_count, config.per_minute_count)}  {minute_count} / {config.per_minute_count}")
    print()

    # Security layers (config only — runtime circuit breaker state lives in the gateway process)
    print("  Security Layers:")
    print(f"    {_green('✓')}  Single-TX cap:        ${MAX_SINGLE_TX:.2f}")
    print(f"    {_green('✓')}  Per-minute cap:       ${config.per_minute_limit:.2f} / {config.per_minute_count} txns")
    print(f"    {_green('✓')}  Daily cap:            ${daily_limit:.2f}")
    print(f"    {_green('✓')}  Circuit breaker:      threshold={config.circuit_breaker_threshold}, cooldown={config.circuit_breaker_cooldown}s")
    print(f"    {_green('✓')}  Replay guard:         Active ({config.replay_window_seconds}s window)")
    print(f"    {_green('✓')}  Private key filter:   Active")
    print()

    # Recent transactions
    txs = await wallet.get_transactions(limit=5)
    if txs:
        print("  Recent Transactions (last 5):")
        for tx in txs:
            sign = "+" if tx.type == "deposit" else "-"
            color = "32" if tx.type == "deposit" else "31"
            addr = _short_addr(tx.to_address) if tx.to_address else "(faucet)" if tx.type == "deposit" else "-"
            ago = _time_ago(tx.timestamp)
            print(f"    {_c(color, f'{sign}${tx.amount:.4f}'):>20s}  {tx.type:<12s} → {addr:<25s} {_dim(ago)}")
    else:
        print(f"  No transactions yet. Run {_cyan('ag402 demo')} to create some!")
    print()

    await wallet.close()


async def _cmd_balance(db_path: str) -> None:
    from ag402_core.config import load_config
    from ag402_core.wallet.agent_wallet import AgentWallet

    config = load_config()
    daily_limit = config.daily_spend_limit
    is_production = not config.is_test_mode

    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()
    balance = float(await wallet.get_balance())
    daily = float(await wallet.get_daily_spend())
    minute = float(await wallet.get_minute_spend())

    print()

    # On-chain balance (production mode with private key)
    if is_production and config.solana_private_key:
        try:
            from ag402_core.payment.registry import PaymentProviderRegistry
            provider = PaymentProviderRegistry.get_provider(config=config)
            on_chain = await provider.check_balance()
            print(f"  On-chain:     {_green(f'${on_chain:.4f} USDC')}  {_dim(f'({config.effective_rpc_url})')}")
        except Exception as exc:
            print(f"  On-chain:     {_red('unavailable')}  {_dim(str(exc)[:60])}")
    elif is_production:
        print(f"  On-chain:     {_yellow('no private key')}  {_dim('set SOLANA_PRIVATE_KEY to query')}")

    bal_label = "Ledger" if is_production else "Balance"
    bal_suffix = _dim("  (local bookkeeping)") if is_production else ""
    print(f"  {bal_label}:      {_green(f'${balance:.4f}')}{bal_suffix}")
    print(f"  Daily spend:  {_bar(daily, daily_limit)}  ${daily:.4f} / ${daily_limit:.2f}")
    print(f"  Minute spend: {_bar(minute, config.per_minute_limit)}  ${minute:.4f} / ${config.per_minute_limit:.2f}")
    print()

    await wallet.close()


async def _cmd_history(db_path: str, limit: int, fmt: str, output: str) -> None:
    from ag402_core.wallet.agent_wallet import AgentWallet

    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()

    if fmt in ("json", "csv") and output:
        await wallet.export_history(output, format=fmt)
        print(f"  {_green('✓')} Exported {fmt.upper()} to: {output}")
        await wallet.close()
        return

    txs = await wallet.get_transactions(limit=limit)
    if not txs:
        print()
        print(f"  No transactions yet. Run {_cyan('ag402 demo')} to create some!")
        print()
        await wallet.close()
        return

    print()
    print(_bold("  Transaction History"))
    print("  " + "─" * 70)
    print(f"  {'':>2} {'Amount':>10}  {'Type':<12} {'Status':<12} {'Address':<25} {'When'}")
    print(f"  {'':>2} {'------':>10}  {'----':<12} {'------':<12} {'-------':<25} {'----'}")
    for tx in txs:
        sign = "+" if tx.type == "deposit" else "-"
        color = "32" if tx.type == "deposit" else "31"
        addr = _short_addr(tx.to_address) if tx.to_address else "-"
        ago = _time_ago(tx.timestamp)
        print(f"  {_c(color, f'{sign}${tx.amount:>9.4f}')}  {tx.type:<12} {tx.status:<12} {addr:<25} {_dim(ago)}")

    # Summary stats
    stats = await wallet.get_summary_stats()
    by_addr = await wallet.get_spend_by_address()

    print()
    print("  ─── Summary ───")
    bal = stats["balance"]
    today = stats["today_spend"]
    total = stats["total_spend"]
    count = stats["tx_count"]
    print(f"  Balance:     {_green(f'${bal:.4f}')}")
    print(f"  Today spend: ${today:.4f}")
    print(f"  Total spend: ${total:.4f}")
    print(f"  TX count:    {count}")

    if by_addr:
        print()
        print("  ─── Spend by Address ───")
        for addr, total in sorted(by_addr.items(), key=lambda x: -x[1]):
            print(f"    ${total:>9.4f}  {_short_addr(addr)}")

    print()
    await wallet.close()


async def _cmd_tx(db_path: str, tx_id: str) -> None:
    from ag402_core.wallet.agent_wallet import AgentWallet

    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()

    matches = await wallet.find_transactions_by_prefix(tx_id)

    if not matches:
        print(f"\n  {_red('✗')} Transaction not found: {tx_id}\n")
        await wallet.close()
        return

    tx = matches[0]
    ts_str = datetime.fromtimestamp(tx.timestamp, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    color = "32" if tx.type == "deposit" else "31"

    print()
    print(_bold("  Transaction Detail"))
    print("  " + "═" * 50)
    print(f"  ID:          {_cyan(tx.id)}")
    print(f"  Type:        {tx.type}")
    print(f"  Amount:      {_c(color, f'${tx.amount:.4f}')}")
    print(f"  Status:      {_green(tx.status) if tx.status == 'confirmed' else _yellow(tx.status)}")
    print(f"  To Address:  {tx.to_address or '-'}")
    print(f"  TX Hash:     {tx.tx_hash or '-'}")
    print(f"  Timestamp:   {ts_str} ({_time_ago(tx.timestamp)})")
    if tx.note:
        print(f"  Note:        {tx.note}")
    print()

    await wallet.close()


def _cmd_config() -> None:
    from ag402_core.config import (
        MAX_DAILY_SPEND_HARD_CEILING,
        MAX_SINGLE_TX,
        load_config,
    )

    config = load_config()
    is_test = config.is_test_mode

    print()
    print(_bold("  Ag402 Safety Configuration"))
    print("  " + "═" * 45)
    print()

    mode_str = _yellow("TEST") if is_test else _red("PRODUCTION")
    print(f"  Mode:                      {mode_str}")
    print()
    print("  ─── Budget Limits ───")
    print(f"  MAX_SINGLE_TX (hard):      ${MAX_SINGLE_TX:.2f}")
    print(f"  single_tx_limit (config):  ${config.single_tx_limit:.2f}")
    print(f"  daily_limit (env):         ${config.daily_spend_limit:.2f}  (hard ceiling: ${MAX_DAILY_SPEND_HARD_CEILING:.2f})")
    print(f"  per_minute_limit (env):    ${config.per_minute_limit:.2f}")
    print(f"  per_minute_count (env):    {config.per_minute_count}")
    print()
    print("  ─── Circuit Breaker ───")
    print(f"  threshold (env):           {config.circuit_breaker_threshold} failures")
    print(f"  cooldown (env):            {config.circuit_breaker_cooldown}s")
    print()
    print("  ─── Environment Variables ───")
    print("  X402_DAILY_LIMIT                 daily spend cap (default: $10)")
    print("  X402_PER_MINUTE_LIMIT            per-minute $ cap (default: $2)")
    print("  X402_PER_MINUTE_COUNT            per-minute TX count (default: 5)")
    print("  X402_CIRCUIT_BREAKER_THRESHOLD   failure threshold (default: 3)")
    print("  X402_CIRCUIT_BREAKER_COOLDOWN    cooldown seconds (default: 60)")
    print("  AG402_UNLOCK_PASSWORD         wallet unlock password (Docker)")
    print()
    print("  ─── Paths & Network ───")
    print(f"  wallet_db_path:            {config.wallet_db_path}")
    print(f"  solana_rpc_url:            {config.effective_rpc_url}")
    if config.solana_rpc_backup_url:
        print(f"  solana_rpc_backup_url:     {config.solana_rpc_backup_url}")
    print()
    print("  ─── Trust ───")
    if config.trusted_addresses:
        print(f"  trusted_addresses:         {config.trusted_addresses}")
    else:
        print("  trusted_addresses:         (any)")
    if config.fallback_api_key:
        print(f"  fallback_api_key:          {'*' * 8}...{config.fallback_api_key[-4:]}")
    print()


def _cmd_info() -> None:
    from open402.negotiation import CURRENT_VERSION
    from open402.spec import get_json_schema

    from ag402_core import __version__

    print()
    print(_bold("  Ag402 Protocol Info"))
    print(_dim("  Powered by the Open402 standard"))
    print("  " + "═" * 40)
    print(f"  ag402-core:    v{__version__}")
    print(f"  open402:          v{CURRENT_VERSION}")
    print(f"  Python:           {platform.python_version()}")
    print(f"  Platform:         {platform.system()} {platform.machine()}")
    print()
    print("  JSON Schema:")
    schema_str = json.dumps(get_json_schema(), indent=2)
    for line in schema_str.split("\n"):
        print(f"    {line}")
    print()


def _cmd_doctor() -> None:
    from ag402_core.config import load_config

    config = load_config()
    issues = []
    warnings = []

    print()
    print(_bold("  Ag402 Doctor — Environment Check"))
    print("  " + "═" * 45)
    print()

    # Python version
    py_ver = platform.python_version()
    py_ok = sys.version_info >= (3, 10)
    print(f"  {_green('✓') if py_ok else _red('✗')}  Python {py_ver}" +
          ("" if py_ok else " (requires >= 3.10)"))
    if not py_ok:
        issues.append("Python >= 3.10 required")

    # Core package
    try:
        from ag402_core import __version__
        print(f"  {_green('✓')}  ag402-core {__version__}")
    except ImportError:
        print(f"  {_red('✗')}  ag402-core NOT installed")
        issues.append("ag402-core not installed")

    # Protocol package
    try:
        import open402
        ver = getattr(open402, "__version__", "installed")
        print(f"  {_green('✓')}  open402 {ver}")
    except ImportError:
        print(f"  {_red('✗')}  open402 NOT installed")
        issues.append("open402 not installed")

    # cryptography
    try:
        import cryptography
        print(f"  {_green('✓')}  cryptography {cryptography.__version__}")
    except ImportError:
        print(f"  {_yellow('⚠')}  cryptography NOT installed (wallet encryption unavailable)")
        warnings.append("cryptography not installed")

    # httpx
    try:
        import httpx
        print(f"  {_green('✓')}  httpx {httpx.__version__}")
    except ImportError:
        print(f"  {_red('✗')}  httpx NOT installed")
        issues.append("httpx not installed")

    # aiosqlite
    try:
        import aiosqlite
        print(f"  {_green('✓')}  aiosqlite {aiosqlite.__version__}")
    except ImportError:
        print(f"  {_red('✗')}  aiosqlite NOT installed")
        issues.append("aiosqlite not installed")

    # Solana dependencies (optional)
    try:
        import solana  # noqa: F401
        import solders  # noqa: F401
        print(f"  {_green('✓')}  Solana dependencies installed")
    except ImportError:
        if config.is_test_mode:
            print(f"  {_yellow('⚠')}  Solana dependencies: NOT installed (ok for test mode)")
            warnings.append("Solana deps not installed (ok for test)")
        else:
            print(f"  {_red('✗')}  Solana dependencies: NOT installed (required for production)")
            issues.append("Solana deps required for production: pip install 'ag402-core[crypto]'")

    # Solana CLI tools
    import shutil as _doc_shutil
    solana_cli = _doc_shutil.which("solana")
    if solana_cli:
        print(f"  {_green('✓')}  Solana CLI: {solana_cli}")
    else:
        print(f"  {_yellow('⚠')}  Solana CLI: not found (optional, needed for localnet)")
        warnings.append("Solana CLI not installed (optional)")

    test_validator = _doc_shutil.which("solana-test-validator")
    if test_validator:
        print(f"  {_green('✓')}  solana-test-validator: {test_validator}")
    else:
        print(f"  {_yellow('⚠')}  solana-test-validator: not found (optional, needed for localnet)")
        warnings.append("solana-test-validator not installed (optional)")

    # Check if localnet validator is running
    if test_validator or _check_localnet_ready():
        if _check_localnet_ready():
            print(f"  {_green('✓')}  Local validator: running on port 8899")
        else:
            print(f"  {_dim('·')}  Local validator: not running (start with: solana-test-validator --reset)")

    print()

    # Wallet DB
    db_path = config.wallet_db_path
    if os.path.exists(db_path):
        size_kb = os.path.getsize(db_path) / 1024
        print(f"  {_green('✓')}  Wallet DB exists: {db_path} ({size_kb:.1f} KB)")
    else:
        print(f"  {_yellow('⚠')}  Wallet DB not found: {db_path}")
        warnings.append("Wallet not initialized — run: ag402 init")

    # Encrypted wallet
    enc_path = config.encrypted_wallet_path
    if os.path.exists(enc_path):
        print(f"  {_green('✓')}  Encrypted wallet found: {enc_path}")
    else:
        print(f"  {_yellow('⚠')}  Encrypted wallet not found: {enc_path}")

    # Mode
    mode_str = _yellow("TEST") if config.is_test_mode else _red("PRODUCTION")
    print(f"  {_green('✓')}  Mode: {mode_str}")

    # Private key
    if config.solana_private_key:
        print(f"  {_green('✓')}  SOLANA_PRIVATE_KEY: set")
    else:
        if not config.is_test_mode:
            print(f"  {_red('✗')}  SOLANA_PRIVATE_KEY: not set (required for production)")
            issues.append("SOLANA_PRIVATE_KEY not set")
        else:
            print(f"  {_yellow('⚠')}  SOLANA_PRIVATE_KEY: not set (ok for test mode)")
            warnings.append("No private key (ok for test)")

    print()

    # --- Gateway runtime checks ---
    print(f"  {_bold('Gateway Environment')}")
    print()

    # 1. Default gateway port bindability
    gw_port = config.gateway_port
    try:
        if _check_port_available("0.0.0.0", gw_port):
            print(f"  {_green('✓')}  Gateway port {gw_port}: available")
        else:
            print(f"  {_yellow('⚠')}  Gateway port {gw_port}: already in use")
            warnings.append(f"Port {gw_port} in use (gateway may fail to start)")
    except Exception:
        print(f"  {_yellow('⚠')}  Gateway port {gw_port}: unable to check")
        warnings.append(f"Could not check port {gw_port}")

    # 2. SQLite data directory writability
    _ag402_dir = os.path.expanduser("~/.ag402")
    if os.path.isdir(_ag402_dir):
        if os.access(_ag402_dir, os.W_OK):
            print(f"  {_green('✓')}  Data directory writable: {_ag402_dir}")
        else:
            print(f"  {_red('✗')}  Data directory NOT writable: {_ag402_dir}")
            issues.append("~/.ag402 is not writable (SQLite will fail)")
    else:
        print(f"  {_yellow('⚠')}  Data directory does not exist: {_ag402_dir}")
        warnings.append("~/.ag402 not created yet — run: ag402 init")

    # 3. Backend target URL reachability (if configured)
    from ag402_core.env_manager import parse_env_file as _doc_parse_env
    _doc_env = _doc_parse_env()
    _doc_target = _doc_env.get("AG402_TARGET_API", "")
    if _doc_target:
        try:
            from urllib.parse import urlparse
            _parsed = urlparse(_doc_target)
            _thost = _parsed.hostname or "localhost"
            _tport = _parsed.port or 80
            if not _check_port_available(_thost, _tport):
                print(f"  {_green('✓')}  Backend reachable: {_doc_target}")
            else:
                print(f"  {_yellow('⚠')}  Backend unreachable: {_doc_target}")
                warnings.append(f"Backend {_doc_target} is not responding")
        except Exception:
            print(f"  {_yellow('⚠')}  Backend check failed: {_doc_target}")
            warnings.append(f"Could not check backend {_doc_target}")
    else:
        print(f"  {_dim('·')}  Backend URL: not configured (set AG402_TARGET_API in .env)")

    print()

    # Summary
    total_issues = len(issues)
    total_warnings = len(warnings)
    if total_issues == 0:
        status = _green("HEALTHY ✓")
        if total_warnings > 0:
            status += f" ({total_warnings} warning{'s' if total_warnings > 1 else ''})"
        print(f"  Overall: {status}")
    else:
        print(f"  Overall: {_red('UNHEALTHY ✗')} ({total_issues} issue{'s' if total_issues > 1 else ''}, {total_warnings} warning{'s' if total_warnings > 1 else ''})")
        print()
        for issue in issues:
            print(f"    {_red('✗')} {issue}")

    print()


async def _cmd_pay(url: str, method: str, db_path: str) -> None:
    """Send a single HTTP request with automatic x402 payment.

    Manually performs each protocol step (instead of using middleware)
    so we can display the full negotiation flow to the user.
    """
    import httpx
    from open402.headers import build_authorization, parse_www_authenticate
    from open402.negotiation import get_version_header
    from open402.spec import X402PaymentProof

    from ag402_core.config import load_config
    from ag402_core.payment.registry import PaymentProviderRegistry
    from ag402_core.security.challenge_validator import validate_url_safety
    from ag402_core.security.replay_guard import generate_replay_headers
    from ag402_core.wallet.agent_wallet import AgentWallet

    config = load_config()

    # SSRF protection: validate URL before making any outbound request.
    # allow_localhost=True in test mode so `ag402 pay http://localhost:8001/…` works.
    url_check = validate_url_safety(url, allow_localhost=config.is_test_mode)
    if not url_check.valid:
        print(f"\n  {_red('✗')} Blocked: {url_check.error}")
        print(f"  {_dim('Only HTTPS URLs to public hosts are allowed.')}\n")
        return

    mode_str = _yellow("TEST") if config.is_test_mode else _green("LIVE")

    print()
    print(f"  {_bold('Ag402 Pay')} — Buyer-side single request ({mode_str})")
    print("  " + "═" * 55)
    print()

    # ── Step 1: Wallet ──
    print(f"  {_bold('① Wallet')}")
    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()

    provider = PaymentProviderRegistry.get_provider(config=config)

    # Balance pre-check: use on-chain balance in production, local ledger in test
    is_production = not config.is_test_mode
    if is_production and config.solana_private_key:
        try:
            balance_before = await provider.check_balance()
        except Exception as rpc_err:
            print(f"     {_red('✗')} Cannot query on-chain balance: {_dim(str(rpc_err)[:80])}")
            print(f"     → Check your RPC URL: {_cyan('ag402 config')}")
            print()
            await wallet.close()
            return
    else:
        balance_before = float(await wallet.get_balance())

    if balance_before < 0.01:
        source = "on-chain" if is_production else "ledger"
        print(f"     {_red('✗')} Insufficient {source} balance: ${balance_before:.4f}")
        if is_production:
            print(f"     → Fund your wallet with USDC on {config.network.value}")
        else:
            print(f"     → Run {_cyan('ag402 setup')} to add test funds")
        print()
        await wallet.close()
        return

    label = "On-chain" if is_production else "Balance"
    print(f"     {label}: {_green(f'${balance_before:.4f}')}")
    print()

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # ── Step 2: First request ──
            print(f"  {_bold('② Request')}")
            print(f"     {_cyan(method)} {url}")

            req_headers: dict[str, str] = {}
            req_headers.update(get_version_header())
            req_headers.update(generate_replay_headers())

            t0 = time.monotonic()
            response = await client.request(method.upper(), url, headers=req_headers)
            t1 = time.monotonic()

            if response.status_code != 402:
                # Not a paid API — show result directly
                elapsed = t1 - t0
                print(f"     Response: {_green(str(response.status_code))} ({elapsed:.2f}s)")
                print()
                print(f"  {_dim('This API did not require payment (non-x402), returned result directly.')}")
                _print_response_body(response.content, response.status_code)
                await wallet.close()
                print()
                return

            # ── Step 3: 402 received — show challenge ──
            print(f"     Response: {_yellow('402 Payment Required')} ({t1 - t0:.2f}s)")
            print()

            print(f"  {_bold('③ Payment Challenge')}  {_dim('← Server 402 response')}")
            www_auth = response.headers.get("www-authenticate", "")
            challenge = parse_www_authenticate(www_auth)

            if challenge is None:
                print(f"     {_red('✗')} Non-standard 402 response (not x402), cannot auto-pay")
                await wallet.close()
                print()
                return

            print("     Protocol: x402")
            print(f"     Chain:    {_cyan(challenge.chain)}")
            print(f"     Token:    {challenge.token}")
            print(f"     Amount:   {_green(f'${challenge.amount} {challenge.token}')}")
            print(f"     Payee:    {_dim(challenge.address[:24])}...")
            print()

            amount = challenge.amount_float

            # ── Step 4: Pay ──
            print(f"  {_bold('④ Auto-Pay')}  {_dim('← Wallet deduction + on-chain transfer')}")

            deduction_tx = None

            if is_production:
                # Production: pay on-chain first, then record in local ledger
                pay_result = await provider.pay(
                    to_address=challenge.address,
                    amount=amount,
                    token=challenge.token,
                )

                if not pay_result.success:
                    print(f"     {_red('✗')} On-chain payment failed: {pay_result.error}")
                    await wallet.close()
                    print()
                    return

                # Record in local ledger for audit trail (best-effort)
                try:
                    # Ensure ledger has enough balance to record the deduction
                    ledger_bal = float(await wallet.get_balance())
                    if ledger_bal < amount:
                        await wallet.deposit(
                            amount - ledger_bal + 0.01,
                            note=f"Auto-sync from on-chain (tx {pay_result.tx_hash[:16]})",
                        )
                    deduction_tx = await wallet.deduct(
                        amount=amount,
                        to_address=challenge.address,
                        tx_hash=pay_result.tx_hash,
                    )
                except Exception as ledger_err:
                    print(f"     {_yellow('⚠')} Ledger recording skipped: {_dim(str(ledger_err)[:60])}")
            else:
                # Test mode: deduct from local ledger first, then mock-pay
                deduction_tx = await wallet.deduct(
                    amount=amount,
                    to_address=challenge.address,
                )

                pay_result = await provider.pay(
                    to_address=challenge.address,
                    amount=amount,
                    token=challenge.token,
                )

                if not pay_result.success:
                    print(f"     {_red('✗')} On-chain payment failed: {pay_result.error}")
                    await wallet.rollback(deduction_tx.id)
                    print(f"     {_yellow('↩')} Wallet deduction rolled back")
                    await wallet.close()
                    print()
                    return

            print(f"     TX Hash:  {_cyan(pay_result.tx_hash[:44])}")
            print(f"     Amount:   {_green(f'${amount:.4f} {challenge.token}')}")
            print(f"     Status:   {_green('✓ Success')}")
            print()

            # ── Step 5: Retry with proof ──
            print(f"  {_bold('⑤ Retry with Proof')}  {_dim('← Send payment proof, get data')}")

            proof = X402PaymentProof(
                tx_hash=pay_result.tx_hash,
                chain=challenge.chain,
                payer_address=provider.get_address(),
            )
            retry_headers = dict(req_headers)
            retry_headers["Authorization"] = build_authorization(proof)

            t2 = time.monotonic()
            retry_response = await client.request(method.upper(), url, headers=retry_headers)
            t3 = time.monotonic()

            status_code = retry_response.status_code
            if status_code == 200:
                status_display = _green(f"{status_code} OK")
            elif status_code >= 500:
                status_display = _red(f"{status_code} Server Error")
            elif status_code >= 400:
                status_display = _yellow(f"{status_code}")
            else:
                status_display = f"{status_code}"

            print(f"     Response: {status_display} ({t3 - t2:.2f}s)")

            if retry_response.status_code >= 400:
                # Retry failed — rollback local ledger if applicable
                if not is_production and deduction_tx:
                    await wallet.rollback(deduction_tx.id)
                    print(f"     {_yellow('↩')} Server returned error, auto-refunded")
                elif is_production:
                    print(f"     {_yellow('⚠')} Server returned error (on-chain payment already sent)")
            else:
                # Update deduction with tx_hash
                pass

            # Show response body
            _print_response_body(retry_response.content, retry_response.status_code)

            # ── Step 6: Balance summary ──
            if is_production and config.solana_private_key:
                try:
                    final = await provider.check_balance()
                except Exception:
                    final = balance_before - amount  # best estimate
            else:
                final = float(await wallet.get_balance())
            spent = balance_before - final
            elapsed = t3 - t0

            print()
            print(f"  {_bold('⑥ Settlement')}")
            print(f"     Total time: {elapsed:.2f}s (negotiate + pay + fetch)")
            print(f"     Balance:    ${balance_before:.4f} → {_green(f'${final:.4f}')}", end="")
            if spent > 0:
                print(f"  ({_red(f'-${spent:.4f}')})")
            elif spent < 0:
                print(f"  ({_green(f'+${abs(spent):.4f}')} refunded)")
            else:
                print("  (no change)")

        except httpx.ConnectError:
            print(f"\n     {_red('✗')} Cannot connect to {url}")
            print(f"     {_dim('Make sure the target service is running')}")
            print(f"     {_dim('Tip: Start a demo gateway with')} {_cyan('ag402 serve')}")
        except httpx.TimeoutException:
            print(f"\n     {_red('✗')} Request timed out for {url}")
            print(f"     {_dim('The server did not respond within 30 seconds')}")
            print(f"     {_dim('If using devnet, try localnet:')} {_cyan('ag402 demo --localnet')}")
        except Exception as exc:
            exc_str = str(exc).lower()
            # Truncate error messages to avoid leaking RPC API keys or sensitive data
            safe_err = str(exc)[:120]
            if "rpc" in exc_str or "solana" in exc_str:
                print(f"\n  {_red('✗')} Solana RPC error: {safe_err}")
                print(f"  {_yellow('⚠')} Suggestions:")
                print("     1. Check your network connection")
                print(f"     2. Use localnet: {_cyan('ag402 demo --localnet')}")
                print(f"     3. Check RPC URL: {_cyan('ag402 config')}")
            elif "timeout" in exc_str or "timed out" in exc_str:
                print(f"\n  {_red('✗')} Operation timed out: {safe_err}")
                print(f"  {_yellow('⚠')} The transaction may still succeed on-chain")
                print(f"     Check with: {_cyan('ag402 history')}")
            else:
                print(f"\n  {_red('✗')} Request failed: {safe_err}")
        finally:
            await wallet.close()

    print()
    print("  " + "═" * 55)
    print(f"  {_dim('Use')} {_cyan('ag402 history')} {_dim('to view all transactions')}")
    print()


def _print_response_body(body: bytes, status_code: int) -> None:
    """Pretty-print response body (JSON or text), used by _cmd_pay."""
    if status_code != 200 or not body:
        if status_code >= 500:
            print(f"     {_yellow('Hint')}: Backend returned an error — check if the backend is running")
        return

    body_str = body.decode("utf-8", errors="replace")

    # Try JSON first
    try:
        body_json = json.loads(body_str)
        body_display = json.dumps(body_json, indent=2, ensure_ascii=False)
        lines = body_display.split("\n")
        if len(lines) > 10:
            lines = lines[:10] + [f"... ({len(lines) - 10} more lines)"]
        print("     Response Body (JSON):")
        for line in lines:
            print(f"       {_dim(line)}")
        return
    except (json.JSONDecodeError, TypeError):
        pass

    # Plain text / HTML
    lines = body_str.strip().split("\n")
    total = len(lines)
    show = min(total, 6)
    print(f"     Response Body ({total} lines):")
    for line in lines[:show]:
        print(f"       {_dim(line.rstrip()[:80])}")
    if total > show:
        print(f"       {_dim(f'... {total - show} more lines omitted')}")


# ─── Demo mode helpers ────────────────────────────────────────────────────


def _resolve_demo_mode(args) -> str:
    """Resolve the demo mode from CLI args (shortcut flags take priority)."""
    if getattr(args, "localnet", False):
        return "localnet"
    if getattr(args, "devnet", False):
        return "devnet"
    return getattr(args, "mode", "mock")


def _check_localnet_ready() -> bool:
    """Check if solana-test-validator is running on port 8899."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex(("127.0.0.1", 8899)) == 0


def _check_devnet_ready() -> bool:
    """Check if Solana devnet RPC is reachable."""
    try:
        import httpx
        resp = httpx.post(
            "https://api.devnet.solana.com",
            json={"jsonrpc": "2.0", "id": 1, "method": "getHealth"},
            timeout=5.0,
        )
        return resp.status_code == 200
    except Exception:
        return False


async def _setup_localnet_accounts():
    """Set up localnet accounts: airdrop SOL, create USDC mint, mint tokens.

    Returns (buyer_private_key_b58, seller_pubkey, test_usdc_mint_str, rpc_url).
    """
    import base58 as b58
    from solana.rpc.api import Client as SyncClient
    from solders.keypair import Keypair
    from spl.token.client import Token as SyncToken
    from spl.token.constants import TOKEN_PROGRAM_ID
    from spl.token.instructions import get_associated_token_address

    rpc_url = "http://127.0.0.1:8899"
    client = SyncClient(rpc_url, timeout=30, commitment="confirmed")

    buyer_kp = Keypair()
    seller_kp = Keypair()

    print(f"     Buyer:  {str(buyer_kp.pubkey())[:20]}...")
    print(f"     Seller: {str(seller_kp.pubkey())[:20]}...")

    # Airdrop SOL
    print("     Airdropping SOL ... ", end="", flush=True)
    client.request_airdrop(buyer_kp.pubkey(), int(100 * 1e9))
    client.request_airdrop(seller_kp.pubkey(), int(10 * 1e9))
    # Wait for balance
    for _ in range(60):
        time.sleep(0.5)
        bal = client.get_balance(buyer_kp.pubkey(), commitment="confirmed")
        if bal.value > 0:
            break
    print(_green("✓"))

    # Create USDC-like mint
    print("     Creating test USDC mint ... ", end="", flush=True)
    token = SyncToken.create_mint(
        conn=client, payer=buyer_kp,
        mint_authority=buyer_kp.pubkey(), decimals=6,
        program_id=TOKEN_PROGRAM_ID,
    )
    mint_pubkey = token.pubkey
    print(_green("✓"))

    # Create buyer ATA and mint tokens
    print("     Minting 1000 USDC to buyer ... ", end="", flush=True)
    tc = SyncToken(conn=client, pubkey=mint_pubkey, program_id=TOKEN_PROGRAM_ID, payer=buyer_kp)
    buyer_ata = get_associated_token_address(buyer_kp.pubkey(), mint_pubkey)
    try:
        info = client.get_account_info(buyer_ata, commitment="confirmed")
        if info.value is None:
            tc.create_associated_token_account(buyer_kp.pubkey())
    except Exception:
        tc.create_associated_token_account(buyer_kp.pubkey())
    tc.mint_to(dest=buyer_ata, mint_authority=buyer_kp, amount=int(1000 * 1_000_000))
    time.sleep(1)
    print(_green("✓"))

    buyer_b58 = b58.b58encode(bytes(buyer_kp)).decode()
    return buyer_b58, str(seller_kp.pubkey()), str(mint_pubkey), rpc_url


async def _cmd_demo(mode: str = "mock") -> None:
    """Run a self-contained E2E payment demo.

    Uses the persistent wallet (~/.ag402/wallet.db) so demo transactions
    show up in `ag402 status` and `ag402 history`.

    Modes:
      - mock: Simulated payments (default, zero risk)
      - localnet: Real on-chain via solana-test-validator
      - devnet: Real on-chain via Solana devnet
    """
    from ag402_core.config import RunMode, X402Config
    from ag402_core.middleware.x402_middleware import X402PaymentMiddleware
    from ag402_core.payment.solana_adapter import MockSolanaAdapter
    from ag402_core.wallet.agent_wallet import AgentWallet

    _print_banner()

    mode_labels = {
        "mock": _yellow("MOCK") + " (simulated, zero risk)",
        "localnet": _cyan("LOCALNET") + " (solana-test-validator, real on-chain)",
        "devnet": _green("DEVNET") + " (Solana devnet, real on-chain)",
    }

    print(f"  {_bold('E2E Payment Demo')} — Full AI Agent auto-payment flow")
    print("  " + "═" * 55)
    print(f"  Mode: {mode_labels.get(mode, mode)}")
    print()

    # ── Pre-flight checks for non-mock modes ──
    if mode == "localnet" and not _check_localnet_ready():
        print(f"  {_red('✗')} Local Solana validator not running on port 8899")
        print()
        print(f"  {_bold('To start it:')}")
        print(f"    $ {_cyan('solana-test-validator --reset')}")
        print()
        print(f"  {_dim('Or use mock mode:')} {_cyan('ag402 demo')}")
        print()
        return

    if mode == "devnet":
        print(f"  {_dim('Checking Solana devnet connectivity ...')} ", end="", flush=True)
        if not _check_devnet_ready():
            print(_red("✗"))
            print()
            print(f"  {_yellow('⚠')} Solana devnet is unreachable or unstable")
            print()
            print(f"  {_bold('Suggestions:')}")
            print("    1. Check your network connection")
            print(f"    2. Use localnet instead: {_cyan('ag402 demo --localnet')}")
            print(f"    3. Use mock mode: {_cyan('ag402 demo')}")
            print()
            return
        print(_green("✓"))
        print()

    # Check if gateway dependencies are available
    try:
        from ag402_mcp.gateway import X402Gateway  # noqa: F401

        from ag402_core.gateway.auth import PaymentVerifier  # noqa: F401
        has_gateway = True
    except ImportError:
        has_gateway = False

    # Use persistent wallet so demo txns appear in status/history
    print(f"  {_bold('① Initialize')}")
    print("     Opening wallet ... ", end="", flush=True)
    wallet = AgentWallet(db_path=_DEFAULT_DB)
    await wallet.init_db()

    # Ensure there's enough balance for the demo
    balance = float(await wallet.get_balance())
    if balance < 0.10:
        await wallet.deposit(100.0, note="Demo faucet top-up")
        balance = float(await wallet.get_balance())
    print(_green("✓"))
    print(f"     Balance: {_green(f'${balance:.2f}')}")

    # ── Select provider based on mode ──
    if mode == "localnet":
        print("     Setting up localnet accounts ...")
        try:
            buyer_key, seller_addr, usdc_mint, rpc_url = await _setup_localnet_accounts()
        except ImportError:
            print(f"     {_red('✗')} Solana dependencies not installed")
            install_hint = "pip install 'ag402-core[crypto]'"
            print(f"     → Run: {_cyan(install_hint)}")
            await wallet.close()
            print()
            return
        except Exception as exc:
            print(f"     {_red('✗')} Localnet setup failed: {exc}")
            print(f"     → Make sure {_cyan('solana-test-validator')} is running")
            await wallet.close()
            print()
            return

        from ag402_core.payment.solana_adapter import SolanaAdapter
        provider = SolanaAdapter(
            private_key=buyer_key, rpc_url=rpc_url,
            usdc_mint=usdc_mint,
        )
        print(f"     Mode: {_cyan('Localnet')} (real on-chain via solana-test-validator)")
        recipient_addr = seller_addr

    elif mode == "devnet":
        from ag402_core.config import load_config
        config = load_config()
        if not config.solana_private_key:
            print(f"     {_yellow('⚠')} No SOLANA_PRIVATE_KEY set — falling back to mock mode")
            print("     → Set SOLANA_PRIVATE_KEY for real devnet transactions")
            mode = "mock"
            provider = MockSolanaAdapter(balance=balance)
            recipient_addr = "DemoRecipientWa11et11111111111111111111"
            print("     Mode: Mock Solana (test environment, zero risk)")
        else:
            try:
                from ag402_core.payment.solana_adapter import SolanaAdapter
                provider = SolanaAdapter(
                    private_key=config.solana_private_key,
                    rpc_url=config.effective_rpc_url,
                    usdc_mint=config.usdc_mint_address,
                )
                recipient_addr = "DemoRecipientWa11et11111111111111111111"
                print(f"     Mode: {_green('Devnet')} (real on-chain)")
            except Exception as exc:
                print(f"     {_yellow('⚠')} Devnet adapter init failed: {exc}")
                print("     → Falling back to mock mode")
                mode = "mock"
                provider = MockSolanaAdapter(balance=balance)
                recipient_addr = "DemoRecipientWa11et11111111111111111111"
    else:
        provider = MockSolanaAdapter(balance=balance)
        recipient_addr = "DemoRecipientWa11et11111111111111111111"
        print("     Mode: Mock Solana (test environment, zero risk)")

    print()

    config = X402Config(mode=RunMode.TEST, single_tx_limit=1.0)
    middleware = X402PaymentMiddleware(wallet=wallet, provider=provider, config=config)

    weather_server = None
    gw_server = None
    weather_task = None
    gw_task = None
    gateway = None  # Track gateway for cleanup

    try:
        if has_gateway:
            # Full E2E with local gateway
            import uvicorn
            from starlette.applications import Starlette
            from starlette.responses import JSONResponse
            from starlette.routing import Route

            async def weather_handler(request):
                city = request.query_params.get("city", "Tokyo")
                return JSONResponse({"city": city, "temp": 22, "condition": "Sunny", "source": "Ag402 Demo"})

            weather_app = Starlette(routes=[Route("/weather", weather_handler)])

            weather_port = 18100
            gateway_port = 18101

            # Start weather server
            print(f"  {_bold('② Start Services')}")
            print(f"     Starting Weather API (:{weather_port}) ... ", end="", flush=True)
            weather_config = uvicorn.Config(
                weather_app, host="127.0.0.1", port=weather_port,
                log_level="error", lifespan="off",
            )
            weather_server = uvicorn.Server(weather_config)
            # Prevent uvicorn from installing its own signal handlers
            weather_server.install_signal_handlers = lambda: None
            weather_task = asyncio.create_task(weather_server.serve())
            for _ in range(50):
                await asyncio.sleep(0.1)
                if weather_server.started:
                    break
            print(_green("✓"))

            # Start gateway
            print(f"     Starting x402 Gateway (:{gateway_port}) ... ", end="", flush=True)
            verifier = PaymentVerifier()
            gateway = X402Gateway(
                target_url=f"http://127.0.0.1:{weather_port}",
                price="0.02", chain="solana", token="USDC", address=recipient_addr,
                verifier=verifier,
            )
            gateway_app = gateway.create_app()
            gw_config = uvicorn.Config(
                gateway_app, host="127.0.0.1", port=gateway_port,
                log_level="error", lifespan="off",
            )
            gw_server = uvicorn.Server(gw_config)
            gw_server.install_signal_handlers = lambda: None
            gw_task = asyncio.create_task(gw_server.serve())
            for _ in range(50):
                await asyncio.sleep(0.1)
                if gw_server.started:
                    break
            print(_green("✓"))
            print()

            # Make payment request
            url = f"http://127.0.0.1:{gateway_port}/weather?city=Tokyo"
            print(f"  {_bold('③ Send Request')}")
            print(f"     GET {_cyan(url)}")
            print()

            t0 = time.monotonic()
            try:
                result = await middleware.handle_request("GET", url)
            except Exception as pay_exc:
                elapsed = time.monotonic() - t0
                print(f"  {_bold('④ Payment Failed')} ({elapsed:.2f}s)")
                print(f"     {_red('✗')} {pay_exc}")
                if mode == "devnet":
                    print()
                    print(f"  {_yellow('⚠')} Devnet payment failed. Possible causes:")
                    print("     • Network instability or RPC timeout")
                    print("     • Insufficient devnet USDC balance")
                    print()
                    print(f"  {_bold('Suggestions:')}")
                    print(f"    1. Retry: {_cyan('ag402 demo --devnet')}")
                    print(f"    2. Use localnet: {_cyan('ag402 demo --localnet')}")
                    print(f"    3. Use mock: {_cyan('ag402 demo')}")
                elif mode == "localnet":
                    print()
                    print(f"  {_yellow('⚠')} Localnet payment failed.")
                    print(f"     → Make sure {_cyan('solana-test-validator')} is still running")
                raise

            elapsed = time.monotonic() - t0

            print(f"  {_bold('④ Payment Negotiation')}")
            if result.payment_made:
                print(f"     Server returned {_yellow('402')} → Ag402 auto-paid {_green('✓')}  ({elapsed:.2f}s)")
                print(f"     TX Hash: {_cyan(result.tx_hash[:44])}...")
                print(f"     Amount:  {_green(f'${result.amount_paid:.4f} USDC')}")
                if mode in ("localnet", "devnet"):
                    print(f"     Chain:   {_bold('Real on-chain')} ({mode})")
            print()

            print(f"  {_bold('⑤ Fetch Data')}")
            if result.status_code == 200:
                data = json.loads(result.body)
                print(f"     Status: {_green('200 OK')}")
                print(f"     City:   {data['city']}")
                print(f"     Temp:   {data['temp']}°C")
                print(f"     Weather: {data['condition']}")
            else:
                print(f"     Status: {_red(str(result.status_code))}")
                if result.error:
                    print(f"     Error:  {result.error}")

            final = float(await wallet.get_balance())
            spent = balance - final
            print()
            print(f"  {_bold('⑥ Balance Change')}")
            print(f"     Before: ${balance:.4f}  →  After: {_green(f'${final:.4f}')}  ({_red(f'-${spent:.4f}')})")
            print()

        else:
            # Simplified demo without gateway (no ag402-mcp installed)
            print(f"  {_yellow('⚠')} ag402-mcp not installed — running simplified demo")
            print()

            print(f"  {_bold('② Simulated Payment')}")
            print("     Paying $0.02 USDC ... ", end="", flush=True)
            pay_result = await provider.pay(recipient_addr, 0.02, "USDC")
            await wallet.deduct(0.02, to_address=recipient_addr, tx_hash=pay_result.tx_hash)
            print(_green("✓"))
            print(f"     TX Hash: {_cyan(pay_result.tx_hash[:44])}...")
            print(f"     Amount:  {_green('$0.02 USDC')}")
            if mode in ("localnet", "devnet"):
                print(f"     Chain:   {_bold('Real on-chain')} ({mode})")

            final = float(await wallet.get_balance())
            print(f"     Balance: {_green(f'${final:.2f}')}")
            print()

    except KeyboardInterrupt:
        print(f"\n  {_yellow('⚠')} Demo interrupted")

    finally:
        # Graceful shutdown: signal servers to stop, then await their tasks
        if gw_server is not None:
            gw_server.should_exit = True
        if weather_server is not None:
            weather_server.should_exit = True

        # Await server tasks with timeout so uvicorn fully shuts down
        # (prevents dangling threads that block process exit)
        for task in (gw_task, weather_task):
            if task is not None:
                try:
                    await asyncio.wait_for(task, timeout=3.0)
                except (asyncio.TimeoutError, asyncio.CancelledError):
                    task.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await task

        # Close gateway's persistent replay guard (opened via lazy init
        # since lifespan="off" means FastAPI lifespan doesn't run)
        if gateway is not None:
            with contextlib.suppress(Exception):
                await gateway._persistent_guard.close()

        # Clean up SolanaAdapter if applicable
        if mode in ("localnet", "devnet") and hasattr(provider, "close"):
            with contextlib.suppress(Exception):
                provider.close()

        await middleware.close()
        await wallet.close()

    print()
    print("  " + "═" * 55)
    print(f"  {_green('✓')} Demo complete! The AI Agent auto-paid for an API call.")
    if mode in ("localnet", "devnet"):
        print(f"  {_dim('The transaction is a real on-chain SPL Token transfer.')}")
    print(f"  {_dim('Use')} {_cyan('ag402 history')} {_dim('to view transaction history')}")
    print()


async def _cmd_export(db_path: str, fmt: str, output: str) -> None:
    from ag402_core.wallet.agent_wallet import AgentWallet

    if not output:
        output = f"ag402_history.{fmt}"

    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()

    await wallet.export_history(output, format=fmt)
    print(f"\n  {_green('✓')} Exported {fmt.upper()} to: {output}\n")

    await wallet.close()


# ─── Prepaid commands ─────────────────────────────────────────────────────


async def _cmd_prepaid(args) -> None:
    """Dispatch ag402 prepaid <action>."""
    action = getattr(args, "prepaid_action", None)
    if action == "status":
        _cmd_prepaid_status()
    elif action == "purge":
        _cmd_prepaid_purge()
    elif action == "buy":
        await _cmd_prepaid_buy(args)
    elif action == "recover":
        await _cmd_prepaid_recover(args)
    elif action == "pending":
        _cmd_prepaid_pending()
    else:
        # No sub-action: show status
        _cmd_prepaid_status()


def _cmd_prepaid_status() -> None:
    """Show all prepaid credentials and remaining calls."""
    from ag402_core.prepaid.client import get_prepaid_status
    status = get_prepaid_status()

    print()
    print(f"  {_bold('Prepaid Credentials')}")
    print(f"  {'─' * 48}")
    print(f"  Total stored  : {status['total_credentials']}")
    print(f"  Valid         : {status['valid_credentials']}")
    print(f"  Total calls   : {status['total_remaining_calls']}")

    by_seller = status.get("by_seller", {})
    if not by_seller:
        print(f"\n  {_dim('No valid credentials. Use `ag402 prepaid buy` to purchase one.')}")
    else:
        print()
        for seller, creds in by_seller.items():
            print(f"  {_cyan('Seller')} {_dim(seller[:32] + ('...' if len(seller) > 32 else ''))}")
            for c in creds:
                calls = c["remaining_calls"]
                exp = c["expires_at"][:10]  # YYYY-MM-DD
                pkg = c["package_id"]
                print(f"    {_green('●')} {pkg:16s}  {_bold(str(calls)):>6} calls  expires {exp}")
    print()


def _cmd_prepaid_purge() -> None:
    """Remove expired and depleted credentials."""
    from ag402_core.prepaid.client import purge_invalid_credentials
    removed = purge_invalid_credentials()
    if removed:
        print(f"\n  {_green('✓')} Removed {removed} expired/depleted credential(s).\n")
    else:
        print(f"\n  {_dim('Nothing to purge — all credentials are valid.')}\n")


def _cmd_prepaid_pending() -> None:
    """Show any in-flight purchase waiting for recovery."""
    pending = _load_pending_purchase()
    print()
    if pending is None:
        print(f"  {_dim('No pending purchase on record.')}")
        print(f"  {_dim('(Records are cleared automatically after successful buy/recover.)')}")
    else:
        print(f"  {_bold('Pending Purchase')} — awaiting credential recovery")
        print(f"  {'─' * 48}")
        print(f"  gateway : {pending.get('gateway_url', '-')}")
        print(f"  tx_hash : {_dim(str(pending.get('tx_hash', '-'))[:60])}")
        print(f"  package : {pending.get('package_id', '-')}")
        saved = pending.get("saved_at", "")
        if saved:
            print(f"  saved   : {saved[:19].replace('T', ' ')} UTC")
        print()
        gw = pending.get("gateway_url", "")
        print(f"  Run {_cyan(f'ag402 prepaid recover {gw}')} to retrieve your credential.")
    print()


# ─── Pending purchase record (for recover-after-timeout UX) ─────────────────
# Written after broadcast, cleared after successful purchase.
# Stored at ~/.ag402/pending_purchase.json — single record (last broadcast).
# Integrity-protected with HMAC-SHA256 so a tampered gateway_url cannot
# silently redirect recovery to an attacker's endpoint.

_PENDING_PURCHASE_FILE = Path.home() / ".ag402" / "pending_purchase.json"
_PENDING_MAX_AGE_DAYS = 30  # Pending records older than this are treated as stale


def _pending_hmac(data: dict) -> str:
    """Compute HMAC-SHA256 over the stable fields of a pending purchase record.

    Uses the machine's hostname + username as a low-entropy "device key" —
    not cryptographically strong, but good enough to detect accidental or
    opportunistic tampering of the local file.
    """
    import hashlib
    import hmac as _hmac
    import socket

    # Prefer platform-independent socket.gethostname() over os.uname().
    # Fall back to 'unknown' for any edge case (containers, CI, etc.).
    try:
        hostname = socket.gethostname()
    except Exception:
        hostname = "unknown"
    try:
        username = os.getlogin()
    except Exception:
        username = os.environ.get("USERNAME") or os.environ.get("USER") or "unknown"

    device_key = f"{username}-{hostname}".encode()
    msg = f"{data['gateway_url']}|{data['tx_hash']}|{data['package_id']}|{data['buyer_address']}|{data['saved_at']}".encode()
    return _hmac.new(device_key, msg, hashlib.sha256).hexdigest()


def _save_pending_purchase(gateway_url: str, tx_hash: str, package_id: str, buyer_address: str) -> None:
    """Persist the in-flight purchase so `recover` can find it without arguments.

    The file is written atomically (tempfile + rename) and protected with a
    HMAC integrity tag so tampering is detectable. On Unix, file mode is set
    to 0600 (owner-only read/write). Raises a warning (does NOT silently fail)
    so the user knows that `recover` will require manual tx_hash input.
    """
    import contextlib
    import tempfile

    saved_at = datetime.now(timezone.utc).isoformat()
    data = {
        "gateway_url": gateway_url,
        "tx_hash": tx_hash,
        "package_id": package_id,
        "buyer_address": buyer_address,
        "saved_at": saved_at,
    }
    data["_hmac"] = _pending_hmac(data)

    _PENDING_PURCHASE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp_fd, tmp_path = tempfile.mkstemp(dir=_PENDING_PURCHASE_FILE.parent, prefix=".pending_tmp_", suffix=".json")
    try:
        # Set permissions to 0600 before writing any sensitive data (Unix only)
        with contextlib.suppress(OSError, AttributeError):
            os.chmod(tmp_path, 0o600)
        with os.fdopen(tmp_fd, "w") as f:
            json.dump(data, f)
        os.replace(tmp_path, _PENDING_PURCHASE_FILE)
        # Re-apply permissions after rename in case umask widens them (Unix only)
        with contextlib.suppress(OSError, AttributeError):
            os.chmod(_PENDING_PURCHASE_FILE, 0o600)
    except Exception as exc:
        with contextlib.suppress(OSError):
            os.unlink(tmp_path)
        # Warn explicitly — user must pass tx_hash manually to `recover`
        print(f"  {_yellow('⚠')} Could not save pending purchase record: {exc}")
        print("     If the gateway request fails, you will need to run:")
        print(f"     ag402 prepaid recover {gateway_url} {tx_hash} {package_id}")


def _load_pending_purchase() -> dict | None:
    """Load and validate the pending purchase record.

    Returns None if:
    - File does not exist
    - File is malformed / missing fields
    - HMAC integrity check fails (possible tampering)
    - Record is older than _PENDING_MAX_AGE_DAYS (stale)
    """
    if not _PENDING_PURCHASE_FILE.exists():
        return None
    try:
        with open(_PENDING_PURCHASE_FILE) as f:
            data = json.load(f)
    except Exception:
        return None

    if not isinstance(data, dict):
        return None

    # Validate required fields
    required = {"gateway_url", "tx_hash", "package_id", "buyer_address", "saved_at"}
    if not required.issubset(data.keys()):
        return None

    # Integrity check — warn but do not crash if HMAC is missing (older format)
    stored_hmac = data.pop("_hmac", None)
    if stored_hmac is not None:
        try:
            import hmac as _hmac
            expected = _pending_hmac(data)
            if not _hmac.compare_digest(expected, stored_hmac):
                print(f"  {_yellow('⚠')} Pending purchase record failed integrity check — ignoring.")
                return None
        except Exception:
            pass  # HMAC check not critical; fall through
    data["_hmac"] = stored_hmac  # restore for callers that inspect raw data

    # Expiry check
    try:
        saved_at = datetime.fromisoformat(data["saved_at"])
        if datetime.now(timezone.utc) - saved_at > timedelta(days=_PENDING_MAX_AGE_DAYS):
            print(f"  {_yellow('⚠')} Pending purchase record is older than {_PENDING_MAX_AGE_DAYS} days — ignoring.")
            return None
    except Exception:
        pass  # Malformed date — keep going, recovery is low-risk

    return data


def _clear_pending_purchase() -> None:
    import contextlib
    with contextlib.suppress(OSError):
        _PENDING_PURCHASE_FILE.unlink()


async def _cmd_prepaid_buy(args) -> None:
    """Purchase a prepaid package from a gateway."""
    import httpx

    from ag402_core.prepaid.client import add_credential

    gateway_url = args.gateway_url.rstrip("/")
    package_id = args.package_id
    buyer_address = args.buyer_address

    # If no buyer_address provided, try to read from wallet config
    if not buyer_address:
        from ag402_core.config import load_config
        cfg = load_config()
        buyer_address = getattr(cfg, "solana_public_key", "") or ""
        if not buyer_address:
            print(f"\n  {_red('✗')} No buyer address. Pass --buyer-address or configure AG402_PUBLIC_KEY.\n")
            return

    print()
    print(f"  {_bold('Prepaid Purchase')}")
    print(f"  {'─' * 48}")
    print(f"  ① Fetching packages from {gateway_url} …")

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(f"{gateway_url}/prepaid/packages")
        except Exception as exc:
            print(f"  {_red('✗')} Cannot reach gateway: {exc}\n")
            return

        if resp.status_code != 200:
            print(f"  {_red('✗')} Gateway returned {resp.status_code}\n")
            return

        try:
            packages_body = resp.json()
            packages = {p["package_id"]: p for p in (packages_body.get("packages", []) if isinstance(packages_body, dict) else [])}
        except Exception:
            packages = {}

    if package_id not in packages:
        available = ", ".join(packages.keys())
        print(f"  {_red('✗')} Unknown package {package_id!r}. Available: {available}\n")
        return

    pkg = packages[package_id]
    price = pkg["price_usdc"]
    calls = pkg["calls"]
    days = pkg["days"]
    seller_address = pkg["seller_address"]
    print(f"  ② Package: {_bold(pkg['name'])} — {calls} calls / {days} days / {_bold(str(price))} USDC")
    print(f"  ③ Seller: {_dim(seller_address[:40])}")

    # In test mode, synthesize a mock tx_hash so the flow works end-to-end
    from ag402_core.config import load_config
    cfg = load_config()
    if cfg.is_test_mode:
        import time as _time
        tx_hash = f"prepaid_purchase_{int(_time.time())}"
        print(f"  ④ {_yellow('Test mode')} — using synthetic tx_hash: {_dim(tx_hash)}")
    else:
        price_float = float(price)
        if price_float > cfg.single_tx_limit:
            print(f"  {_red('✗')} Package price ${price_float} exceeds single-tx limit ${cfg.single_tx_limit}.\n")
            return
        print(f"  ④ About to broadcast {_bold(str(price))} USDC → {_dim(seller_address[:40])}")
        confirm = input("     Confirm payment? [Y/n] ").strip().lower()
        if confirm and confirm != "y":
            print(f"  {_yellow('⚠')} Cancelled.\n")
            return
        from ag402_core.payment.registry import PaymentProviderRegistry
        try:
            provider = PaymentProviderRegistry.get_provider()
        except Exception as exc:
            print(f"  {_red('✗')} Cannot load payment provider: {exc}\n")
            return
        pay_result = await provider.pay(to_address=seller_address, amount=price_float, token="USDC")
        if not pay_result.success:
            print(f"  {_red('✗')} Payment failed: {pay_result.error}\n")
            return
        tx_hash = pay_result.tx_hash
        print(f"  ④ {_green('✓')} Broadcast — tx: {_dim(tx_hash[:44])}")
        # Save pending record immediately after broadcast so `recover` works
        # even if this process crashes before the credential is delivered.
        _save_pending_purchase(gateway_url, tx_hash, package_id, buyer_address)

    print("  ⑤ Submitting purchase to gateway …")

    cred = await _submit_purchase_with_retry(
        gateway_url=gateway_url,
        buyer_address=buyer_address,
        package_id=package_id,
        tx_hash=tx_hash,
    )
    if cred is None:
        # Retry exhausted — instruct user to run recover (no extra args needed)
        print(f"\n  {_yellow('⚠')} Your USDC payment was broadcast (tx: {_dim(tx_hash[:44])}).")
        print("     The credential could not be retrieved. Run this to recover it:")
        print(f"     {_cyan(f'ag402 prepaid recover {gateway_url}')}\n")
        return

    _clear_pending_purchase()
    add_credential(cred)
    print(f"  {_green('✓')} Credential stored — {_bold(str(cred.remaining_calls))} calls, expires {cred.expires_at.date()}")
    print("     Use `ag402 prepaid status` to view all credentials.\n")


async def _submit_purchase_with_retry(
    gateway_url: str,
    buyer_address: str,
    package_id: str,
    tx_hash: str,
    max_attempts: int = 3,
) -> None:
    """POST /prepaid/purchase with exponential backoff. Returns PrepaidCredential or None."""
    import asyncio

    import httpx

    from ag402_core.prepaid.models import PrepaidCredential

    for attempt in range(1, max_attempts + 1):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{gateway_url}/prepaid/purchase",
                    json={"buyer_address": buyer_address, "package_id": package_id, "tx_hash": tx_hash},
                )
        except Exception as exc:
            if attempt < max_attempts:
                wait = 2 ** attempt
                print(f"     {_yellow('⚠')} Could not reach gateway — retrying in {wait}s …")
                await asyncio.sleep(wait)
                continue
            print(f"  {_red('✗')} Purchase request failed: {exc}\n")
            return None

        if resp.status_code in (200, 201):
            try:
                body_json = resp.json()
                cred_data = body_json.get("credential", {}) if isinstance(body_json, dict) else {}
                cred = PrepaidCredential.from_dict(cred_data)
                if resp.status_code == 200:
                    print(f"  {_green('✓')} Credential recovered (idempotent retry).")
                return cred
            except Exception as exc:
                print(f"  {_red('✗')} Invalid credential in response: {exc}\n")
                return None

        if resp.status_code == 429 and attempt < max_attempts:
            wait = 2 ** attempt
            print(f"     {_yellow('⚠')} Gateway is busy — retrying in {wait}s …")
            await asyncio.sleep(wait)
            continue

        body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        print(f"  {_red('✗')} Gateway rejected purchase ({resp.status_code}): {body.get('detail') or body.get('error', 'unknown')}\n")
        return None

    return None


async def _cmd_prepaid_recover(args) -> None:
    """Recover a lost credential using a confirmed tx_hash."""
    from ag402_core.prepaid.client import add_credential

    gateway_url = args.gateway_url.rstrip("/")
    tx_hash = getattr(args, "tx_hash", "") or ""
    package_id = getattr(args, "package_id", "") or ""
    buyer_address = getattr(args, "buyer_address", "") or ""

    # Auto-detect from pending record when args are omitted
    if not tx_hash or not package_id or not buyer_address:
        pending = _load_pending_purchase()
        if pending:
            tx_hash = tx_hash or pending.get("tx_hash", "")
            package_id = package_id or pending.get("package_id", "")
            buyer_address = buyer_address or pending.get("buyer_address", "")
            if not gateway_url:
                gateway_url = pending.get("gateway_url", "").rstrip("/")

    if not buyer_address:
        from ag402_core.config import load_config
        cfg = load_config()
        buyer_address = getattr(cfg, "solana_public_key", "") or ""
        if not buyer_address:
            print(f"\n  {_red('✗')} No buyer address. Pass --buyer-address or configure AG402_PUBLIC_KEY.\n")
            return

    if not tx_hash:
        print(f"\n  {_red('✗')} No tx_hash found. Pass it as an argument or run `ag402 prepaid buy` first.\n")
        return

    if not package_id:
        print(f"\n  {_red('✗')} No package_id found. Pass it as an argument or run `ag402 prepaid buy` first.\n")
        return

    print()
    print(f"  {_bold('Prepaid Recovery')}")
    print(f"  {'─' * 48}")
    print(f"  tx_hash : {_dim(tx_hash[:44])}")
    print(f"  package : {package_id}")
    print(f"  gateway : {gateway_url}")
    print()

    cred = await _submit_purchase_with_retry(
        gateway_url=gateway_url,
        buyer_address=buyer_address,
        package_id=package_id,
        tx_hash=tx_hash,
    )
    if cred is None:
        print(f"  {_red('✗')} Recovery failed. The gateway may not have a record of this transaction.")
        print("     If payment is confirmed on-chain, contact the gateway operator with your tx_hash.\n")
        return

    _clear_pending_purchase()
    add_credential(cred)
    print(f"  {_green('✓')} Credential recovered — {_bold(str(cred.remaining_calls))} calls, expires {cred.expires_at.date()}")
    print("     Use `ag402 prepaid status` to view all credentials.\n")


if __name__ == "__main__":
    main()
