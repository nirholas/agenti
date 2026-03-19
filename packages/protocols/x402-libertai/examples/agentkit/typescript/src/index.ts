import { startAgent } from "./agent.js";

startAgent().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
