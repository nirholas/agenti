from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(f"Missing env var: {name}")
    return val


PRIVATE_KEY = _require_env("WALLET_PRIVATE_KEY")
MODEL = os.getenv("MODEL", "qwen3-coder-next")
CYCLE_INTERVAL_S = int(os.getenv("CYCLE_INTERVAL_S", "60"))
RPC_URL = os.getenv("RPC_URL")
