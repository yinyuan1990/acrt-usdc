import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { app } from "./api.js";
import { migrate } from "./db.js";
import { startIndexer, refreshOnchain } from "./indexer.js";
import { startKeeper } from "./keeper.js";
import { bus } from "./bus.js";
import { config } from "./config.js";

await migrate();

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[api] listening on :${info.port}`);
});

// WebSocket fan-out of indexer events at /ws
const wss = new WebSocketServer({ server: server as never, path: "/ws" });
wss.on("connection", (ws) => ws.send(JSON.stringify({ type: "hello", data: { chainId: config.startBlock.toString() } })));
bus.on("ws", (msg) => {
  const s = JSON.stringify(msg, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(s);
});

void startIndexer();
setInterval(() => refreshOnchain().catch((e) => console.error("[refresh]", e.message)), config.refreshMs);
if (config.keeper.enabled) void startKeeper();
