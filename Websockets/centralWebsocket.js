const WebSocket = require("ws");
const url = require("url");

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map(); // ws => { from }

wss.on("connection", (ws, req) => {
  const query = url.parse(req.url, true).query;
  const from = query.from || "unknown";

  clients.set(ws, { from });
  console.log(`[Server] ${from} connected`);

  ws.on("message", (msg) => {
    let parsed;
    try {
      parsed = JSON.parse(msg.toString());
    } catch (err) {
      console.error("[Server] Failed to parse message", err);
      return;
    }

    //  Broadcast control messages (e.g. join/leave signals)
    if (parsed.type) {
      console.log(`[Server] Control message from ${from}: ${parsed.type}`);
      for (const [client] of clients.entries()) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg); // Send to all clients
        }
      }
      return;
    }

    //  Broadcast audio messages (must include from and audio)
    if (!parsed.from || !parsed.audio) return;

    for (const [client] of clients.entries()) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  });

  ws.on("close", () => {
    console.log(`[Server] ${from} disconnected`);
    clients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error(`[Server] Error on ${from}:`, err);
    clients.delete(ws);
  });
});

console.log("[Server] WebSocket relay running on ws://localhost:8080");
