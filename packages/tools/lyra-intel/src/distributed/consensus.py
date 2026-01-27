"""
Consensus protocols for distributed coordination.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class ConsensusProtocol(Enum):
    RAFT = "raft"
    PAXOS = "paxos"
    PBFT = "pbft"
    SIMPLE_MAJORITY = "simple_majority"


class NodeRole(Enum):
    FOLLOWER = "follower"
    CANDIDATE = "candidate"
    LEADER = "leader"


@dataclass
class ConsensusState:
    current_term: int = 0
    voted_for: Optional[str] = None
    log: list[dict] = field(default_factory=list)
    commit_index: int = 0
    last_applied: int = 0


class ConsensusManager:
    def __init__(self, node_id: str, protocol: ConsensusProtocol = ConsensusProtocol.RAFT):
        self.node_id = node_id
        self.protocol = protocol
        self.role = NodeRole.FOLLOWER
        self.state = ConsensusState()
        self.peers: dict[str, str] = {}  # node_id -> address
        self.leader_id: Optional[str] = None
        self._running = False
        self._election_timeout = 5.0
        self._last_heartbeat = datetime.utcnow()

    async def start(self) -> None:
        self._running = True
        asyncio.create_task(self._election_timer())

    async def stop(self) -> None:
        self._running = False

    def add_peer(self, node_id: str, address: str) -> None:
        self.peers[node_id] = address

    def remove_peer(self, node_id: str) -> None:
        self.peers.pop(node_id, None)

    async def _election_timer(self) -> None:
        while self._running:
            await asyncio.sleep(1.0)
            if self.role != NodeRole.LEADER:
                elapsed = (datetime.utcnow() - self._last_heartbeat).total_seconds()
                if elapsed > self._election_timeout:
                    await self._start_election()

    async def _start_election(self) -> None:
        self.role = NodeRole.CANDIDATE
        self.state.current_term += 1
        self.state.voted_for = self.node_id
        votes_received = 1  # Vote for self

        # Request votes from peers
        required_votes = (len(self.peers) + 1) // 2 + 1

        # In production, would send RequestVote RPCs to all peers
        # For now, simulate peer responses for single-node clusters
        for peer_id in self.peers:
            # Simplified: assume vote granted if no leader
            if self.leader_id is None:
                votes_received += 1

        if votes_received >= required_votes:
            await self._become_leader()

    async def _become_leader(self) -> None:
        self.role = NodeRole.LEADER
        self.leader_id = self.node_id
        asyncio.create_task(self._send_heartbeats())

    async def _send_heartbeats(self) -> None:
        while self._running and self.role == NodeRole.LEADER:
            # In production, send AppendEntries RPCs to all peers
            await asyncio.sleep(1.0)

    def receive_heartbeat(self, leader_id: str, term: int) -> bool:
        if term >= self.state.current_term:
            self.state.current_term = term
            self.leader_id = leader_id
            self.role = NodeRole.FOLLOWER
            self._last_heartbeat = datetime.utcnow()
            return True
        return False

    def request_vote(self, candidate_id: str, term: int) -> bool:
        if term > self.state.current_term:
            self.state.current_term = term
            self.state.voted_for = None

        if term == self.state.current_term and self.state.voted_for in [None, candidate_id]:
            self.state.voted_for = candidate_id
            return True
        return False

    async def propose(self, command: dict) -> bool:
        if self.role != NodeRole.LEADER:
            return False

        entry = {
            "term": self.state.current_term,
            "command": command,
            "index": len(self.state.log),
        }
        self.state.log.append(entry)

        # In production, replicate to followers
        required_acks = (len(self.peers) + 1) // 2 + 1
        # Simulate immediate consensus for simplicity
        self.state.commit_index = entry["index"]
        return True

    def get_committed_entries(self) -> list[dict]:
        return self.state.log[:self.state.commit_index + 1]

    def is_leader(self) -> bool:
        return self.role == NodeRole.LEADER

    def get_leader(self) -> Optional[str]:
        return self.leader_id

    def get_status(self) -> dict:
        return {
            "node_id": self.node_id,
            "protocol": self.protocol.value,
            "role": self.role.value,
            "term": self.state.current_term,
            "leader_id": self.leader_id,
            "log_length": len(self.state.log),
            "commit_index": self.state.commit_index,
            "peers": list(self.peers.keys()),
        }
