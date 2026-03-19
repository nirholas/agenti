import express from "express";
import { paymentMiddleware } from "x402-express";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const payTo = process.env.PAY_TO || "0x0000000000000000000000000000000000000000";

app.use(paymentMiddleware(payTo, {
  "GET /ping": { price: "$0.001", network: "base-sepolia" }
}));

app.get("/ping", (_req, res) => {
  res.json({ message: "pong" });
});

app.listen(port, () => {
  console.log(`basic-402 server listening on http://localhost:${port}`);
});
