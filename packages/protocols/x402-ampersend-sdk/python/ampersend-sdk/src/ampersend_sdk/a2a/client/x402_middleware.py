import logging
from typing import Any, AsyncIterator, Dict, Protocol

from a2a.client import ClientCallContext, ClientEvent
from a2a.types import Message, TaskState
from x402_a2a import create_payment_submission_message
from x402_a2a.core.utils import x402Utils
from x402_a2a.types import PaymentStatus

from ...x402.treasurer import X402Authorization, X402Treasurer

logger = logging.getLogger(__name__)


class MessageSender(Protocol):
    def __call__(
        self,
        request: Message,
        *,
        context: ClientCallContext | None = None,
    ) -> AsyncIterator[ClientEvent | Message]: ...


async def _onStatus(
    treasurer: X402Treasurer,
    status: PaymentStatus,
    authorization: X402Authorization,
    context: Dict[str, Any] | None = None,
) -> None:
    try:
        # TODO: don't await
        await treasurer.onStatus(
            status=status,
            authorization=authorization,
            context=context,
        )
    except Exception as e:
        logger.error(f'treasurer.onStatus failed with "{e}"')


async def x402_middleware(
    treasurer: X402Treasurer,
    send_message: MessageSender,
    request: Message,
    utils: x402Utils,
    context: ClientCallContext | None = None,
) -> AsyncIterator[ClientEvent | Message]:
    # TODO: move authorization to a store.
    async def recursive(
        request: Message,
        authorization: X402Authorization | None = None,
    ) -> AsyncIterator[ClientEvent | Message]:
        async for base_response in send_message(request=request, context=context):
            # case: not x402 related
            if isinstance(base_response, Message):
                yield base_response
                continue

            # TODO: support streaming responses
            # should check for TaskUpdate events
            task, _ = base_response
            payment_status = utils.get_payment_status(task)

            # case: not x402 related
            if payment_status is None:
                yield base_response
                continue

            if authorization is not None:
                await _onStatus(
                    treasurer=treasurer,
                    status=payment_status,
                    authorization=authorization,
                )

            # case: after payment submitted
            if (
                task.status.state != TaskState.input_required
                or payment_status != PaymentStatus.PAYMENT_REQUIRED
            ):
                yield base_response
                continue

            if authorization is not None:
                logger.error(f"x402 spec issue: payment required but have already paid")
                yield base_response
                continue

            # case: payment required
            payment_required = utils.get_payment_requirements(task)
            if payment_required is None:
                logger.error(
                    f"x402 spec issue: missing x402PaymentRequiredResponse in task {task.id}"
                )
                yield base_response
                continue

            try:
                authorization = await treasurer.onPaymentRequired(
                    payment_required=payment_required
                )
            except Exception as e:
                logger.error(f'treasurer.onPaymentRequired failed with "{e}"')
                yield base_response
                continue

            if authorization is None:
                logger.info(f"treasurer rejected to pay for task {task.id}")
                yield base_response
                continue

            message = create_payment_submission_message(
                task_id=task.id, payment_payload=authorization.payment
            )

            # FIX-ME: this is required by the server, there might be bug in
            # A2aAgentExecutor because context_id is, in theory, optional.
            message.context_id = task.context_id

            async for response in recursive(
                request=message, authorization=authorization
            ):
                yield response

    async for response in recursive(request=request):
        yield response
