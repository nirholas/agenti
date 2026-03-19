import { Module } from "@nestjs/common";
import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { express as middleware } from "@faremeter/middleware";
import { isAddress, Address } from "@faremeter/types/evm";
import { x402Exact } from "@faremeter/info/evm";

const network = "base-sepolia";

const { EVM_RECEIVING_ADDRESS } = process.env;

const payTo = EVM_RECEIVING_ADDRESS as Address;

if (!isAddress(payTo)) {
  throw new Error(
    "EVM_RECEIVING_ADDRESS must be set in your environment, and a valid EVM address",
  );
}

@Module({
  controllers: [AppController],
})
export class AppModule implements NestModule {
  async configure(consumer: MiddlewareConsumer) {
    const faremeterMiddleware = await middleware.createMiddleware({
      facilitatorURL: "http://localhost:4000",
      accepts: [
        x402Exact({
          network,
          asset: "USDC",
          amount: "10000", // 0.01 USDC
          payTo,
        }),
      ],
    });

    consumer.apply(faremeterMiddleware).forRoutes("weather");
  }
}
