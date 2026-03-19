from typing import Protocol, override

from a2a.server.tasks import TaskUpdater
from a2a.types import Part, TextPart
from x402_a2a import (
    X402_EXTENSION_URI,
    x402ExtensionConfig,
    x402PaymentRequiredException,
)
from x402_a2a.executors import x402ServerExecutor
from x402_a2a.types import (
    AgentExecutor,
    EventQueue,
    RequestContext,
)


class X402ServerExecutorFactory(Protocol):
    """Factory protocol for creating X402ServerExecutor instances."""

    def __call__(
        self,
        *,
        delegate: AgentExecutor,
        config: x402ExtensionConfig,
    ) -> "X402ServerExecutor": ...


class X402ServerExecutor(x402ServerExecutor):
    @override
    async def _handle_payment_required_exception(
        self,
        exception: x402PaymentRequiredException,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        context.add_activated_extension(X402_EXTENSION_URI)
        if X402_EXTENSION_URI not in context.requested_extensions:
            assert context.task_id is not None, "task_id must be set"
            assert context.context_id is not None, "context_id must be set"

            updater = TaskUpdater(
                event_queue=event_queue,
                task_id=context.task_id,
                context_id=context.context_id,
            )
            await updater.failed(
                updater.new_agent_message(
                    parts=[
                        Part(
                            root=TextPart(
                                text=f"Client does not support required extension: {X402_EXTENSION_URI}"
                            )
                        )
                    ]
                )
            )
            return

        await super()._handle_payment_required_exception(
            exception, context, event_queue
        )
