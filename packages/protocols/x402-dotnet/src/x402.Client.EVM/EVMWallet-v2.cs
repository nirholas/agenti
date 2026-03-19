using Nethereum.ABI.EIP712;
using Nethereum.Hex.HexConvertors.Extensions;
using System.Numerics;
using x402.Core.Models.v2;

namespace x402.Client.EVM
{
    public partial class EVMWallet
    {
        public override async Task<PaymentPayloadHeader> CreateHeaderAsync(PaymentRequirements requirement, CancellationToken cancellationToken = default)
        {
            TypedData<Domain> typedData = GetTypedData(requirement, ChainId);

            string to = requirement.PayTo;
            string from = OwnerAddress;

            // value should be token units in smallest denomination (uint256)
            var amount = BigInteger.Parse(requirement.Amount);
            var value = new Nethereum.Hex.HexTypes.HexBigInteger(amount);

            // Validity window: use unix timestamps
            ulong validAfter = (ulong)DateTimeOffset.UtcNow.Add(AddValidAfterFromNow).ToUnixTimeSeconds(); // valid immediately
            ulong validBefore = (ulong)DateTimeOffset.UtcNow.Add(AddValidBeforeFromNow).ToUnixTimeSeconds(); // valid for 15 minutes

            // Create a proper bytes32 nonce: 32 random bytes -> 0x-prefixed hex
            var nonceByte = GenerateBytes32Nonce();


            // Message object with the authorization values
            var message = new TransferWithAuthorization
            {
                From = from,
                To = to,
                Value = value.Value,
                ValidAfter = validAfter,
                ValidBefore = validBefore,
                Nonce = nonceByte
            };

            typedData.SetMessage(message);
            string signature = await SignAsync(typedData.ToJson());

            // Recover signer to verify
            // var recoveredAddress = eip712Signer.RecoverFromSignatureV4(message, typedData, signature);
            //Console.WriteLine($"Recovered signer address: {recoveredAddress}");
            //Console.WriteLine($"Signer matches 'from' ? {string.Equals(recoveredAddress, from, StringComparison.OrdinalIgnoreCase)}\n");

            var header = new PaymentPayloadHeader()
            {
                X402Version = 2,
                Accepted = requirement,
                Payload = new Payload
                {
                    Signature = signature,
                    Authorization = new Authorization
                    {
                        From = from,
                        To = to,
                        Value = value.Value.ToString(), // value as numeric string to avoid precision issues
                        ValidAfter = validAfter.ToString(),
                        ValidBefore = validBefore.ToString(),
                        Nonce = nonceByte.ToHex(prefix: true), //nonce is bytes32: pass as hex string (0x...)
                    }
                }
            };

            return header;
        }

        private static TypedData<Domain> GetTypedData(PaymentRequirements requirement, ulong chainId)
        {
            // Prepare EIP-3009 TransferWithAuthorization fields
            string tokenName = requirement.Extra?.Name ?? string.Empty;
            string tokenVersion = requirement.Extra?.Version ?? string.Empty;
            string tokenContractAddress = requirement.Asset;

            // Build EIP-712 typed data for EIP-3009
            var typedData = BuildEip3009TypedData(tokenName, tokenVersion, chainId, tokenContractAddress);
            return typedData;
        }
    }
}
