"""
Tests for storage slot tools.
"""

import pytest
from validation_mcp.tools.storage import calculate_storage_slot_impl


class TestCalculateStorageSlot:
    """Tests for storage slot calculation."""
    
    def test_simple_slot(self):
        """Test simple storage slot."""
        result = calculate_storage_slot_impl(base_slot='0x0')
        
        assert result.get('error') is not True
        assert 'storage_slot' in result
        assert result['slot_type'] == 'simple'
    
    def test_mapping_slot(self):
        """Test mapping storage slot computation."""
        result = calculate_storage_slot_impl(
            base_slot='0x0',
            key='0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
            slot_type='mapping'
        )
        
        assert result.get('error') is not True
        assert 'storage_slot' in result
        assert result['slot_type'] == 'mapping'
        assert result['storage_slot'].startswith('0x')
        assert len(result['storage_slot']) == 66  # 0x + 64 hex chars
    
    def test_mapping_different_base_slots(self):
        """Test that different base slots give different results."""
        key = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
        
        result1 = calculate_storage_slot_impl(base_slot='0x0', key=key, slot_type='mapping')
        result2 = calculate_storage_slot_impl(base_slot='0x1', key=key, slot_type='mapping')
        
        assert result1['storage_slot'] != result2['storage_slot']
    
    def test_dynamic_array_slot(self):
        """Test dynamic array storage slot computation."""
        result = calculate_storage_slot_impl(
            base_slot='0x5',
            slot_type='dynamic_array'
        )
        
        assert result.get('error') is not True
        assert 'storage_slot' in result
        assert result['slot_type'] == 'dynamic_array'
    
    def test_mapping_missing_key(self):
        """Test mapping without key returns error."""
        result = calculate_storage_slot_impl(base_slot='0x0', slot_type='mapping')
        assert result.get('error') is True
