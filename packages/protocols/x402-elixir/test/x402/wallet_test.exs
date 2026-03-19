defmodule X402.WalletTest do
  use ExUnit.Case, async: true

  doctest X402.Wallet

  alias X402.Wallet

  describe "valid_evm?/1" do
    test "accepts 0x + 40 hex chars" do
      assert Wallet.valid_evm?("0x1111111111111111111111111111111111111111")
      assert Wallet.valid_evm?("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
      assert Wallet.valid_evm?("0xabcdefABCDEF0123456789abcdefABCDEF012345")
    end

    test "rejects boundary and invalid cases" do
      refute Wallet.valid_evm?("0x111111111111111111111111111111111111111")
      refute Wallet.valid_evm?("0x11111111111111111111111111111111111111111")
      refute Wallet.valid_evm?("0x111111111111111111111111111111111111111z")
      refute Wallet.valid_evm?(nil)
    end
  end

  describe "valid_solana?/1" do
    test "accepts base58 strings from 32 to 44 chars" do
      assert Wallet.valid_solana?(String.duplicate("1", 32))
      assert Wallet.valid_solana?(String.duplicate("2", 44))
      assert Wallet.valid_solana?("9xQeWvG816bUx9EPfQmQTYnC16hHhV6bQf8kX6y4YB9")
    end

    test "rejects out-of-range lengths and invalid characters" do
      refute Wallet.valid_solana?(String.duplicate("3", 31))
      refute Wallet.valid_solana?(String.duplicate("4", 45))
      refute Wallet.valid_solana?("0" <> String.duplicate("1", 31))
      refute Wallet.valid_solana?("O" <> String.duplicate("1", 31))
      refute Wallet.valid_solana?(nil)
    end
  end

  describe "valid?/1 and type/1" do
    test "detects evm addresses" do
      wallet = "0x1111111111111111111111111111111111111111"
      assert Wallet.valid?(wallet)
      assert Wallet.type(wallet) == :evm
    end

    test "detects solana addresses" do
      wallet = "9xQeWvG816bUx9EPfQmQTYnC16hHhV6bQf8kX6y4YB9"
      assert Wallet.valid?(wallet)
      assert Wallet.type(wallet) == :solana
    end

    test "returns false and unknown for invalid values" do
      refute Wallet.valid?("")
      refute Wallet.valid?(nil)
      assert Wallet.type("not-a-wallet") == :unknown
      assert Wallet.type(nil) == :unknown
    end
  end
end
