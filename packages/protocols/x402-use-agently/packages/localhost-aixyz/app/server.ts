// Custom server entrypoint — overrides the framework's auto-generated server.
import { AixyzServer } from "aixyz/server";
import { useA2A } from "aixyz/server/adapters/a2a";
import { AixyzMCP } from "aixyz/server/adapters/mcp";
import { facilitator } from "./accepts";
import * as agent from "./agent";
import * as freeEcho from "./agents/free-echo";
import * as freeEcho10 from "./agents/free-echo-10";
import * as paidEcho from "./agents/paid-echo";
import * as echoTool from "./tools/echo";
import * as paidEchoTool from "./tools/paid-echo-tool";
import express from "express";

const server = new AixyzServer(facilitator);
await server.initialize();
server.unstable_withIndexPage();

// A2A agents
useA2A(server, agent);
useA2A(server, freeEcho, "free-echo");
useA2A(server, freeEcho10, "free-echo-10");
useA2A(server, paidEcho, "paid-echo");

// MCP tools
const mcp = new AixyzMCP(server);
await mcp.register("echo", echoTool);
await mcp.register("paid-echo-tool", paidEchoTool);
await mcp.connect();

// Plain HTTP test endpoints for `use-agently web` command tests
server.express.use("/http", express.json());

// Free endpoints
server.express.get("/http/free", (_req, res) => {
  res.json({ message: "free GET response" });
});

server.express.post("/http/free", (req, res) => {
  res.json({ message: "free POST response", body: req.body });
});

server.express.put("/http/free", (req, res) => {
  res.json({ message: "free PUT response", body: req.body });
});

server.express.delete("/http/free", (_req, res) => {
  res.json({ message: "free DELETE response" });
});

// Paid endpoints (x402 $0.003)
server.withX402Exact("GET /http/paid", { scheme: "exact", price: "$0.003" });
server.withX402Exact("POST /http/paid", { scheme: "exact", price: "$0.003" });

server.express.get("/http/paid", (_req, res) => {
  res.json({ message: "paid GET response" });
});

server.express.post("/http/paid", (req, res) => {
  res.json({ message: "paid POST response", body: req.body });
});

export default server;
