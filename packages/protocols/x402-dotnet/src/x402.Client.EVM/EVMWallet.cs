using Nethereum.ABI.EIP712;
using Nethereum.Hex.HexConvertors.Extensions;
using Nethereum.Signer;
using Nethereum.Signer.EIP712;
using Nethereum.Web3.Accounts;
using System.Security.Cryptography;

namespace x402.Client.EVM
{
    /// <summary>
    /// EVM-compatible wallet implementation for x402 payments using EIP-712 and EIP-3009 standards.
    /// </summary>
    public partial class EVMWallet : BaseWallet
    {
        /// <summary>
        /// The blockchain chain ID for this wallet.
        /// </summary>
        public ulong ChainId { get; }

        /// <summary>
        /// The wallet's public address.
        /// </summary>
        public string OwnerAddress { get; }

        /// <summary>
        /// Time offset from now when authorization becomes valid. Default: -1 minute.
        /// </summary>
        public TimeSpan AddValidAfterFromNow { get; set; } = TimeSpan.FromMinutes(-1);

        /// <summary>
        /// Time offset from now when authorization expires. Default: 15 minutes.
        /// </summary>
        public TimeSpan AddValidBeforeFromNow { get; set; } = TimeSpan.FromMinutes(15);

        /// <summary>
        /// The Nethereum account instance, if using internal signing.
        /// </summary>
        public Account? Account { get; }

        private readonly byte[]? privateKey;
        private readonly Func<string, Task<string>>? signFunction;

        /// <summary>
        /// Creates an EVM wallet from a hex-encoded private key.
        /// </summary>
        /// <param name="hexPrivateKey">The private key as hex string (with or without 0x prefix).</param>
        /// <param name="network">The network identifier (e.g., "eip155:84532").</param>
        /// <param name="chainId">The blockchain chain ID.</param>
        public EVMWallet(string hexPrivateKey, string network, ulong chainId) : base(network)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(hexPrivateKey);
            ArgumentException.ThrowIfNullOrWhiteSpace(network);

            if (hexPrivateKey.StartsWith("0x", StringComparison.OrdinalIgnoreCase))
                hexPrivateKey = hexPrivateKey[2..];

            // Convert hex string to byte[]
            privateKey = hexPrivateKey.HexToByteArray();

            Account = new Nethereum.Web3.Accounts.Account(privateKey);
            ChainId = chainId;
            OwnerAddress = Account.Address;
        }

        /// <summary>
        /// Creates an EVM wallet from a private key byte array.
        /// </summary>
        /// <param name="privateKey">The private key as byte array.</param>
        /// <param name="network">The network identifier (e.g., "eip155:84532").</param>
        /// <param name="chainId">The blockchain chain ID.</param>
        public EVMWallet(byte[] privateKey, string network, ulong chainId) : base(network)
        {
            ArgumentNullException.ThrowIfNull(privateKey);
            ArgumentException.ThrowIfNullOrWhiteSpace(network);

            this.privateKey = privateKey;

            Account = new Nethereum.Web3.Accounts.Account(privateKey);
            ChainId = chainId;
            OwnerAddress = Account.Address;
        }

        /// <summary>
        /// Creates an EVM wallet with an external signing function.
        /// </summary>
        /// <param name="signFunction">Custom signing function that takes EIP-712 JSON and returns a signature.</param>
        /// <param name="ownerAddress">The wallet's public address.</param>
        /// <param name="network">The network identifier (e.g., "eip155:84532").</param>
        /// <param name="chainId">The blockchain chain ID.</param>
        public EVMWallet(Func<string, Task<string>> signFunction, string ownerAddress, string network, ulong chainId) : base(network)
        {
            ArgumentNullException.ThrowIfNull(signFunction);
            ArgumentException.ThrowIfNullOrWhiteSpace(ownerAddress);
            ArgumentException.ThrowIfNullOrWhiteSpace(network);

            this.signFunction = signFunction;
            ChainId = chainId;
            OwnerAddress = ownerAddress;
        }

        /// <summary>
        /// Signs typed data using EIP-712 v4 standard.
        /// </summary>
        /// <param name="data">The EIP-712 typed data JSON string.</param>
        /// <returns>The signature as a hex string.</returns>
        /// <exception cref="ArgumentNullException">Thrown when data is null.</exception>
        /// <exception cref="InvalidOperationException">Thrown when no signing method is available.</exception>
        private Task<string> SignAsync(string data)
        {
            ArgumentNullException.ThrowIfNull(data);

            if (signFunction != null)
                return signFunction(data);

            if (privateKey == null)
                throw new InvalidOperationException("No private key or sign function available for signing.");

            // Use internal signing - Sign the typed data (EIP-712 v4)
            var ecKey = new EthECKey(privateKey, isPrivate: true);
            var eip712Signer = new Eip712TypedDataSigner();
            string signature = eip712Signer.SignTypedDataV4(data, ecKey);

            return Task.FromResult(signature);
        }

        /// <summary>
        /// Generates a cryptographically secure 32-byte random nonce.
        /// </summary>
        /// <returns>A 32-byte array containing random data.</returns>
        private static byte[] GenerateBytes32Nonce()
        {
            var bytes = new byte[32];
            RandomNumberGenerator.Fill(bytes);
            return bytes;
        }

        /// <summary>
        /// Builds EIP-712 typed data structure for EIP-3009 TransferWithAuthorization.
        /// </summary>
        /// <param name="tokenName">The token name from the smart contract.</param>
        /// <param name="tokenVersion">The token version from the smart contract.</param>
        /// <param name="chainId">The blockchain chain ID.</param>
        /// <param name="verifyingContract">The token contract address.</param>
        /// <returns>A TypedData structure ready for signing.</returns>
        private static TypedData<Domain> BuildEip3009TypedData(string tokenName, string tokenVersion, ulong chainId, string verifyingContract)
        {
            return new TypedData<Domain>
            {
                Domain = new Domain
                {
                    Name = tokenName,
                    Version = tokenVersion,
                    ChainId = chainId,
                    VerifyingContract = verifyingContract
                },
                Types = MemberDescriptionFactory.GetTypesMemberDescription(typeof(Domain), typeof(TransferWithAuthorization)),
                PrimaryType = nameof(TransferWithAuthorization),
            };
        }
    }
}
