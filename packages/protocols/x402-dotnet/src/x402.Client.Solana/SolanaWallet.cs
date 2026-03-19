using Solnet.Wallet;
using Solnet.Wallet.Bip39;
using System.Security.Cryptography;

namespace x402.Client.Solana
{
    public partial class SolanaWallet : BaseWallet
    {
        public string OwnerAddress { get; }

        public TimeSpan AddValidAfterFromNow { get; set; } = TimeSpan.FromMinutes(-1);
        public TimeSpan AddValidBeforeFromNow { get; set; } = TimeSpan.FromMinutes(15);

        public Account? Account { get; }

        private readonly Func<byte[], Task<byte[]>>? signFunction;

        public SolanaWallet(byte[] privateKey, string network) : base(network)
        {
            // Solnet.Wallet.Account constructor takes byte array (64 bytes for Ed25519)
            Account = new Wallet(privateKey).Account;
            OwnerAddress = Account.PublicKey.Key;
        }

        public SolanaWallet(string base58PrivateKey, string network) : base(network)
        {
            // Decode base58 private key to bytes
            var privateKeyBytes = DecodeBase58(base58PrivateKey);
            Account = new Wallet(privateKeyBytes).Account;
            OwnerAddress = Account.PublicKey.Key;
        }

        public SolanaWallet(Func<byte[], Task<byte[]>> signFunction, string ownerAddress, string network) : base(network)
        {
            this.signFunction = signFunction;
            OwnerAddress = ownerAddress;
        }

        public static SolanaWallet FromMnemonic(string mnemonic, string passphrase, int accountIndex, string network)
        {
            // Create wallet from mnemonic
            var wallet = new Wallet(mnemonic, WordList.English, passphrase);
            var account = wallet.GetAccount(accountIndex);
            return new SolanaWallet(account.PrivateKey.KeyBytes, network);
        }

        private Task<byte[]> SignAsync(byte[] data)
        {
            if (data == null) throw new ArgumentNullException(nameof(data));

            if (signFunction != null)
                return signFunction(data);

            // Use internal signing
            if (Account == null)
                throw new InvalidOperationException("No account available for signing");

            var signature = Account.Sign(data);
            return Task.FromResult(signature);
        }

        private static byte[] GenerateNonce()
        {
            // Generate 32 random bytes for nonce
            var bytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            return bytes;
        }

        private static byte[] DecodeBase58(string base58String)
        {
            const string base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
            var bigInt = System.Numerics.BigInteger.Zero;

            for (int i = 0; i < base58String.Length; i++)
            {
                int digit = base58Alphabet.IndexOf(base58String[i]);
                if (digit < 0)
                    throw new FormatException($"Invalid Base58 character: {base58String[i]}");

                bigInt = bigInt * 58 + digit;
            }

            var bytes = bigInt.ToByteArray();

            // Count leading zeros in the input
            int leadingZeros = 0;
            while (leadingZeros < base58String.Length && base58String[leadingZeros] == '1')
                leadingZeros++;

            // BigInteger.ToByteArray() returns little-endian, we need big-endian
            Array.Reverse(bytes);

            // Trim the extra 0 byte that BigInteger adds for positive numbers
            if (bytes.Length > 1 && bytes[0] == 0)
                bytes = bytes.Skip(1).ToArray();

            // Add leading zeros
            var result = new byte[leadingZeros + bytes.Length];
            bytes.CopyTo(result, leadingZeros);

            return result;
        }
    }
}
