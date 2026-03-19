defmodule X402.Facilitator.ErrorTest do
  use ExUnit.Case, async: true

  alias X402.Facilitator.Error

  test "default struct values" do
    error = %Error{}
    assert error.type == :transport_error
    assert error.status == nil
    assert error.body == nil
    assert error.reason == nil
    assert error.retryable == false
    assert error.attempt == nil
  end

  test "message/1 with defaults (nil status, nil attempt, nil reason)" do
    error = %Error{}
    message = Exception.message(error)
    assert message == "facilitator request failed (type=transport_error), retryable=false"
  end

  test "message/1 with status" do
    error = %Error{status: 500}
    message = Exception.message(error)
    assert message =~ "status=500"
  end

  test "message/1 with attempt" do
    error = %Error{attempt: 3}
    message = Exception.message(error)
    assert message =~ "attempt=3"
  end

  test "message/1 with reason" do
    error = %Error{reason: :timeout}
    message = Exception.message(error)
    assert message =~ "reason=:timeout"
  end

  test "message/1 with all fields populated" do
    error = %Error{
      type: :http_error,
      status: 503,
      body: %{"error" => "busy"},
      reason: :service_unavailable,
      retryable: true,
      attempt: 2
    }

    message = Exception.message(error)

    assert message =~
             "facilitator request failed (type=http_error), status=503, attempt=2, retryable=true, reason=:service_unavailable"
  end

  test "message/1 with retryable=true" do
    error = %Error{retryable: true}
    message = Exception.message(error)
    assert message =~ "retryable=true"
  end

  test "can be raised and rescued" do
    assert_raise Error, fn ->
      raise %Error{type: :timeout, reason: :timeout, retryable: true}
    end
  end
end
