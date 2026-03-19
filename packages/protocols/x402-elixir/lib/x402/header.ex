defmodule X402.Header do
  @moduledoc false

  # Maximum byte size for any x402 encoded header value before Base64/JSON
  # decoding is attempted. Shared by PaymentRequired, PaymentResponse, and
  # PaymentSignature to ensure a single change updates all three decoders.
  @max_header_bytes 8_192

  @doc false
  def max_header_bytes, do: @max_header_bytes
end
