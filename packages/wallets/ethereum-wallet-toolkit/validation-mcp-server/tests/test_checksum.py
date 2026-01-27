"""
Tests for checksum conversion.
"""

import pytest
from validation_mcp.tools.checksum import to_checksum_impl


# EIP-55 official test vectors
EIP55_VECTORS = [
    ("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"),
    ("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359", "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"),
    ("0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb", "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB"),
    ("0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb", "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"),
]


class TestChecksumConversion:
    """Test EIP-55 checksum conversion."""
    
    @pytest.mark.parametrize("input_addr,expected", EIP55_VECTORS)
    def test_checksum_conversion(self, input_addr, expected):
        """Test conversion to checksum format."""
        result = to_checksum_impl(input_addr)
        assert result["checksum_address"] == expected
    
    def test_already_checksummed(self):
        """Test that already checksummed addresses are detected."""
        addr = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
        result = to_checksum_impl(addr)
        
        assert result["checksum_address"] == addr
        assert result["was_already_checksummed"] is True
    
    def test_uppercase_input(self):
        """Test conversion from uppercase."""
        result = to_checksum_impl("0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED")
        assert result["checksum_address"] == "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"
