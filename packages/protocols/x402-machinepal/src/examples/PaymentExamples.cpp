#include "PaymentExamples.h"
#include "MachinePalCommon.h"


const string PaymentExamples::EXACT_UCDC_PAYMENT_REQ_CB_SEPOLIA = R"({
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "12000000000000000000",
    "resource": "https://jsonplaceholder.typicode.com/posts/1",
    "description": "",
    "mimeType": "application/json",
    "outputSchema": null,
    "payTo": "0x2222222222222222222222222222222222222222",
    "maxTimeoutSeconds": 600,
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "extra": {
        "name": "USDC",
        "version": "2"
    }
})";


const string PaymentExamples::EXACT_UCDC_PAYMENT_REQ_EASYNET = R"({
    "scheme": "exact",
    "network": "machinepal-easynet",
    "maxAmountRequired": "12000000000000000000",
    "resource": "https://jsonplaceholder.typicode.com/posts/1",
    "description": "",
    "mimeType": "application/json",
    "outputSchema": null,
    "payTo": "0x209693bc6afc0c5328ba36faf03c514ef312287c",
    "maxTimeoutSeconds": 600,
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "extra": {
        "name": "USDC",
        "version": "2"
    }
})";



const string PaymentExamples::EXACT_UCDC_PAYMENT_PAYLOAD_CB_SEPOLIA_FROM_SPEC = R"({
    "x402Version": 1,
    "scheme": "exact",
    "network": "base-sepolia",
    "payload": {
        "signature": "0x2d6a7588d6acca505cbf0d9a4a227e0c52c6c34008c8e8986a1283259764173608a2ce6496642e377d6da8dbbf5836e9bd15092f9ecab05ded3d6293af148b571c",
        "authorization": {
            "from": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
            "to": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
            "value": "10000",
            "validAfter": "1740672089",
            "validBefore": "1740672154",
            "nonce": "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480"
        }
    }
})";

const string PaymentExamples::EXACT_UCDC_PAYMENT_PAYLOAD_CB_SEPOLIA = R"({
    "x402Version": 1,
    "scheme": "exact",
    "network": "base-sepolia",
    "payload": {
        "signature": "0x2d6a7588d6acca505cbf0d9a4a227e0c52c6c34008c8e8986a1283259764173608a2ce6496642e377d6da8dbbf5836e9bd15092f9ecab05ded3d6293af148b571c",
        "authorization": {
            "from": "0x9410ce824d7d65bf5ce9b656040ad597bdc9bf30",
            "to": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
            "value": "12000000000000000000",
            "validAfter": "1740672089",
            "validBefore": "1740672154",
            "nonce": "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480"
        }
    }
})";

const string PaymentExamples::EXACT_UCDC_SETTLEMENT_RESPONSE_CB_SEPOLIA = R"({
    "success": true,
    "transaction": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "network": "base-sepolia",
    "payer": "0x857b06519E91e3A54538791bDbb0E22373e36b66"
})";


/*
 *
*```json
{
"success": true,
"transaction": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
"network": "base-sepolia",
"payer": "0x857b06519E91e3A54538791bDbb0E22373e36b66"
}
```


| Field Name    | Type      | Required | Description | | ------------- | --------- | -------- |
--------------------------------------------------------------- | | `success`     | `boolean` |
Required | Indicates whether the payment settlement was successful         | | `errorReason` |
`string`  | Optional | Error reason if settlement failed (omitted if successful)       | |
`transaction` | `string`  | Required | Blockchain transaction hash (empty string if settlement
failed) | | `network`     | `string`  | Required | Blockchain network identifier | | `payer`       |
`string`  | Required | Address of the payer's wallet                                   |

*/