"""
Interactive setup wizard for Ag402.

Guides developers through first-time configuration with a step-by-step
terminal UI. Handles role selection (consumer/provider/both), encryption,
budget limits, and test-fund deposit.

Design principles:
- Even test mode walks through the full encryption flow (security perception)
- No manual env var editing required — everything saved to ~/.ag402/.env
- Friendly, non-technical language throughout
"""

from __future__ import annotations

import getpass
import os
import sys
import time
import uuid

from ag402_core.terminal import (
    bold,
    cyan,
    dim,
    green,
    red,
    yellow,
)

# ─── Input helpers ───────────────────────────────────────────────────


def _prompt_choice(prompt: str, options: list[str], default: int = 1) -> int:
    """Prompt user to choose from numbered options. Returns 1-based index."""
    while True:
        for i, opt in enumerate(options, 1):
            marker = cyan(f"[{i}]")
            print(f"  {marker} {opt}")
        print()
        raw = input("  > ").strip()
        if not raw:
            return default
        try:
            choice = int(raw)
            if 1 <= choice <= len(options):
                return choice
        except ValueError:
            pass
        print(f"  {red('✗')} Please enter a number between 1-{len(options)}\n")


def _prompt_password(prompt: str, confirm: bool = True) -> str:
    """Prompt for a password with optional confirmation."""
    while True:
        pw = getpass.getpass(f"  {prompt}: ")
        if len(pw) < 8:
            print(f"  {red('✗')} Password must be at least 8 characters\n")
            continue
        if not confirm:
            return pw
        pw2 = getpass.getpass("  Confirm password: ")
        if pw == pw2:
            return pw
        print(f"  {red('✗')} Passwords do not match, please try again\n")


def _prompt_input(prompt: str, default: str = "") -> str:
    """Prompt for text input with optional default."""
    suffix = f" [{default}]" if default else ""
    raw = input(f"  {prompt}{suffix}: ").strip()
    return raw if raw else default


def _progress_bar(label: str, duration: float = 1.0, width: int = 20) -> None:
    """Show a fake progress bar for perceived security/work."""
    sys.stdout.write(f"  {label} ")
    sys.stdout.flush()
    for _i in range(width):
        time.sleep(duration / width)
        sys.stdout.write("█")
        sys.stdout.flush()
    print(f" {green('✓')}")


# ─── Setup wizard ────────────────────────────────────────────────────


class SetupResult:
    """Collects all data from the setup wizard."""

    def __init__(self) -> None:
        self.role: str = "consumer"  # consumer | provider | both
        self.mode: str = "test"  # test | production
        self.network: str = "localnet"  # localnet | devnet | mainnet
        self.password: str = ""
        self.private_key: str = ""
        self.daily_limit: float = 10.0
        self.single_tx_limit: float = 5.0
        self.per_minute_limit: float = 2.0
        self.per_minute_count: int = 5
        # Provider-specific
        self.receive_address: str = ""
        self.api_price: str = "0.02"
        self.target_api_url: str = ""


def run_setup_wizard() -> SetupResult:
    """Run the interactive setup wizard. Returns a SetupResult.

    This is a synchronous function (terminal I/O is blocking).
    """
    result = SetupResult()

    _print_setup_banner()

    # ── Step 1: Role selection ──
    _print_step(1, 5, "What do you want to do?")
    role_choice = _prompt_choice("", [
        "🛒 Consumer — My Agent needs to call paid APIs (buy services)",
        "💰 Service Provider — I have an API and want to charge per call (sell services)",
        "🔄 Both — Consumer and provider",
    ])
    result.role = {1: "consumer", 2: "provider", 3: "both"}[role_choice]
    role_label = {1: "Consumer", 2: "Service Provider", 3: "Both"}[role_choice]
    print(f"  {green('✓')} Selected: {role_label}")
    print()

    # ── Step 2: Network environment ──
    _print_step(2, 5, "Network environment")
    net_choice = _prompt_choice("", [
        "🧪 Local Testnet (localnet) — solana-test-validator on localhost, zero cost",
        "🌐 Devnet (devnet) — Solana public test network, free test tokens",
        "🚀 Mainnet (production) — Real Solana USDC, real money",
    ])
    net_map = {
        1: ("test", "localnet"),
        2: ("test", "devnet"),
        3: ("production", "mainnet"),
    }
    result.mode, result.network = net_map[net_choice]
    net_label = {1: "Local Testnet", 2: "Devnet", 3: "Mainnet"}[net_choice]
    print(f"  {green('✓')} Selected: {net_label}")
    print()

    # Print network-specific prerequisites
    _print_network_prerequisites(result.network)
    print()

    # ── Step 3: Wallet / Key setup ──
    if result.role in ("consumer", "both"):
        _print_step(3, 5, "Wallet configuration")
        _setup_wallet(result)
    elif result.role == "provider":
        _print_step(3, 5, "Payment receiving setup")
        _setup_provider(result)

    # ── Step 4: Budget limits ──
    if result.role in ("consumer", "both"):
        _print_step(4, 5, "Safety limits")
        _setup_budget(result)
    else:
        _print_step(4, 5, "Gateway configuration")
        _setup_gateway_config(result)

    # ── Step 5: Save & finish ──
    _print_step(5, 5, "Save configuration")
    _save_configuration(result)

    _print_completion(result)
    return result


# ─── Step implementations ────────────────────────────────────────────


def _setup_wallet(result: SetupResult) -> None:
    """Configure wallet (localnet, devnet, and mainnet modes)."""
    if result.network == "localnet":
        # Generate mock private key for localnet
        mock_key = f"test_key_{uuid.uuid4().hex}"
        result.private_key = mock_key
        print(f"  Generating test key pair... {green('✓')}")
    elif result.network == "devnet":
        # Devnet: generate a real Solana keypair or import existing
        print("  Devnet requires a real Solana keypair for airdrop funding.")
        print()
        key_choice = _prompt_choice("", [
            "Generate a new devnet keypair",
            "Import an existing private key (base58)",
        ])
        if key_choice == 1:
            _generate_devnet_keypair(result)
        else:
            print(f"  {dim('(Private key will not be shown on screen)')}")
            result.private_key = getpass.getpass("  Private key (base58): ")
            if not result.private_key.strip():
                print(f"  {red('✗')} No private key provided, cannot continue")
                raise SystemExit(1)
            print(f"  {green('✓')} Private key received")
    else:
        # Mainnet: user provides real private key
        print("  Please enter your Solana private key (base58 encoded):")
        print(f"  {dim('(Private key will not be shown on screen)')}")
        result.private_key = getpass.getpass("  Private key: ")
        if not result.private_key.strip():
            print(f"  {red('✗')} No private key provided, cannot continue")
            raise SystemExit(1)
        print(f"  {green('✓')} Private key received")

    print()
    print(f"  🔐 {bold('Encryption Protection')}")
    result.password = _prompt_password("Set wallet password (to encrypt private key)")
    print()

    # Encrypt private key (real encryption, even in test mode)
    try:
        from ag402_core.security.wallet_encryption import (
            encrypt_private_key,
            save_encrypted_wallet,
        )

        _progress_bar("Encrypting key (PBKDF2 480K rounds + AES)", duration=2.0)

        encrypted = encrypt_private_key(result.password, result.private_key)
        wallet_path = os.path.expanduser("~/.ag402/wallet.key")
        save_encrypted_wallet(wallet_path, encrypted)

        print(f"  {green('✓')} Private key encrypted and saved: {dim(wallet_path)}")
        print(f"  {green('✓')} File permissions: owner-only (600)")
    except ImportError:
        print(f"  {yellow('⚠')} cryptography not installed, skipping encryption step")
        print(f"  {dim('  Run: pip install cryptography')}")
    print()


def _setup_provider(result: SetupResult) -> None:
    """Configure provider-specific settings."""
    # ── Security reminder: sellers never need a private key ──
    print(f"  {yellow('⚠')} {bold('Wallet Safety Reminder')}")
    print("  ┌────────────────────────────────────────────────────────┐")
    print("  │  Sellers only need a PUBLIC receiving address.         │")
    print("  │  Do NOT paste your private key here!                   │")
    print("  │  Ag402 verifies payments using your public address —   │")
    print("  │  no signing or private key access is ever required.    │")
    print("  └────────────────────────────────────────────────────────┘")
    print()

    result.receive_address = _prompt_input(
        "Your Solana USDC receiving address (public key)",
        default="(skip for test mode)" if result.mode == "test" else "",
    )
    if result.receive_address == "(skip for test mode)":
        # Generate a valid Solana base58 test address (no 0, O, I, l)
        import random
        _b58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        result.receive_address = "Test" + "".join(random.choices(_b58, k=40))
        print(f"  {green('✓')} Using test receiving address")
    else:
        # ── Private key misuse detection ──
        # Solana public keys are 32-44 chars; private keys are typically 64-88+ chars
        addr = result.receive_address.strip()
        if len(addr) > 50:
            print(f"  {red('✗')} That looks like a private key (too long for a public address)!")
            print(f"  {red('  NEVER share your private key. Sellers only need a public address.')}")
            print(f"  {dim('  A Solana public address is 32-44 characters long.')}")
            print()
            result.receive_address = _prompt_input(
                "Please enter your PUBLIC address instead",
            )
        print(f"  {green('✓')} Receiving address set")

    result.api_price = _prompt_input("Price per API call (USDC)", default="0.02")
    print(f"  {green('✓')} Pricing: ${result.api_price} USDC/call")

    result.target_api_url = _prompt_input("Your API URL", default="http://localhost:8000")
    print(f"  {green('✓')} API URL: {result.target_api_url}")
    print()


def _setup_budget(result: SetupResult) -> None:
    """Configure budget limits."""
    print("  Use recommended safety limits?")
    print(f"  • Daily limit:     ${result.daily_limit:.2f} {dim('(hard ceiling: $1,000)')}")
    print(f"  • Single TX limit: ${result.single_tx_limit:.2f}")
    print(f"  • Per minute:      ${result.per_minute_limit:.2f} / {result.per_minute_count} txns")
    print()
    choice = _prompt_choice("", [
        f"{green('✓')} Use recommended values (suitable for most use cases)",
        "Customize limits",
    ])
    if choice == 2:
        raw = _prompt_input("Daily limit ($)", default=str(result.daily_limit))
        result.daily_limit = min(float(raw), 1000.0)
        raw = _prompt_input("Single TX limit ($)", default=str(result.single_tx_limit))
        result.single_tx_limit = min(float(raw), 5.0)
        raw = _prompt_input("Per-minute amount limit ($)", default=str(result.per_minute_limit))
        result.per_minute_limit = min(float(raw), 10.0)
        raw = _prompt_input("Per-minute TX count limit", default=str(result.per_minute_count))
        result.per_minute_count = min(int(raw), 50)
    print(f"  {green('✓')} Safety limits configured")
    print()


def _setup_gateway_config(result: SetupResult) -> None:
    """Minimal gateway config for pure providers."""
    print("  Gateway will start on default port 4020")
    print(f"  {green('✓')} Using default gateway configuration")
    print()


def _save_configuration(result: SetupResult) -> None:
    """Save all configuration to ~/.ag402/.env and initialize wallet DB."""
    from ag402_core.env_manager import save_env_file

    env_entries: dict[str, str] = {
        "X402_MODE": result.mode,
        "X402_NETWORK": result.network,
        "AG402_ROLE": result.role,
    }

    # Consumer/both settings
    if result.role in ("consumer", "both"):
        env_entries.update({
            "X402_DAILY_LIMIT": str(result.daily_limit),
            "X402_SINGLE_TX_LIMIT": str(result.single_tx_limit),
            "X402_PER_MINUTE_LIMIT": str(result.per_minute_limit),
            "X402_PER_MINUTE_COUNT": str(result.per_minute_count),
        })

    # Private key is stored ONLY in encrypted wallet.key (created in _setup_wallet).
    # It is NOT written to .env to avoid plaintext key exposure on disk.

    # Provider/both settings
    if result.role in ("provider", "both"):
        env_entries.update({
            "AG402_RECEIVE_ADDRESS": result.receive_address,
            "AG402_API_PRICE": result.api_price,
            "AG402_TARGET_API": result.target_api_url,
        })

    # Network-specific settings
    _rpc_urls = {
        "localnet": "http://127.0.0.1:8899",
        "devnet": "https://api.devnet.solana.com",
        "mainnet": "https://api.mainnet-beta.solana.com",
    }
    env_entries["SOLANA_RPC_URL"] = _rpc_urls[result.network]

    # USDC mint addresses (localnet creates at runtime, so skip)
    _usdc_mints = {
        "devnet": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        "mainnet": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    }
    if result.network in _usdc_mints:
        env_entries["USDC_MINT_ADDRESS"] = _usdc_mints[result.network]

    save_env_file(env_entries, merge=False)
    print(f"  {green('✓')} Configuration saved: {dim('~/.ag402/.env')}")
    print()

    # Show summary of key env vars written
    print(f"  {bold('Saved configuration:')}")
    for key, val in env_entries.items():
        if any(s in key.lower() for s in ("key", "password", "secret")):
            display = "********" if val else "(empty)"
        else:
            display = val
        print(f"    {dim(key)}={display}")


def _print_setup_banner() -> None:
    print()
    print(bold("  ╔══════════════════════════════════════════════════════╗"))
    print(bold("  ║") + cyan("  Ag402 Setup Wizard") + "                                " + bold("║"))
    print(bold("  ║") + "  Payment Engine for AI Agents — Powered by Open402    " + bold("║"))
    print(bold("  ╚══════════════════════════════════════════════════════╝"))
    print()


def _print_step(current: int, total: int, title: str) -> None:
    print(f"  {bold(f'Step {current}/{total}')}: {title}")
    print("  " + "─" * 40)


def _print_completion(result: SetupResult) -> None:
    print()
    print("  ═" * 28)
    print(f"  🎉 {bold('Ag402 is ready!')}")
    print()

    # Configuration management box
    print("  ┌─────────── Configuration ─────────────────────┐")
    print("  │                                                │")
    print(f"  │  View config:    {cyan('ag402 env show')}                │")
    print(f"  │  Edit a value:   {cyan('ag402 env set KEY value')}       │")
    print(f"  │  Config file:    {dim('~/.ag402/.env')}                  │")
    print(f"  │  Examples:       {cyan('ag402 setup --show-examples')}   │")
    print("  │                                                │")
    print("  └────────────────────────────────────────────────┘")
    print()

    if result.role in ("consumer", "both"):
        print("  ┌─────────── Next Steps ────────────────────────┐")
        print("  │                                                │")
        if result.network == "localnet":
            print(f"  │  Start validator: {cyan('solana-test-validator --reset')} │")
            print(f"  │  Run demo:        {cyan('ag402 demo --localnet')}        │")
        elif result.network == "devnet":
            print(f"  │  Run demo:        {cyan('ag402 demo --devnet')}          │")
        else:
            print(f"  │  Check balance:   {cyan('ag402 status')}                 │")
        print("  │                                                │")
        print("  │  Integrate your Agent:                         │")
        print(f"  │  $ {cyan('ag402 run -- python my_agent.py')}         │")
        print("  │                                                │")
        print("  │  Learn more:                                   │")
        print(f"  │  $ {cyan('ag402 help')}           View all commands   │")
        print("  │                                                │")
        print("  └────────────────────────────────────────────────┘")

    if result.role in ("provider", "both"):
        print()
        print("  ┌─────────── Service Provider ──────────────────┐")
        print("  │                                                │")
        print("  │  Start payment gateway:                        │")
        print(f"  │  $ {cyan('ag402 serve')}                              │")
        print("  │                                                │")
        print("  │  Verify (in another terminal):                 │")
        print(f"  │  $ {cyan('ag402 pay http://127.0.0.1:4020/')}        │")
        print(f"  │  {dim('→ Auto-pays and displays the result')}              │")
        print("  │                                                │")
        print("  └────────────────────────────────────────────────┘")

    print()


def _print_network_prerequisites(network: str) -> None:
    """Print inline prerequisite guidance after network selection."""
    if network == "localnet":
        print(f"  {bold('Prerequisites:')}")
        install_cmd = 'sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"'
        print(f"  • Install Solana CLI: {cyan(install_cmd)}")
        print(f"  • Start validator:   {cyan('solana-test-validator --reset')}")
        # Non-blocking check: warn if validator not running
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            sock.connect(("127.0.0.1", 8899))
            sock.close()
        except Exception:
            print()
            print(f"  {yellow('⚠')} solana-test-validator does not appear to be running on localhost:8899")
            print(f"  {dim('  (This is fine — you can start it later before running demos)')}")
    elif network == "devnet":
        print(f"  {bold('Prerequisites:')}")
        print(f"  • Generate a keypair:  {cyan('solana-keygen new -o ~/.ag402/devnet-buyer.json')}")
        print(f"  • Fund with SOL:       {cyan('solana airdrop 2 <PUBKEY> --url https://api.devnet.solana.com')}")
        print(f"  • Or use faucet:       {cyan('https://faucet.solana.com/')}")
    elif network == "mainnet":
        print(f"  {yellow('⚠')} WARNING: This uses real funds. Ensure your wallet has SOL + USDC.")


def _generate_devnet_keypair(result: SetupResult) -> None:
    """Generate a real Solana keypair for devnet usage."""
    try:
        from solders.keypair import Keypair  # type: ignore[import-untyped]

        kp = Keypair()
        result.private_key = str(kp)
        pubkey = str(kp.pubkey())

        keypair_dir = os.path.expanduser("~/.ag402")
        os.makedirs(keypair_dir, exist_ok=True)
        keypair_path = os.path.join(keypair_dir, "devnet-buyer.json")

        # Save keypair bytes as JSON array (same format as solana-keygen)
        import json
        kp_bytes = list(bytes(kp))
        with open(keypair_path, "w") as f:
            json.dump(kp_bytes, f)
        os.chmod(keypair_path, 0o600)

        print(f"  {green('✓')} Keypair generated")
        print(f"  {bold('Public key:')} {pubkey}")
        print(f"  {dim('Keypair saved:')} {keypair_path}")
        print()
        print("  Fund this account for devnet testing:")
        print(f"    {cyan(f'solana airdrop 2 {pubkey} --url https://api.devnet.solana.com')}")
    except ImportError:
        print(f"  {yellow('⚠')} solders package not installed, generating placeholder key")
        print(f"  {dim('  Install: pip install solders')}")
        mock_key = f"test_key_{uuid.uuid4().hex}"
        result.private_key = mock_key
        print(f"  {green('✓')} Generated placeholder key (replace with a real keypair for devnet)")


def print_env_examples() -> None:
    """Print 3 complete .env examples for localnet / devnet / mainnet."""
    print()
    print(bold("  ═══════════════════════════════════════════════════════════"))
    print(bold("    Example 1: Localnet (solana-test-validator)"))
    print(bold("  ═══════════════════════════════════════════════════════════"))
    print()
    print(dim("  # ~/.ag402/.env"))
    print("  X402_MODE=test")
    print("  X402_NETWORK=localnet")
    print("  AG402_ROLE=consumer")
    print("  SOLANA_RPC_URL=http://127.0.0.1:8899")
    print("  X402_DAILY_LIMIT=10.0")
    print("  X402_SINGLE_TX_LIMIT=5.0")
    print("  X402_PER_MINUTE_LIMIT=2.0")
    print("  X402_PER_MINUTE_COUNT=5")
    print()
    print(f"  {bold('Prerequisites:')}")
    print(f"    $ {cyan('solana-test-validator --reset')}")
    print(f"    $ {cyan('ag402 demo --localnet')}")
    print()

    print(bold("  ═══════════════════════════════════════════════════════════"))
    print(bold("    Example 2: Devnet (Solana test network)"))
    print(bold("  ═══════════════════════════════════════════════════════════"))
    print()
    print(dim("  # ~/.ag402/.env"))
    print("  X402_MODE=test")
    print("  X402_NETWORK=devnet")
    print("  AG402_ROLE=consumer")
    print("  SOLANA_RPC_URL=https://api.devnet.solana.com")
    print("  USDC_MINT_ADDRESS=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
    print("  X402_DAILY_LIMIT=10.0")
    print("  X402_SINGLE_TX_LIMIT=5.0")
    print("  X402_PER_MINUTE_LIMIT=2.0")
    print("  X402_PER_MINUTE_COUNT=5")
    print()
    print(dim("  # Private key is stored in encrypted ~/.ag402/wallet.key"))
    print(dim("  # Run 'ag402 setup' to configure (never put keys in .env)"))
    print()
    print(f"  {bold('Prerequisites:')}")
    print(f"    $ {cyan('ag402 setup')}  {dim('(select Devnet, enter private key)')}")
    print(f"    $ {cyan('solana airdrop 2 <PUBKEY> --url devnet')}")
    print(f"    $ {cyan('ag402 demo --devnet')}")
    print()

    print(bold("  ═══════════════════════════════════════════════════════════"))
    print(bold("    Example 3: Mainnet (real USDC)"))
    print(bold("  ═══════════════════════════════════════════════════════════"))
    print()
    print(dim("  # ~/.ag402/.env"))
    print("  X402_MODE=production")
    print("  X402_NETWORK=mainnet")
    print("  AG402_ROLE=consumer")
    print("  SOLANA_RPC_URL=https://api.mainnet-beta.solana.com")
    print("  USDC_MINT_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
    print("  X402_DAILY_LIMIT=10.0")
    print("  X402_SINGLE_TX_LIMIT=5.0")
    print()
    print(dim("  # Private key is stored in encrypted ~/.ag402/wallet.key"))
    print(dim("  # Run 'ag402 setup' to configure (never put keys in .env)"))
    print()
    print(f"  {yellow('⚠')} Uses real funds. Double-check your wallet balance before use.")
    print()


async def init_wallet_after_setup(result: SetupResult) -> None:
    """Initialize wallet DB and deposit test funds after setup completes."""
    from ag402_core.wallet.agent_wallet import AgentWallet

    db_path = os.path.expanduser("~/.ag402/wallet.db")
    wallet = AgentWallet(db_path=db_path)
    await wallet.init_db()

    if result.mode == "test" and result.role in ("consumer", "both"):
        balance = await wallet.get_balance()
        if balance == 0:
            await wallet.deposit(100.0, note="Setup wizard — test funds")
            print(f"  {green('✓')} Deposited $100.00 test funds")

    await wallet.close()
