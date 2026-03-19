"""Comprehensive CLI tests covering all commands.

Tests cover:
- Parser construction and all subcommands
- Default wallet DB path uses ~/.ag402/wallet.db
- `ag402 init` command with test mode auto-funding
- `ag402 status` command
- `ag402 balance` command
- `ag402 history` with table/json/csv formats
- `ag402 tx <id>` command
- `ag402 config` command
- `ag402 info` command
- `ag402 doctor` command
- `ag402 export` command
- Banner printing
- ANSI color helpers
- Progress bar rendering
- Dispatch logic
"""

from __future__ import annotations

import csv
import json
import os
from unittest.mock import patch

import pytest
from ag402_core.cli import (
    _bar,
    _build_parser,
    _cmd_config,
    _cmd_doctor,
    _cmd_info,
    _print_banner,
    _short_addr,
    _time_ago,
)
from ag402_core.wallet.agent_wallet import AgentWallet

# =====================================================================
# Helper utilities
# =====================================================================


class TestHelpers:
    def test_short_addr_short(self):
        assert _short_addr("abc") == "abc"

    def test_short_addr_long(self):
        addr = "A" * 44
        result = _short_addr(addr)
        assert "..." in result
        assert len(result) < 44

    def test_short_addr_empty(self):
        assert _short_addr("") == "-"

    def test_short_addr_none(self):
        assert _short_addr(None) == "-"

    def test_time_ago_seconds(self):
        import time
        result = _time_ago(time.time() - 30)
        assert "s ago" in result

    def test_time_ago_minutes(self):
        import time
        result = _time_ago(time.time() - 300)
        assert "m ago" in result

    def test_time_ago_hours(self):
        import time
        result = _time_ago(time.time() - 7200)
        assert "h ago" in result

    def test_time_ago_days(self):
        import time
        result = _time_ago(time.time() - 172800)
        assert "d ago" in result

    def test_bar_zero(self):
        result = _bar(0, 10)
        assert "0%" in result

    def test_bar_half(self):
        result = _bar(5, 10)
        assert "50%" in result

    def test_bar_full(self):
        result = _bar(10, 10)
        assert "100%" in result

    def test_bar_over(self):
        result = _bar(15, 10)
        assert "100%" in result

    def test_bar_zero_total(self):
        result = _bar(0, 0)
        assert isinstance(result, str)


# =====================================================================
# Parser tests
# =====================================================================


class TestParser:
    def test_build_parser(self):
        parser = _build_parser()
        assert parser is not None

    def test_init_command(self):
        parser = _build_parser()
        args = parser.parse_args(["init"])
        assert args.command == "init"

    def test_init_default_db(self):
        parser = _build_parser()
        args = parser.parse_args(["init"])
        expected = os.path.expanduser("~/.ag402/wallet.db")
        assert args.db == expected

    def test_init_custom_db(self):
        parser = _build_parser()
        args = parser.parse_args(["init", "--db", "/tmp/test.db"])
        assert args.db == "/tmp/test.db"

    def test_status_command(self):
        parser = _build_parser()
        args = parser.parse_args(["status"])
        assert args.command == "status"

    def test_balance_command(self):
        parser = _build_parser()
        args = parser.parse_args(["balance"])
        assert args.command == "balance"

    def test_balance_default_db(self):
        parser = _build_parser()
        args = parser.parse_args(["balance"])
        expected = os.path.expanduser("~/.ag402/wallet.db")
        assert args.db == expected

    def test_history_command(self):
        parser = _build_parser()
        args = parser.parse_args(["history"])
        assert args.command == "history"
        assert args.limit == 20
        assert args.format == "table"

    def test_history_default_db(self):
        parser = _build_parser()
        args = parser.parse_args(["history"])
        expected = os.path.expanduser("~/.ag402/wallet.db")
        assert args.db == expected

    def test_history_format_json(self):
        parser = _build_parser()
        args = parser.parse_args(["history", "--format", "json", "--output", "/tmp/h.json"])
        assert args.format == "json"
        assert args.output == "/tmp/h.json"

    def test_history_format_csv(self):
        parser = _build_parser()
        args = parser.parse_args(["history", "--format", "csv", "--output", "/tmp/h.csv"])
        assert args.format == "csv"

    def test_history_limit(self):
        parser = _build_parser()
        args = parser.parse_args(["history", "-n", "5"])
        assert args.limit == 5

    def test_tx_command(self):
        parser = _build_parser()
        args = parser.parse_args(["tx", "abc123"])
        assert args.command == "tx"
        assert args.tx_id == "abc123"

    def test_config_command(self):
        parser = _build_parser()
        args = parser.parse_args(["config"])
        assert args.command == "config"

    def test_info_command(self):
        parser = _build_parser()
        args = parser.parse_args(["info"])
        assert args.command == "info"

    def test_doctor_command(self):
        parser = _build_parser()
        args = parser.parse_args(["doctor"])
        assert args.command == "doctor"

    def test_demo_command(self):
        parser = _build_parser()
        args = parser.parse_args(["demo"])
        assert args.command == "demo"

    def test_export_command(self):
        parser = _build_parser()
        args = parser.parse_args(["export"])
        assert args.command == "export"
        assert args.format == "json"

    def test_export_csv(self):
        parser = _build_parser()
        args = parser.parse_args(["export", "--format", "csv", "--output", "/tmp/e.csv"])
        assert args.format == "csv"
        assert args.output == "/tmp/e.csv"

    def test_no_command_returns_none(self):
        parser = _build_parser()
        args = parser.parse_args([])
        assert args.command is None


# =====================================================================
# Init command
# =====================================================================


class TestCmdInit:
    @pytest.mark.asyncio
    async def test_init_creates_wallet(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_init

        db_path = str(tmp_path / "test_init.db")
        with patch.dict(os.environ, {"X402_MODE": "test"}):
            await _cmd_init(db_path)

        captured = capsys.readouterr()
        assert "Wallet Status" in captured.out
        assert "$100" in captured.out or "100.0" in captured.out
        assert os.path.exists(db_path)

    @pytest.mark.asyncio
    async def test_init_production_no_auto_fund(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_init

        db_path = str(tmp_path / "prod_init.db")
        with patch.dict(os.environ, {"X402_MODE": "production"}):
            await _cmd_init(db_path)

        captured = capsys.readouterr()
        assert "PRODUCTION" in captured.out


# =====================================================================
# Status command
# =====================================================================


class TestCmdStatus:
    @pytest.mark.asyncio
    async def test_status_no_wallet(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_status

        fake_db = str(tmp_path / "nonexistent.db")
        with patch.dict(os.environ, {"X402_MODE": "test", "X402_WALLET_DB": fake_db}):
            await _cmd_status()

        captured = capsys.readouterr()
        assert "not initialized" in captured.out.lower() or "not found" in captured.out.lower()

    @pytest.mark.asyncio
    async def test_status_with_wallet(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_status

        db_path = str(tmp_path / "status_test.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(50.0, note="test")
        await wallet.close()

        with patch.dict(os.environ, {"X402_MODE": "test", "X402_WALLET_DB": db_path}):
            await _cmd_status()

        captured = capsys.readouterr()
        assert "Dashboard" in captured.out
        assert "Security Layers" in captured.out
        assert "$50" in captured.out


# =====================================================================
# Balance command
# =====================================================================


class TestCmdBalance:
    @pytest.mark.asyncio
    async def test_balance_shows_amounts(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_balance

        db_path = str(tmp_path / "bal.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(75.0)
        await wallet.close()

        with patch.dict(os.environ, {"X402_MODE": "test"}):
            await _cmd_balance(db_path)

        captured = capsys.readouterr()
        assert "75.0000" in captured.out
        assert "Balance" in captured.out


# =====================================================================
# History command
# =====================================================================


class TestCmdHistory:
    @pytest.mark.asyncio
    async def test_history_empty(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_history

        db_path = str(tmp_path / "hist_empty.db")
        wallet = AgentWallet(db_path=db_path)
        await wallet.init_db()
        await wallet.close()

        await _cmd_history(db_path, 20, "table", "")
        captured = capsys.readouterr()
        assert "No transactions" in captured.out

    @pytest.mark.asyncio
    async def test_history_table(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_history

        db_path = str(tmp_path / "hist_table.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(100.0, note="seed")
        await wallet.deduct(5.0, to_address="addr1")
        await wallet.close()

        await _cmd_history(db_path, 20, "table", "")
        captured = capsys.readouterr()
        assert "Transaction History" in captured.out
        assert "Summary" in captured.out
        assert "deposit" in captured.out
        assert "deduction" in captured.out

    @pytest.mark.asyncio
    async def test_history_export_json(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_history

        db_path = str(tmp_path / "hist_json.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(50.0)
        await wallet.deduct(1.0, to_address="addrA")
        await wallet.close()

        out_file = str(tmp_path / "export.json")
        await _cmd_history(db_path, 20, "json", out_file)

        with open(out_file) as f:
            data = json.load(f)
        assert len(data) == 2
        captured = capsys.readouterr()
        assert "Exported" in captured.out

    @pytest.mark.asyncio
    async def test_history_export_csv(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_history

        db_path = str(tmp_path / "hist_csv.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(50.0)
        await wallet.close()

        out_file = str(tmp_path / "export.csv")
        await _cmd_history(db_path, 20, "csv", out_file)

        with open(out_file) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        assert len(rows) == 1


# =====================================================================
# TX command
# =====================================================================


class TestCmdTx:
    @pytest.mark.asyncio
    async def test_tx_not_found(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_tx

        db_path = str(tmp_path / "tx_miss.db")
        wallet = AgentWallet(db_path=db_path)
        await wallet.init_db()
        await wallet.close()

        await _cmd_tx(db_path, "nonexistent")
        captured = capsys.readouterr()
        assert "not found" in captured.out.lower()

    @pytest.mark.asyncio
    async def test_tx_found(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_tx

        db_path = str(tmp_path / "tx_found.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        tx = await wallet.deposit(25.0, note="test deposit")
        await wallet.close()

        await _cmd_tx(db_path, tx.id[:8])
        captured = capsys.readouterr()
        assert "Transaction Detail" in captured.out
        assert "25.0000" in captured.out
        assert "deposit" in captured.out

    @pytest.mark.asyncio
    async def test_tx_full_id(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_tx

        db_path = str(tmp_path / "tx_full.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        tx = await wallet.deposit(10.0)
        await wallet.close()

        await _cmd_tx(db_path, tx.id)
        captured = capsys.readouterr()
        assert tx.id in captured.out


# =====================================================================
# Config command
# =====================================================================


class TestCmdConfig:
    def test_config_output(self, capsys):
        with patch.dict(os.environ, {"X402_MODE": "test"}):
            _cmd_config()

        captured = capsys.readouterr()
        assert "Safety Configuration" in captured.out
        assert "MAX_SINGLE_TX" in captured.out
        assert "daily_limit" in captured.out
        assert "per_minute" in captured.out.lower()
        assert "Circuit Breaker" in captured.out
        assert "Environment Variables" in captured.out

    def test_config_production_mode(self, capsys):
        with patch.dict(os.environ, {"X402_MODE": "production"}):
            _cmd_config()

        captured = capsys.readouterr()
        assert "PRODUCTION" in captured.out


# =====================================================================
# Info command
# =====================================================================


class TestCmdInfo:
    def test_info_output(self, capsys):
        _cmd_info()
        captured = capsys.readouterr()
        assert "ag402-core" in captured.out
        assert "open402" in captured.out
        assert "Python" in captured.out
        assert "JSON Schema" in captured.out
        assert "Open402" in captured.out


# =====================================================================
# Doctor command
# =====================================================================


class TestCmdDoctor:
    def test_doctor_basic(self, capsys):
        with patch.dict(os.environ, {"X402_MODE": "test"}):
            _cmd_doctor()

        captured = capsys.readouterr()
        assert "Doctor" in captured.out
        assert "Python" in captured.out
        assert "ag402-core" in captured.out
        assert "Overall" in captured.out

    def test_doctor_production_no_key(self, capsys):
        with patch.dict(os.environ, {"X402_MODE": "production", "SOLANA_PRIVATE_KEY": ""}, clear=False):
            _cmd_doctor()

        captured = capsys.readouterr()
        assert "PRODUCTION" in captured.out


# =====================================================================
# Export command
# =====================================================================


class TestCmdExport:
    @pytest.mark.asyncio
    async def test_export_json_default_path(self, tmp_path, capsys, monkeypatch):
        from ag402_core.cli import _cmd_export

        db_path = str(tmp_path / "exp.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(10.0)
        await wallet.close()

        monkeypatch.chdir(tmp_path)
        await _cmd_export(db_path, "json", "")

        out_file = tmp_path / "ag402_history.json"
        assert out_file.exists()
        with open(out_file) as f:
            data = json.load(f)
        assert len(data) == 1

    @pytest.mark.asyncio
    async def test_export_csv_custom_path(self, tmp_path, capsys):
        from ag402_core.cli import _cmd_export

        db_path = str(tmp_path / "exp_csv.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(20.0)
        await wallet.deduct(1.0, to_address="addr1")
        await wallet.close()

        out_file = str(tmp_path / "custom.csv")
        await _cmd_export(db_path, "csv", out_file)

        with open(out_file) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        assert len(rows) == 2
        captured = capsys.readouterr()
        assert "Exported" in captured.out


# =====================================================================
# Banner
# =====================================================================


class TestBanner:
    def test_banner_prints(self, capsys):
        _print_banner()
        captured = capsys.readouterr()
        assert "Ag402" in captured.out
        assert "Payment Engine" in captured.out
        assert "Open402" in captured.out


# =====================================================================
# Main dispatch
# =====================================================================


class TestMainDispatch:
    def test_no_command_exits(self):
        from ag402_core.cli import main

        with patch("sys.argv", ["ag402"]):
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 0

    def test_config_dispatch(self, capsys):
        from ag402_core.cli import main

        with patch("sys.argv", ["ag402", "config"]), \
             patch.dict(os.environ, {"X402_MODE": "test"}):
            main()

        captured = capsys.readouterr()
        assert "Safety Configuration" in captured.out

    def test_info_dispatch(self, capsys):
        from ag402_core.cli import main

        with patch("sys.argv", ["ag402", "info"]):
            main()

        captured = capsys.readouterr()
        assert "ag402-core" in captured.out

    def test_doctor_dispatch(self, capsys):
        from ag402_core.cli import main

        with patch("sys.argv", ["ag402", "doctor"]), \
             patch.dict(os.environ, {"X402_MODE": "test"}):
            main()

        captured = capsys.readouterr()
        assert "Doctor" in captured.out


# =====================================================================
# Wallet export (integration)
# =====================================================================


class TestWalletExport:
    @pytest.mark.asyncio
    async def test_export_json(self, tmp_path):
        db_path = str(tmp_path / "export_test.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(50.0, note="initial")
        await wallet.deduct(1.5, to_address="addrA")
        await wallet.deduct(2.0, to_address="addrB")

        out_path = str(tmp_path / "history.json")
        await wallet.export_history(out_path, format="json")

        with open(out_path) as f:
            data = json.load(f)
        assert len(data) == 3
        types = {r["type"] for r in data}
        assert "deposit" in types
        assert "deduction" in types
        await wallet.close()

    @pytest.mark.asyncio
    async def test_export_csv(self, tmp_path):
        db_path = str(tmp_path / "export_csv.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(50.0, note="initial")
        await wallet.deduct(1.5, to_address="addrA")

        out_path = str(tmp_path / "history.csv")
        await wallet.export_history(out_path, format="csv")

        with open(out_path) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        assert len(rows) == 2
        assert "type" in rows[0]
        assert "amount" in rows[0]
        await wallet.close()


# =====================================================================
# Summary stats
# =====================================================================


class TestHistorySummary:
    @pytest.mark.asyncio
    async def test_get_summary_stats(self, tmp_path):
        db_path = str(tmp_path / "summary.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(100.0)
        await wallet.deduct(1.0, to_address="addrA")
        await wallet.deduct(2.0, to_address="addrB")
        await wallet.deduct(3.0, to_address="addrA")

        stats = await wallet.get_summary_stats()
        assert stats["total_spend"] == pytest.approx(6.0)
        assert stats["today_spend"] == pytest.approx(6.0)
        assert stats["tx_count"] == 3
        assert stats["balance"] == pytest.approx(94.0)
        await wallet.close()

    @pytest.mark.asyncio
    async def test_get_spend_by_address(self, tmp_path):
        db_path = str(tmp_path / "group.db")
        wallet = AgentWallet(db_path=db_path, max_daily_spend=100.0)
        await wallet.init_db()
        await wallet.deposit(100.0)
        await wallet.deduct(1.0, to_address="addrA")
        await wallet.deduct(2.0, to_address="addrB")
        await wallet.deduct(3.0, to_address="addrA")

        by_addr = await wallet.get_spend_by_address()
        assert float(by_addr["addrA"]) == pytest.approx(4.0)
        assert float(by_addr["addrB"]) == pytest.approx(2.0)
        await wallet.close()
