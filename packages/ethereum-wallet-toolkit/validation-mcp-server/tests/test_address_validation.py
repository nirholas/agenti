"""
Tests for address validation tools.
"""

import pytest
from validation_mcp.tools.address_validation import (
    validate_address_impl,
    batch_validate_addresses_impl,
    _is_checksum_address,
    _detect_address_format,
)


# EIP-55 test vectors
EIP55_TEST_VECTORS = [
    ("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", True),
    ("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", True),
    ("0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB", True),
    ("0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb", True),
]


class TestChecksumValidation:
    """Test EIP-55 checksum validation."""
    
    @pytest.mark.parametrize("address,expected", EIP55_TEST_VECTORS)
    def test_valid_checksum_addresses(self, address, expected):
        """Test that valid checksummed addresses pass validation."""
        assert _is_checksum_address(address) == expected
    
    def test_lowercase_address_not_checksummed(self):
        """Lowercase addresses should not be considered checksummed."""
        addr = "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"
        assert not _is_checksum_address(addr)
    
    def test_invalid_checksum_detected(self):
        """Invalid checksums should be detected."""
        invalid = "0x5Aeb6053F3E94C9b9A09f33669435E7Ef1BeAed"  # Wrong case
        assert not _is_checksum_address(invalid)


class TestFormatDetection:
    """Test address format detection."""
    
    def test_detect_lowercase(self):
        """Should detect lowercase format."""
        addr = "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"
        assert _detect_address_format(addr) == "lowercase"
    
    def test_detect_uppercase(self):
        """Should detect uppercase format."""
        addr = "0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED"
        assert _detect_address_format(addr) == "uppercase"
    
    def test_detect_checksum(self):
        """Should detect valid checksum format."""
        addr = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
        assert _detect_address_format(addr) == "checksum"
    
    def test_detect_invalid_mixed(self):
        """Should detect invalid mixed case."""
        addr = "0x5Aaeb6053f3e94c9b9a09f33669435e7ef1beaed"
        assert _detect_address_format(addr) == "mixed_invalid"


class TestAddressValidation:
    """Integration tests for address validation."""
    
    def test_valid_address(self):
        """Test validation of a valid address."""
        result = validate_address_impl("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed")
        
        assert result["is_valid"] is True
        assert result["checksum_status"] == "valid"
        assert result["byte_length"] == 20
    
    def test_invalid_length(self):
        """Test validation of address with wrong length."""
        result = validate_address_impl("0x1234")
        assert result["is_valid"] is False


class TestBatchValidation:
    """Test batch address validation."""
    
    def test_batch_mixed_addresses(self):
        """Test batch validation with valid and invalid addresses."""
        addresses = [
            "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",  # Valid
            "0x1234",  # Invalid - too short
            "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",  # Valid
        ]
        
        result = batch_validate_addresses_impl(addresses)
        
        assert result["total_count"] == 3
        assert result["valid_count"] == 2
        assert result["invalid_count"] == 1
        assert result["all_valid"] is False
