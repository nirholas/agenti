import httpx
import json
import base64
import time
import secrets
from eth_account import Account


def _parse_requirements(resp: httpx.Response) -> dict:
    """Parse x402 payment requirements from a 402 response."""
    try:
        return resp.json()
    except Exception:
        raw = resp.headers.get('X-Payment-Requirements', '{}')
        return json.loads(base64.b64decode(raw).decode())


def _sign_evm_payment(requirements: dict, private_key: str) -> dict:
    """Sign an EIP-3009 transferWithAuthorization for x402 payment."""
    account = Account.from_key(private_key)

    scheme = requirements.get('scheme', 'exact')
    network = requirements.get('network', 'base-sepolia')
    asset = requirements.get('asset', {})
    pay_to = requirements.get('payTo', '')
    max_amount = requirements.get('maxAmountRequired', '0')

    valid_after = str(int(time.time()) - 60)
    valid_before = str(int(time.time()) + 300)
    nonce = '0x' + secrets.token_hex(32)

    structured_data = {
        'types': {
            'EIP712Domain': [
                {'name': 'name', 'type': 'string'},
                {'name': 'version', 'type': 'string'},
                {'name': 'chainId', 'type': 'uint256'},
                {'name': 'verifyingContract', 'type': 'address'},
            ],
            'TransferWithAuthorization': [
                {'name': 'from', 'type': 'address'},
                {'name': 'to', 'type': 'address'},
                {'name': 'value', 'type': 'uint256'},
                {'name': 'validAfter', 'type': 'uint256'},
                {'name': 'validBefore', 'type': 'uint256'},
                {'name': 'nonce', 'type': 'bytes32'},
            ],
        },
        'domain': {
            'name': asset.get('name', 'USD Coin'),
            'version': asset.get('version', '2'),
            'chainId': asset.get('chainId', 84532),
            'verifyingContract': asset.get('address', ''),
        },
        'primaryType': 'TransferWithAuthorization',
        'message': {
            'from': account.address,
            'to': pay_to,
            'value': int(max_amount),
            'validAfter': int(valid_after),
            'validBefore': int(valid_before),
            'nonce': nonce,
        },
    }

    signed = account.sign_typed_data(
        domain_data=structured_data['domain'],
        message_types={'TransferWithAuthorization': structured_data['types']['TransferWithAuthorization']},
        message_data=structured_data['message'],
    )

    return {
        'scheme': scheme,
        'network': network,
        'payload': {
            'signature': signed.signature.hex(),
            'authorization': {
                'from': account.address,
                'to': pay_to,
                'value': max_amount,
                'validAfter': valid_after,
                'validBefore': valid_before,
                'nonce': nonce,
            },
        },
    }


async def pay(url: str, private_key: str, method: str = 'GET', **kwargs) -> httpx.Response:
    """Make an HTTP request and auto-pay if the server returns 402."""
    async with httpx.AsyncClient() as client:
        resp = await client.request(method, url, **kwargs)
        if resp.status_code != 402:
            return resp

        requirements = _parse_requirements(resp)
        payment = _sign_evm_payment(requirements, private_key)
        payment_header = base64.b64encode(json.dumps(payment).encode()).decode()

        headers = {**kwargs.pop('headers', {}), 'X-Payment': payment_header}
        return await client.request(method, url, headers=headers, **kwargs)

