from libertai_agentkit_plugin.types import ToolExecution


def test_tool_execution_minimal():
    te = ToolExecution(name="echo")
    assert te.name == "echo"
    assert te.args is None
    assert te.result is None


def test_tool_execution_full():
    te = ToolExecution(name="buy", args={"amount": "10"}, result="ok", tx_hash="0xabc")
    assert te.args == {"amount": "10"}
    assert te.tx_hash == "0xabc"
