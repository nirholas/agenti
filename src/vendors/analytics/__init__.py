import asyncio

from . import server


def main() -> None:
    asyncio.run(server.main())


__all__ = ["main", "server"]
