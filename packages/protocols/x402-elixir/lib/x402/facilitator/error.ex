defmodule X402.Facilitator.Error do
  @moduledoc """
  Structured error returned by facilitator verify/settle operations.
  """

  @typedoc """
  Error type identifier.
  """
  @type error_type ::
          :finch_unavailable
          | :http_error
          | :invalid_json
          | :invalid_option
          | :request_setup_failed
          | :timeout
          | :transport_error
          | :unexpected_response

  @type t :: %__MODULE__{
          type: error_type(),
          status: non_neg_integer() | nil,
          body: map() | nil,
          reason: term(),
          retryable: boolean(),
          attempt: pos_integer() | nil
        }

  defexception type: :transport_error,
               status: nil,
               body: nil,
               reason: nil,
               retryable: false,
               attempt: nil

  @impl true
  def message(%__MODULE__{} = error) do
    base = "facilitator request failed (type=#{error.type})"

    base
    |> append_status(error.status)
    |> append_attempt(error.attempt)
    |> append_retryable(error.retryable)
    |> append_reason(error.reason)
  end

  defp append_status(message, nil), do: message
  defp append_status(message, status), do: "#{message}, status=#{status}"

  defp append_attempt(message, nil), do: message
  defp append_attempt(message, attempt), do: "#{message}, attempt=#{attempt}"

  defp append_retryable(message, retryable), do: "#{message}, retryable=#{retryable}"

  defp append_reason(message, nil), do: message
  defp append_reason(message, reason), do: "#{message}, reason=#{inspect(reason)}"
end
