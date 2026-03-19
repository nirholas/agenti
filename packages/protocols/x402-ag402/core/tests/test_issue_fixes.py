"""Tests for issue fixes reported in issues-ag402.md.

BUG-1: `ag402 serve` hardcoded host=127.0.0.1
BUG-2: aiosqlite event loop conflict (uvicorn.run vs asyncio.run)
BUG-3: PersistentReplayGuard.init_db() missing permission check
建议-1: --host CLI parameter missing from serve subcommand
建议-3: `ag402 doctor` missing gateway runtime checks
"""

from __future__ import annotations

import os
import stat

import pytest
from ag402_core.cli import _build_parser, _cmd_doctor
from ag402_core.security.replay_guard import PersistentReplayGuard

# =====================================================================
# BUG-1 + 建议-1: --host parameter exists in serve subcommand
# =====================================================================


class TestServeHostArg:
    """Verify that the serve subcommand accepts --host and defaults to 0.0.0.0."""

    def test_serve_has_host_arg(self):
        """--host should be a recognized argument for 'serve'."""
        parser = _build_parser()
        args = parser.parse_args(["serve", "--host", "0.0.0.0", "--target", "http://localhost:8000"])
        assert args.host == "0.0.0.0"

    def test_serve_host_default_is_all_interfaces(self):
        """Default host should be 0.0.0.0 for container compatibility."""
        parser = _build_parser()
        args = parser.parse_args(["serve", "--target", "http://localhost:8000"])
        assert args.host == "0.0.0.0"

    def test_serve_host_can_be_overridden(self):
        """Users should be able to override host to 127.0.0.1 for local-only."""
        parser = _build_parser()
        args = parser.parse_args(["serve", "--host", "127.0.0.1", "--target", "http://localhost:8000"])
        assert args.host == "127.0.0.1"

    def test_serve_host_custom_value(self):
        """Users should be able to set a custom bind address."""
        parser = _build_parser()
        args = parser.parse_args(["serve", "--host", "192.168.1.100", "--target", "http://localhost:8000"])
        assert args.host == "192.168.1.100"


# =====================================================================
# BUG-2: single event loop — verify _cmd_serve does not call uvicorn.run()
# =====================================================================


class TestServeEventLoop:
    """Verify that _cmd_serve uses asyncio.run + uvicorn.Server, not uvicorn.run."""

    def test_cmd_serve_source_uses_asyncio_run(self):
        """Source code should use asyncio.run(server.serve()) not uvicorn.run()."""
        import inspect

        from ag402_core.cli import _cmd_serve
        source = inspect.getsource(_cmd_serve)
        # Should use uvicorn.Config + uvicorn.Server + asyncio.run pattern
        assert "uvicorn.Config(" in source, "Should use uvicorn.Config for single-loop pattern"
        assert "uvicorn.Server(" in source, "Should use uvicorn.Server for single-loop pattern"
        assert "asyncio.run(" in source, "Should use asyncio.run() for single event loop"
        # Should NOT contain the old uvicorn.run(app, ...) pattern (direct call creates a new loop)
        # We check that uvicorn.run() with the app is not used, but uvicorn.run is still importable
        assert 'uvicorn.run(app,' not in source, "Should not use uvicorn.run(app, ...) — creates new event loop"


# =====================================================================
# BUG-3: PersistentReplayGuard.init_db() permission check
# =====================================================================


class TestReplayGuardPermissionCheck:
    """Verify init_db raises PermissionError for unwritable directories."""

    @pytest.mark.asyncio
    async def test_init_db_raises_on_unwritable_dir(self, tmp_path):
        """init_db should raise PermissionError when directory is not writable."""
        # Create a read-only directory
        ro_dir = tmp_path / "readonly"
        ro_dir.mkdir()
        db_path = str(ro_dir / "test.db")

        # Make it read-only (remove write permission)
        ro_dir.chmod(stat.S_IRUSR | stat.S_IXUSR)

        guard = PersistentReplayGuard(db_path=db_path)
        try:
            with pytest.raises(PermissionError, match="Cannot write to"):
                await guard.init_db()
        finally:
            # Restore permissions for cleanup
            ro_dir.chmod(stat.S_IRWXU)

    @pytest.mark.asyncio
    async def test_init_db_permission_error_includes_uid(self, tmp_path):
        """PermissionError message should include uid info for debugging."""
        ro_dir = tmp_path / "readonly2"
        ro_dir.mkdir()
        db_path = str(ro_dir / "test.db")
        ro_dir.chmod(stat.S_IRUSR | stat.S_IXUSR)

        guard = PersistentReplayGuard(db_path=db_path)
        try:
            with pytest.raises(PermissionError, match="uid"):
                await guard.init_db()
        finally:
            ro_dir.chmod(stat.S_IRWXU)

    @pytest.mark.asyncio
    async def test_init_db_succeeds_on_writable_dir(self, tmp_path):
        """init_db should succeed normally when directory is writable."""
        db_path = str(tmp_path / "test.db")
        guard = PersistentReplayGuard(db_path=db_path)
        await guard.init_db()
        assert guard._db is not None
        await guard.close()

    @pytest.mark.asyncio
    async def test_init_db_creates_missing_directory(self, tmp_path):
        """init_db should create parent directory if it doesn't exist."""
        db_path = str(tmp_path / "nested" / "dir" / "test.db")
        guard = PersistentReplayGuard(db_path=db_path)
        await guard.init_db()
        assert os.path.exists(os.path.dirname(db_path))
        assert guard._db is not None
        await guard.close()


# =====================================================================
# 建议-3: Doctor command gateway checks
# =====================================================================


class TestDoctorGatewayChecks:
    """Verify that `ag402 doctor` includes gateway runtime checks."""

    def test_doctor_source_checks_port(self):
        """Doctor should check if the gateway port is available."""
        import inspect
        source = inspect.getsource(_cmd_doctor)
        assert "Gateway port" in source or "gateway_port" in source

    def test_doctor_source_checks_data_dir(self):
        """Doctor should check if the data directory is writable."""
        import inspect
        source = inspect.getsource(_cmd_doctor)
        assert "writable" in source.lower() or "W_OK" in source

    def test_doctor_source_checks_backend(self):
        """Doctor should check if backend target URL is reachable."""
        import inspect
        source = inspect.getsource(_cmd_doctor)
        assert "Backend" in source or "AG402_TARGET_API" in source

    def test_doctor_runs_without_error(self, capsys):
        """Doctor command should complete without exceptions."""
        from unittest.mock import patch
        with patch.dict(os.environ, {"X402_MODE": "test"}, clear=False):
            _cmd_doctor()
        captured = capsys.readouterr()
        assert "Ag402 Doctor" in captured.out
        # Should include the new gateway section
        assert "Gateway Environment" in captured.out
