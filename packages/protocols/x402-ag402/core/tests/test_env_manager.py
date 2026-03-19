"""Tests for env_manager — .env parsing, loading, and writing."""

from __future__ import annotations

import os
import textwrap

import pytest
from ag402_core.env_manager import (
    load_dotenv,
    parse_env_file,
    save_env_file,
    set_env_value,
)


@pytest.fixture
def env_file(tmp_path):
    """Create a temporary .env file helper."""
    path = tmp_path / ".env"

    def _write(content: str) -> str:
        path.write_text(textwrap.dedent(content))
        return str(path)

    return _write


# ─── parse_env_file ───────────────────────────────────────────────


class TestParseEnvFile:
    def test_basic_key_value(self, env_file):
        path = env_file("FOO=bar\nBAZ=123\n")
        result = parse_env_file(path)
        assert result == {"FOO": "bar", "BAZ": "123"}

    def test_double_quoted(self, env_file):
        path = env_file('KEY="hello world"\n')
        result = parse_env_file(path)
        assert result == {"KEY": "hello world"}

    def test_single_quoted(self, env_file):
        path = env_file("KEY='hello world'\n")
        result = parse_env_file(path)
        assert result == {"KEY": "hello world"}

    def test_value_with_equals(self, env_file):
        """Values containing '=' should be parsed correctly."""
        path = env_file("SECRET_KEY=abc=def=ghi\n")
        result = parse_env_file(path)
        assert result == {"SECRET_KEY": "abc=def=ghi"}

    def test_quoted_value_with_equals(self, env_file):
        path = env_file('SECRET_KEY="abc=def"\n')
        result = parse_env_file(path)
        assert result == {"SECRET_KEY": "abc=def"}

    def test_inline_comment_unquoted(self, env_file):
        """Inline comments after unquoted values should be stripped."""
        path = env_file("PORT=8000 # running port\n")
        result = parse_env_file(path)
        assert result == {"PORT": "8000"}

    def test_inline_comment_in_quoted_preserved(self, env_file):
        """Inline '#' inside quotes should NOT be treated as comment."""
        path = env_file('NOTE="has # hash"\n')
        result = parse_env_file(path)
        assert result == {"NOTE": "has # hash"}

    def test_empty_value(self, env_file):
        path = env_file("EMPTY=\n")
        result = parse_env_file(path)
        assert result == {"EMPTY": ""}

    def test_empty_quoted_value(self, env_file):
        path = env_file('EMPTY=""\n')
        result = parse_env_file(path)
        assert result == {"EMPTY": ""}

    def test_comment_lines_ignored(self, env_file):
        path = env_file("# this is a comment\nKEY=val\n")
        result = parse_env_file(path)
        assert result == {"KEY": "val"}

    def test_blank_lines_ignored(self, env_file):
        path = env_file("\n\nKEY=val\n\n")
        result = parse_env_file(path)
        assert result == {"KEY": "val"}

    def test_export_prefix(self, env_file):
        path = env_file("export FOO=bar\n")
        result = parse_env_file(path)
        assert result == {"FOO": "bar"}

    def test_spaces_around_equals(self, env_file):
        path = env_file("KEY = value\n")
        result = parse_env_file(path)
        assert result == {"KEY": "value"}

    def test_escaped_newline_in_double_quotes(self, env_file):
        path = env_file('MULTI="line1\\nline2"\n')
        result = parse_env_file(path)
        assert result == {"MULTI": "line1\nline2"}

    def test_escaped_quote_in_double_quotes(self, env_file):
        path = env_file('MSG="say \\"hello\\""\n')
        result = parse_env_file(path)
        assert result == {"MSG": 'say "hello"'}

    def test_nonexistent_file_returns_empty(self, tmp_path):
        result = parse_env_file(tmp_path / "nonexistent.env")
        assert result == {}

    def test_unparseable_line_skipped(self, env_file):
        """Malformed lines should be skipped, not crash."""
        path = env_file("GOOD=yes\n!@#$%\nALSO_GOOD=yep\n")
        result = parse_env_file(path)
        assert result == {"GOOD": "yes", "ALSO_GOOD": "yep"}

    def test_complex_real_world(self, env_file):
        """Simulate a realistic .env file."""
        path = env_file("""\
            # Ag402 configuration
            X402_MODE=test
            SOLANA_PRIVATE_KEY="5Jk3abc=def/xyz+123"
            X402_DAILY_LIMIT=50.0
            SOLANA_RPC_URL=https://api.devnet.solana.com
            # This is a comment
            X402_PORT=4020
        """)
        result = parse_env_file(path)
        assert result["X402_MODE"] == "test"
        assert result["SOLANA_PRIVATE_KEY"] == "5Jk3abc=def/xyz+123"
        assert result["X402_DAILY_LIMIT"] == "50.0"
        assert result["SOLANA_RPC_URL"] == "https://api.devnet.solana.com"
        assert result["X402_PORT"] == "4020"
        assert len(result) == 5


# ─── load_dotenv ──────────────────────────────────────────────────


class TestLoadDotenv:
    def test_loads_into_environ(self, env_file, monkeypatch):
        monkeypatch.delenv("TEST_LOAD_KEY", raising=False)
        path = env_file("TEST_LOAD_KEY=loaded_value\n")
        count = load_dotenv(path)
        assert count == 1
        assert os.environ["TEST_LOAD_KEY"] == "loaded_value"

    def test_does_not_override_existing(self, env_file, monkeypatch):
        monkeypatch.setenv("EXISTING_KEY", "original")
        path = env_file("EXISTING_KEY=new_value\n")
        load_dotenv(path, override=False)
        assert os.environ["EXISTING_KEY"] == "original"

    def test_override_mode(self, env_file, monkeypatch):
        monkeypatch.setenv("EXISTING_KEY", "original")
        path = env_file("EXISTING_KEY=new_value\n")
        load_dotenv(path, override=True)
        assert os.environ["EXISTING_KEY"] == "new_value"

    def test_returns_zero_for_missing_file(self, tmp_path):
        count = load_dotenv(tmp_path / "missing.env")
        assert count == 0


# ─── save_env_file ────────────────────────────────────────────────


class TestSaveEnvFile:
    def test_write_and_read_back(self, tmp_path):
        path = tmp_path / ".env"
        save_env_file({"A": "1", "B": "hello"}, path=path, merge=False)
        result = parse_env_file(path)
        assert result == {"A": "1", "B": "hello"}

    def test_merge_mode(self, tmp_path):
        path = tmp_path / ".env"
        save_env_file({"A": "1", "B": "2"}, path=path, merge=False)
        save_env_file({"B": "updated", "C": "3"}, path=path, merge=True)
        result = parse_env_file(path)
        assert result == {"A": "1", "B": "updated", "C": "3"}

    def test_overwrite_mode(self, tmp_path):
        path = tmp_path / ".env"
        save_env_file({"A": "1"}, path=path, merge=False)
        save_env_file({"B": "2"}, path=path, merge=False)
        result = parse_env_file(path)
        assert result == {"B": "2"}
        assert "A" not in result

    def test_special_chars_quoted(self, tmp_path):
        path = tmp_path / ".env"
        save_env_file({"KEY": "has spaces"}, path=path, merge=False)
        result = parse_env_file(path)
        assert result == {"KEY": "has spaces"}

    def test_value_with_equals_roundtrip(self, tmp_path):
        path = tmp_path / ".env"
        save_env_file({"SECRET": "abc=def=ghi"}, path=path, merge=False)
        result = parse_env_file(path)
        assert result == {"SECRET": "abc=def=ghi"}

    def test_creates_parent_dirs(self, tmp_path):
        path = tmp_path / "nested" / "deep" / ".env"
        save_env_file({"K": "V"}, path=path, merge=False)
        assert path.exists()
        assert parse_env_file(path) == {"K": "V"}


# ─── set_env_value ────────────────────────────────────────────────


class TestSetEnvValue:
    def test_set_single_value(self, tmp_path):
        path = tmp_path / ".env"
        save_env_file({"A": "1"}, path=path, merge=False)
        set_env_value("B", "2", path=path)
        result = parse_env_file(path)
        assert result == {"A": "1", "B": "2"}

    def test_update_existing_value(self, tmp_path):
        path = tmp_path / ".env"
        save_env_file({"A": "1"}, path=path, merge=False)
        set_env_value("A", "updated", path=path)
        result = parse_env_file(path)
        assert result == {"A": "updated"}
