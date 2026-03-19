# langchain-ampersend

LangChain integration for Ampersend x402 payments. Call remote A2A agents with automatic payment handling.

## Installation

```bash
pip install langchain-ampersend
```

## Usage

```python
from langchain_ampersend import A2AToolkit, create_ampersend_treasurer
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI

# Create treasurer (one-liner setup)
treasurer = create_ampersend_treasurer(
    smart_account_address="0x...",
    session_key_private_key="0x...",
)

# Create toolkit for a remote agent
toolkit = A2AToolkit(
    remote_agent_url="https://agent.example.com",
    treasurer=treasurer,
)

# Initialize (discovers the agent)
await toolkit.initialize()

# Use with LangGraph
llm = ChatOpenAI(model="gpt-4")
agent = create_agent(llm, toolkit.get_tools())

# Run
result = await agent.ainvoke({"messages": [("user", "Query some data")]})
```

## Tools

The toolkit provides two tools:

- `a2a_get_agent_details` - Get the capabilities and skills of the remote agent
- `a2a_send_message` - Send a message to the remote agent (payments handled automatically)
