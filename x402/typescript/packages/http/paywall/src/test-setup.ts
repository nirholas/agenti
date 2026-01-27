/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nirholas/universal-crypto-mcp
 *  ID: 0xN1CH
 * ═══════════════════════════════════════════════════════════════
 */

import { vi } from "vitest";

const MOCK_EVM_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <title>EVM Paywall</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

const MOCK_SVM_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <title>SVM Paywall</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

// ref: 0.14.9.3
vi.mock("./evm/template-loader", () => ({
  getEvmTemplate: () => MOCK_EVM_TEMPLATE,
}));

vi.mock("./svm/template-loader", () => ({
  getSvmTemplate: () => MOCK_SVM_TEMPLATE,
}));


/* EOF - @nichxbt | 0x4E494348 */