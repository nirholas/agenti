import httpx

USDC_DECIMALS = 6
SOL_DECIMALS = 9

# USDC contract addresses by network
USDC_ADDRESSES = {
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
}

ERC20_BALANCE_OF_SIG = '0x70a08231'  # balanceOf(address)


async def get_evm_usdc_balance(address: str, network: str = 'base-sepolia') -> float:
    """Query USDC balance for an EVM address via eth_call."""
    rpc_urls = {
        'base': 'https://mainnet.base.org',
        'base-sepolia': 'https://sepolia.base.org',
        'ethereum': 'https://eth.llamarpc.com',
    }
    rpc_url = rpc_urls.get(network, rpc_urls['base-sepolia'])
    usdc = USDC_ADDRESSES.get(network, USDC_ADDRESSES['base-sepolia'])

    padded_address = address.lower().replace('0x', '').zfill(64)
    data = ERC20_BALANCE_OF_SIG + padded_address

    payload = {
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'eth_call',
        'params': [{'to': usdc, 'data': data}, 'latest'],
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(rpc_url, json=payload, timeout=10)
        result = resp.json().get('result', '0x0')
        raw = int(result, 16)
        return raw / (10 ** USDC_DECIMALS)


async def get_sol_balance(address: str) -> float:
    """Query SOL balance for a Solana address via getBalance RPC."""
    rpc_url = 'https://api.mainnet-beta.solana.com'
    payload = {
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'getBalance',
        'params': [address],
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(rpc_url, json=payload, timeout=10)
        lamports = resp.json().get('result', {}).get('value', 0)
        return lamports / (10 ** SOL_DECIMALS)


async def get_balances(evm_address: str | None = None, sol_address: str | None = None, network: str = 'base-sepolia') -> dict:
    """Get USDC (EVM) and SOL balances for the given addresses."""
    result = {}
    if evm_address:
        result['usdc'] = await get_evm_usdc_balance(evm_address, network)
        result['evm_address'] = evm_address
    if sol_address:
        result['sol'] = await get_sol_balance(sol_address)
        result['sol_address'] = sol_address
    return result
