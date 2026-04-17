from eth_account import Account
from solders.keypair import Keypair
import secrets


def generate_wallet() -> dict:
    evm_key = '0x' + secrets.token_hex(32)
    evm_account = Account.from_key(evm_key)
    sol_kp = Keypair()
    return {
        'evm': {'address': evm_account.address, 'private_key': evm_key},
        'solana': {'address': str(sol_kp.pubkey()), 'private_key': sol_kp.secret().hex()},
    }
