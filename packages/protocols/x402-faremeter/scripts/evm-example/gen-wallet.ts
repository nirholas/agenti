import { logger } from "../logger";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

logger.info(`Private Key: ${privateKey}`);
logger.info(`Address: ${account.address}`);
