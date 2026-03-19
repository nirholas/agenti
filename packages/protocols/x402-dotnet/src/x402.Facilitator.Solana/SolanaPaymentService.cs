using Solnet.Rpc;
using Solnet.Rpc.Models;
using Solnet.Rpc.Types;
using Solnet.Wallet;
using x402.Core.Enums;
using x402.Core.Models.Facilitator;
using x402.Core.Models.v2;

namespace x402.Facilitator.Solana;

public class SolanaPaymentService : IPaymentService
{
    // Solnet RPC client
    private readonly IRpcClient _rpcClient;

    // Facilitator's Keypair (from Solnet.Wallet)
    private readonly Wallet _facilitatorSigner;

    public SolanaPaymentService(IRpcClient rpcClient, Wallet facilitatorSigner)
    {
        _rpcClient = rpcClient;
        _facilitatorSigner = facilitatorSigner;
    }

    private void VerifySchemesAndNetworks(PaymentPayloadHeader payload, PaymentRequirements requirements)
    {
        if (payload.Accepted.Scheme != PaymentScheme.Exact || requirements.Scheme != PaymentScheme.Exact)
            throw new ArgumentException(FacilitatorErrorCodes.UnsupportedScheme);

        if (payload.Accepted.Network != requirements.Network)
            throw new ArgumentException(FacilitatorErrorCodes.InvalidNetwork);

        if (requirements.Network is not ("solana" or "solana-devnet" or "solana-testnet" or "solana-mainnet-beta"))
            throw new ArgumentException(FacilitatorErrorCodes.InvalidNetwork);
    }

    public async Task<VerificationResponse> VerifyPayment(
        PaymentPayloadHeader payload,
        PaymentRequirements requirements)
    {
        var payer = payload.ExtractPayerFromPayload();

        try
        {
            VerifySchemesAndNetworks(payload, requirements);

            // For Solana, payload.Payload.Signature contains base64-encoded transaction
            var transactionBase64 = payload.Payload.Signature;

            // Simulate the transaction - pass base64 string directly
            var simulationResult = await _rpcClient.SimulateTransactionAsync(
                transactionBase64,
                commitment: Commitment.Confirmed,
                sigVerify: true // Must verify the client's signature
            );

            // Check for error in the simulation response
            // Solnet returns errors in the Error property  
            if (simulationResult.WasRequestSuccessfullyHandled == false ||
                simulationResult.Result?.Value?.Error != null)
            {
                throw new Exception(FacilitatorErrorCodes.SimulationFailed);
            }

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
            var invalidReason = e.Message.Contains(FacilitatorErrorCodes.SimulationFailed)
                ? FacilitatorErrorCodes.SimulationFailed
                : FacilitatorErrorCodes.UnexpectedError;

            return new VerificationResponse
            {
                IsValid = false,
                InvalidReason = invalidReason,
                Payer = payer
            };
        }
    }

    public async Task<SettlementResponse> SettlePayment(
        PaymentPayloadHeader payload,
        PaymentRequirements requirements)
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

        var transactionBytes = Convert.FromBase64String(payload.Payload.Signature);
        var transaction = Transaction.Deserialize(transactionBytes);

        // 1. Get the facilitator's signature (for the fee payer)
        var messageData = transaction.CompileMessage();
        var facilitatorSignature = _facilitatorSigner.Account.Sign(messageData);

        // 2. Get the client's existing signature (must be the second signature)
        var clientSignature = transaction.Signatures[0];

        // 3. Rebuild signatures: [Facilitator Signature, Client Signature]
        // The facilitator MUST be the first signature (index 0)
        transaction.Signatures = new List<SignaturePubKeyPair>
        {
            new SignaturePubKeyPair { Signature = facilitatorSignature, PublicKey = _facilitatorSigner.Account.PublicKey },
            clientSignature
        };

        var payer = verifyResponse.Payer;

        // 4. Submit and confirm - serialize transaction back to bytes
        var serializedTransaction = transaction.Serialize();
        var result = await _rpcClient.SendTransactionAsync(
            serializedTransaction,
            commitment: Commitment.Confirmed
        );

        if (result.WasSuccessful && !string.IsNullOrEmpty(result.Result))
        {
            return new SettlementResponse
            {
                Success = true,
                ErrorReason = null,
                Network = payload.Accepted.Network,
                Transaction = result.Result,
                Payer = payer
            };
        }
        else
        {
            var errorReason = result.Reason ?? "transaction_failed_on_submit";
            return new SettlementResponse
            {
                Success = false,
                ErrorReason = errorReason,
                Network = payload.Accepted.Network,
                Transaction = result.Result ?? "",
                Payer = payer
            };
        }
    }
}