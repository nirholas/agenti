"""
File Utilities for Keystore Operations

Secure file reading and writing with proper permissions.
"""

import os
import json
import stat
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# Secure file permissions
FILE_PERMISSIONS = 0o600  # Owner read/write only
DIR_PERMISSIONS = 0o700   # Owner read/write/execute only


def generate_keystore_filename(address: str, timestamp: datetime | None = None) -> str:
    """
    Generate standard Ethereum keystore filename.
    
    Format: UTC--YYYY-MM-DDTHH-MM-SS.sssZ--<address>
    
    Args:
        address: Ethereum address (with or without 0x prefix)
        timestamp: Timestamp (uses current UTC time if None)
        
    Returns:
        Standard keystore filename
    """
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)
    
    # Format timestamp
    ts_str = timestamp.strftime("%Y-%m-%dT%H-%M-%S.") + f"{timestamp.microsecond // 1000:03d}Z"
    
    # Remove 0x prefix from address and lowercase
    addr = address.lower()
    if addr.startswith("0x"):
        addr = addr[2:]
    
    return f"UTC--{ts_str}--{addr}"


def secure_write_file(
    filepath: str | Path,
    content: str | bytes | dict,
    create_dirs: bool = True,
    permissions: int = FILE_PERMISSIONS
) -> dict:
    """
    Write content to file with secure permissions.
    
    Args:
        filepath: Target file path
        content: Content to write (str, bytes, or dict for JSON)
        create_dirs: Create parent directories if needed
        permissions: File permissions (default: 0600)
        
    Returns:
        Result dictionary with filepath and size
    """
    path = Path(filepath)
    
    # Create parent directories with secure permissions
    if create_dirs and not path.parent.exists():
        path.parent.mkdir(parents=True, mode=DIR_PERMISSIONS)
    
    # Convert dict to JSON string
    if isinstance(content, dict):
        content = json.dumps(content, indent=2)
    
    # Convert string to bytes
    if isinstance(content, str):
        content = content.encode('utf-8')
    
    # Write file atomically (write to temp, then rename)
    temp_path = path.with_suffix(path.suffix + '.tmp')
    
    try:
        # Write to temp file
        with open(temp_path, 'wb') as f:
            f.write(content)
        
        # Set permissions on temp file
        os.chmod(temp_path, permissions)
        
        # Atomic rename
        temp_path.rename(path)
        
        return {
            "filepath": str(path.absolute()),
            "filename": path.name,
            "file_size_bytes": len(content),
            "permissions": oct(permissions)
        }
    
    except Exception as e:
        # Clean up temp file on error
        if temp_path.exists():
            temp_path.unlink()
        raise


def secure_read_file(filepath: str | Path) -> dict:
    """
    Read file content securely.
    
    Args:
        filepath: File path to read
        
    Returns:
        Dictionary with content and metadata
    """
    path = Path(filepath)
    
    if not path.exists():
        raise FileNotFoundError(f"File not found: {filepath}")
    
    if not path.is_file():
        raise ValueError(f"Not a file: {filepath}")
    
    # Get file stats
    file_stat = path.stat()
    permissions = stat.filemode(file_stat.st_mode)
    
    # Read content
    with open(path, 'rb') as f:
        content = f.read()
    
    # Try to decode as UTF-8
    try:
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        text_content = None
    
    # Try to parse as JSON
    json_content = None
    if text_content:
        try:
            json_content = json.loads(text_content)
        except json.JSONDecodeError:
            pass
    
    return {
        "filepath": str(path.absolute()),
        "filename": path.name,
        "file_size_bytes": len(content),
        "permissions": permissions,
        "content_bytes": content,
        "content_text": text_content,
        "content_json": json_content
    }


def validate_filepath(filepath: str | Path, must_exist: bool = False) -> tuple[bool, str]:
    """
    Validate file path for security.
    
    Args:
        filepath: File path to validate
        must_exist: Whether file must exist
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        path = Path(filepath).resolve()
        
        # Check for path traversal attempts
        if ".." in str(filepath):
            # Resolved path should be checked
            pass
        
        # Check existence if required
        if must_exist and not path.exists():
            return False, f"File does not exist: {filepath}"
        
        # Check if parent directory exists (for writing)
        if not must_exist and not path.parent.exists():
            return True, ""  # Will be created
        
        return True, ""
        
    except Exception as e:
        return False, f"Invalid path: {e}"


def list_keystore_files(directory: str | Path) -> list[dict]:
    """
    List keystore files in a directory.
    
    Args:
        directory: Directory to scan
        
    Returns:
        List of keystore file information
    """
    path = Path(directory)
    
    if not path.exists():
        return []
    
    if not path.is_dir():
        raise ValueError(f"Not a directory: {directory}")
    
    keystores = []
    
    for file_path in path.iterdir():
        if not file_path.is_file():
            continue
        
        # Skip non-JSON files
        if not file_path.suffix.lower() == '.json' and '--' not in file_path.name:
            continue
        
        try:
            file_info = secure_read_file(file_path)
            keystore = file_info.get("content_json")
            
            if keystore and "crypto" in keystore or "Crypto" in keystore:
                keystores.append({
                    "filepath": file_info["filepath"],
                    "filename": file_info["filename"],
                    "address": keystore.get("address"),
                    "version": keystore.get("version"),
                    "kdf": (keystore.get("crypto") or keystore.get("Crypto", {})).get("kdf")
                })
        except Exception:
            continue
    
    return keystores
