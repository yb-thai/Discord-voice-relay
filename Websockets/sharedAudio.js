const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
let clients = [];

wss.on("connection", (ws) => {
  console.log("[Server] Client connected");
  clients.push(ws);

  ws.on("message", (msg) => {
    // Broadcast to all other clients
    clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  });

  ws.on("close", () => {
    clients = clients.filter((c) => c !== ws);
    console.log("[Server] Client disconnected");
  });
});

console.log("[Server] Audio relay WebSocket running on ws://localhost:8080");
