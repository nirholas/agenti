"""ag402 Prepaid System — buyer-side credential management.

Enables 1ms local payment verification instead of 500ms on-chain.

Usage::

    from ag402_core.prepaid.client import check_and_deduct, rollback_call
    success, cred = check_and_deduct(seller_address)
    if success:
        headers["X-Prepaid-Credential"] = cred.to_header_value()
"""
