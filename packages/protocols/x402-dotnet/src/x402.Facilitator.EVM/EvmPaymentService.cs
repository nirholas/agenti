using Nethereum.ABI.EIP712;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.Signer.EIP712;
using Nethereum.Web3;
using Newtonsoft.Json;
using System.Numerics;
using x402.Core.Models.Facilitator;
using x402.Core.Models.v2;

namespace x402.Facilitator.EVM
{
    public class EvmPaymentService : IPaymentService
    {
        private readonly IWeb3 _web3;
        private readonly string _facilitatorAddress;

        public EvmPaymentService(IWeb3 web3, string facilitatorAddress)
        {
            _web3 = web3;
            _facilitatorAddress = facilitatorAddress;
        }

        private void VerifySchemesAndNetworks(PaymentPayloadHeader payload, PaymentRequirements requirements)
        {
            if (payload.Accepted.Scheme != Core.Enums.PaymentScheme.Exact || requirements.Scheme != Core.Enums.PaymentScheme.Exact)
                throw new ArgumentException(FacilitatorErrorCodes.UnsupportedScheme);

            if (payload.Accepted.Network != requirements.Network)
                throw new ArgumentException(FacilitatorErrorCodes.InvalidNetwork);

            // Validate it's an EVM network
            if (string.IsNullOrEmpty(requirements.Network))
                throw new ArgumentException(FacilitatorErrorCodes.InvalidNetwork);
        }

        public async Task<VerificationResponse> VerifyPayment(PaymentPayloadHeader payload, PaymentRequirements requirements)
        {
            var payer = payload.ExtractPayerFromPayload();

            try
            {
                VerifySchemesAndNetworks(payload, requirements);

                var auth = payload.Payload.Authorization;
                if (auth == null)
                    throw new ArgumentException(FacilitatorErrorCodes.InvalidPayload);

                // Verify signature recovery
                var recoveredSigner = RecoverSigner(payload, requirements);

                if (!string.Equals(recoveredSigner, auth.From, StringComparison.OrdinalIgnoreCase))
                    throw new ArgumentException(FacilitatorErrorCodes.InvalidExactEvmPayloadSignature);

                // Verify recipient matches
                if (!string.Equals(auth.To, requirements.PayTo, StringComparison.OrdinalIgnoreCase))
                    throw new ArgumentException(FacilitatorErrorCodes.InvalidExactEvmPayloadRecipientMismatch);

                // Verify amount
                var authValue = BigInteger.Parse(auth.Value);
                var requiredValue = BigInteger.Parse(requirements.Amount);
                if (authValue < requiredValue)
                    throw new ArgumentException(FacilitatorErrorCodes.InvalidExactEvmPayloadAuthorizationValue);

                // Verify time windows
                var now = (ulong)DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var validAfter = ulong.Parse(auth.ValidAfter);
                var validBefore = ulong.Parse(auth.ValidBefore);

                if (now < validAfter)
                    throw new ArgumentException(FacilitatorErrorCodes.InvalidExactEvmPayloadAuthorizationValidAfter);

                if (now > validBefore)
                    throw new ArgumentException(FacilitatorErrorCodes.InvalidExactEvmPayloadAuthorizationValidBefore);

                return new VerificationResponse
                {
                    IsValid = true,
                    Payer = payer
                };
            }
            catch (ArgumentException e) when (e.Message.StartsWith("unsupported") || e.Message.StartsWith("invalid"))
            {
                return new VerificationResponse
                {
                    IsValid = false,
                    InvalidReason = e.Message,
                    Payer = payer
                };
            }
            catch (Exception e)
            {
                Console.WriteLine($"Unexpected verify error: {e.Message}");
                return new VerificationResponse
                {
                    IsValid = false,
                    InvalidReason = FacilitatorErrorCodes.UnexpectedVerifyError,
                    Payer = payer
                };
            }
        }

        public async Task<SettlementResponse> SettlePayment(PaymentPayloadHeader payload, PaymentRequirements requirements)
        {
            var verifyResponse = await VerifyPayment(payload, requirements);

            if (!verifyResponse.IsValid)
            {
                return new SettlementResponse
                {
                    Success = false,
                    ErrorReason = verifyResponse.InvalidReason,
                    Network = payload.Accepted.Network,
                    Transaction = "",
                    Payer = verifyResponse.Payer
                };
            }

            try
            {
                var auth = payload.Payload.Authorization;
                var payer = verifyResponse.Payer;

                // Get contract
                var contract = _web3.Eth.GetContract(Eip3009Abi, requirements.Asset);
                var receiveWithAuthorizationFunction = contract.GetFunction("receiveWithAuthorization");

                // Prepare parameters for receiveWithAuthorization
                var from = auth.From;
                var to = auth.To;
                var value = BigInteger.Parse(auth.Value);
                var validAfter = BigInteger.Parse(auth.ValidAfter);
                var validBefore = BigInteger.Parse(auth.ValidBefore);
                var nonce = auth.Nonce.HexToByteArray();

                // v, r, s from signature
                var signature = payload.Payload.Signature;
                var (v, r, s) = ParseSignature(signature);

                // Call receiveWithAuthorization
                var txInput = receiveWithAuthorizationFunction.CreateTransactionInput(
                    _facilitatorAddress,
                    from,
                    to,
                    value,
                    validAfter,
                    validBefore,
                    nonce,
                    v,
                    r,
                    s
                );

                var txHash = await _web3.Eth.Transactions.SendTransaction.SendRequestAsync(txInput);

                // Wait for transaction receipt
                var receipt = await _web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(txHash);

                // Poll for receipt if not immediately available
                int maxAttempts = 30;
                int attempt = 0;
                while (receipt == null && attempt < maxAttempts)
                {
                    await Task.Delay(2000);
                    receipt = await _web3.Eth.Transactions.GetTransactionReceipt.SendRequestAsync(txHash);
                    attempt++;
                }

                if (receipt == null)
                {
                    return new SettlementResponse
                    {
                        Success = false,
                        ErrorReason = FacilitatorErrorCodes.InvalidTransactionState,
                        Network = payload.Accepted.Network,
                        Transaction = txHash,
                        Payer = payer
                    };
                }

                if (receipt.Status?.Value != 1)
                {
                    return new SettlementResponse
                    {
                        Success = false,
                        ErrorReason = FacilitatorErrorCodes.InvalidTransactionState,
                        Network = payload.Accepted.Network,
                        Transaction = txHash,
                        Payer = payer
                    };
                }

                return new SettlementResponse
                {
                    Success = true,
                    ErrorReason = null,
                    Network = payload.Accepted.Network,
                    Transaction = txHash,
                    Payer = payer
                };
            }
            catch (Exception e)
            {
                Console.WriteLine($"Unexpected settle error: {e.Message}");
                return new SettlementResponse
                {
                    Success = false,
                    ErrorReason = FacilitatorErrorCodes.UnexpectedSettleError,
                    Network = payload.Accepted.Network,
                    Transaction = "",
                    Payer = verifyResponse.Payer
                };
            }
        }

        private string RecoverSigner(PaymentPayloadHeader payload, PaymentRequirements requirements)
        {
            var auth = payload.Payload.Authorization;
            var signature = payload.Payload.Signature;

            // Build EIP-712 typed data
            var tokenName = requirements.Extra?.Name ?? string.Empty;
            var tokenVersion = requirements.Extra?.Version ?? string.Empty;
            var chainId = GetChainIdFromNetwork(requirements.Network);

            var typedData = new TypedData<Domain>
            {
                Domain = new Domain
                {
                    Name = tokenName,
                    Version = tokenVersion,
                    ChainId = chainId,
                    VerifyingContract = requirements.Asset
                },
                Types = MemberDescriptionFactory.GetTypesMemberDescription(typeof(Domain), typeof(TransferWithAuthorization)),
                PrimaryType = nameof(TransferWithAuthorization),
            };

            var message = new TransferWithAuthorization
            {
                From = auth.From,
                To = auth.To,
                Value = BigInteger.Parse(auth.Value),
                ValidAfter = BigInteger.Parse(auth.ValidAfter),
                ValidBefore = BigInteger.Parse(auth.ValidBefore),
                Nonce = auth.Nonce.HexToByteArray()
            };

            typedData.SetMessage(message);

            var signer = new Eip712TypedDataSigner();
            var recoveredAddress = signer.RecoverFromSignatureV4(message, typedData, signature);

            return recoveredAddress;
        }

        private ulong GetChainIdFromNetwork(string network)
        {
            if (network.Contains("eip155:", StringComparison.InvariantCultureIgnoreCase))
            {
                var value = network[(network.IndexOf("eip155:", StringComparison.InvariantCultureIgnoreCase) + "eip155:".Length)..];
                return ulong.Parse(value);
            }

            // Map network names to chain IDs
            return network.ToLowerInvariant() switch
            {
                "base-sepolia" => 84532,
                "base" => 8453,
                "avalanche-fuji" => 43113,
                "avalanche" => 43114,
                "polygon" => 137,
                "polygon-amoy" => 80002,
                "iotex" => 4689,
                "peaq" => 3338,
                "sei" => 1329,
                "sei-testnet" => 1328,
                _ => throw new ArgumentException($"Unknown network: {network}")
            };
        }

        private (byte v, byte[] r, byte[] s) ParseSignature(string signature)
        {
            // Remove 0x prefix if present
            if (signature.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
                signature = signature.Substring(2);

            var signatureBytes = signature.HexToByteArray();

            if (signatureBytes.Length != 65)
                throw new ArgumentException("Invalid signature length");

            var r = new byte[32];
            var s = new byte[32];
            var v = signatureBytes[64];

            Array.Copy(signatureBytes, 0, r, 0, 32);
            Array.Copy(signatureBytes, 32, s, 0, 32);

            return (v, r, s);
        }

        // EIP-3009 ABI for receiveWithAuthorization function
        private const string Eip3009Abi = @"[
            {
                ""inputs"": [
                    { ""internalType"": ""address"", ""name"": ""from"", ""type"": ""address"" },
                    { ""internalType"": ""address"", ""name"": ""to"", ""type"": ""address"" },
                    { ""internalType"": ""uint256"", ""name"": ""value"", ""type"": ""uint256"" },
                    { ""internalType"": ""uint256"", ""name"": ""validAfter"", ""type"": ""uint256"" },
                    { ""internalType"": ""uint256"", ""name"": ""validBefore"", ""type"": ""uint256"" },
                    { ""internalType"": ""bytes32"", ""name"": ""nonce"", ""type"": ""bytes32"" },
                    { ""internalType"": ""uint8"", ""name"": ""v"", ""type"": ""uint8"" },
                    { ""internalType"": ""bytes32"", ""name"": ""r"", ""type"": ""bytes32"" },
                    { ""internalType"": ""bytes32"", ""name"": ""s"", ""type"": ""bytes32"" }
                ],
                ""name"": ""receiveWithAuthorization"",
                ""outputs"": [],
                ""stateMutability"": ""nonpayable"",
                ""type"": ""function""
            }
        ]";
    }

    [Struct("TransferWithAuthorization")]
    public class TransferWithAuthorization
    {
        [Parameter("address", "from", order: 1)]
        [JsonProperty("from")]
        public virtual required string From { get; set; }

        [Parameter("address", "to", order: 2)]
        [JsonProperty("to")]
        public virtual required string To { get; set; }

        [Parameter("uint256", "value", order: 3)]
        [JsonProperty("value")]
        public virtual BigInteger Value { get; set; }

        [Parameter("uint256", "validAfter", order: 4)]
        [JsonProperty("validAfter")]
        public virtual BigInteger ValidAfter { get; set; }

        [Parameter("uint256", "validBefore", order: 5)]
        [JsonProperty("validBefore")]
        public virtual BigInteger ValidBefore { get; set; }

        [Parameter("bytes32", "nonce", order: 6)]
        [JsonProperty("nonce")]
        public virtual byte[]? Nonce { get; set; }
    }
}
