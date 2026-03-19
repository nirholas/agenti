import "dotenv/config";
import { logger, logResponse } from "../logger";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import fs from "fs";
const { Permission, Permissions } = multisig.types;

import { wrap as wrapFetch } from "@faremeter/fetch";
import { createSquadsWallet } from "@faremeter/wallet-solana-squads";
import { createPaymentHandler } from "@faremeter/x-solana-settlement";
import { client } from "@faremeter/types";
import { normalizeNetworkId } from "@faremeter/info";

const { PAYER_KEYPAIR_PATH } = process.env;

if (!PAYER_KEYPAIR_PATH) {
  throw new Error("PAYER_KEYPAIR_PATH must be set in your environment");
}

const transferSol = async (
  connection: Connection,
  receiver: PublicKey,
  sender: Keypair,
  amount: number,
) => {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: receiver,
      lamports: amount * 1000000000,
    }),
  );

  await sendAndConfirmTransaction(connection, transaction, [sender]);
};

const network = "devnet";
const connection = new Connection(clusterApiUrl(network), "confirmed");
const keypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(PAYER_KEYPAIR_PATH, "utf-8"))),
);

async function createSquad() {
  const createKey = Keypair.generate();
  const squadMember = Keypair.generate();

  await transferSol(connection, squadMember.publicKey, keypair, 0.002);
  await transferSol(connection, createKey.publicKey, keypair, 0.002);

  const [multisigPda] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
  });

  const programConfigPda = multisig.getProgramConfigPda({})[0];
  const programConfig =
    await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      programConfigPda,
    );

  const createSquadInstruction = multisig.instructions.multisigCreateV2({
    createKey: createKey.publicKey,
    creator: keypair.publicKey,
    multisigPda,
    configAuthority: null,
    timeLock: 0,
    members: [
      {
        key: keypair.publicKey,
        permissions: Permissions.all(),
      },
      {
        key: squadMember.publicKey,
        permissions: Permissions.fromPermissions([Permission.Vote]),
      },
    ],
    threshold: 2,
    treasury: programConfig.treasury,
    rentCollector: null,
  });

  const transaction = new Transaction().add(createSquadInstruction);
  const squadCreateSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [keypair, createKey],
  );

  logger.info(`Created squad with signature: ${squadCreateSignature}`);

  return {
    multisigPda,
    squadMember,
  };
}

const { multisigPda, squadMember } = await createSquad();
const wallet = await createSquadsWallet(
  network,
  connection,
  keypair,
  multisigPda,
  squadMember,
);

const fetchWithPayer = wrapFetch(fetch, {
  handlers: [
    client.adaptPaymentHandlerV1ToV2(
      createPaymentHandler(wallet),
      normalizeNetworkId,
    ),
  ],
});

const req = await fetchWithPayer("http://127.0.0.1:3000/protected");
await logResponse(req);
