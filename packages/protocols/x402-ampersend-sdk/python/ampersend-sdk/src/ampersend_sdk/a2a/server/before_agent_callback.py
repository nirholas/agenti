from google.adk.agents.base_agent import BeforeAgentCallback
from google.adk.agents.callback_context import CallbackContext
from x402_a2a.core import require_payment


def make_x402_before_agent_callback(
    pay_to_address: str,
    price: str = "$0.001",
    resource: str = "https://dev.local/a2a/task",
    network: str = "base-sepolia",
    description: str = "Payment for this task",
    message: str = "Payment required for task",
) -> BeforeAgentCallback:
    def callback(callback_context: CallbackContext) -> None:
        if callback_context.state.get("x402_payment_verified", False):
            callback_context.state["x402_payment_verified"] = False
            return None

        raise require_payment(
            price=price,
            pay_to_address=pay_to_address,
            resource=resource,
            network=network,
            description=description,
            message=message,
        )

    return callback
