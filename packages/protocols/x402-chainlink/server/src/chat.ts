/**
 * Interactive Chat Interface
 * 
 * This module provides an interactive terminal interface for chatting with
 * the price alert system. Users can type messages directly instead of using curl.
 * 
 * The chat interface makes HTTP requests to the server's /chat endpoint
 * and displays responses in a user-friendly format.
 */

import { createInterface } from "readline";

/**
 * Starts an interactive chat interface in the terminal
 * 
 * This allows users to chat directly with the server without using curl.
 * The interface connects to the server's /chat endpoint and displays
 * responses including alert details and CRE workflow payloads.
 * 
 * @param port - The port number the server is running on (default: 3000)
 */
export function startChatInterface(port: number = 3000): void {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> "
  });

  const SERVER_URL = `http://localhost:${port}`;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Interactive Chat Enabled");
  console.log("Type your message and press Enter (type 'exit' or 'quit' to leave)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  rl.prompt();

  rl.on("line", async (input) => {
    const message = input.trim();

    // Handle exit commands
    if (message === "exit" || message === "quit" || message === "q") {
      console.log("\nChat disabled. Server continues running.\n");
      rl.close();
      return;
    }

    // Skip empty messages
    if (!message) {
      rl.prompt();
      return;
    }

    // Send message to /chat endpoint
    try {
      const response = await fetch(`${SERVER_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        console.log(`\n[ERROR] ${error.error || response.statusText}\n`);
        rl.prompt();
        return;
      }

      const data = await response.json();

      // Display reply
      if (data.reply) {
        console.log(`\n${data.reply}\n`);
      }

      // Display alert details if created
      if (data.alert) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Alert Created:");
        console.log(`  ID: ${data.alert.id}`);
        console.log(`  Asset: ${data.alert.asset}`);
        console.log(`  Condition: ${data.alert.condition}`);
        console.log(`  Target Price: $${data.alert.targetPriceUsd.toLocaleString()}`);
        if (data.transactionHash) {
          console.log(`  Transaction: ${data.transactionHash}`);
        }
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        // Output CRE workflow payload
        const workflowPayload = {
          id: data.alert.id,
          asset: data.alert.asset,
          condition: data.alert.condition,
          targetPriceUsd: data.alert.targetPriceUsd,
          createdAt: data.alert.createdAt
        };
        console.log("\nCRE Workflow Payload (copy for HTTP trigger):\n");
        console.log(JSON.stringify(workflowPayload));
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      }
    } catch (error: any) {
      console.log(`\n[ERROR] ${error.message}\n`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nChat disabled. Server continues running.\n");
  });
}

