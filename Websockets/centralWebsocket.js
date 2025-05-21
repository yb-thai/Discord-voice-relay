const WebSocket = require("ws");
const url = require("url");

const wss = new WebSocket.Server({
  port: 8080,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024,
  },
});

const clients = new Map(); // ws => { from, towers: Set() }
const towerPairs = new Map(); // towerName => recorderName
const messageQueue = new Map(); // clientId => [messages]

// Update this with your bot pairs
const KNOWN_PAIRS = {
  "robin-tower": "robin",
  "beastboy-tower": "beastboy",
  "starfire-tower": "starfire",
  "raven-tower": "raven",
  "terra-tower": "terra",
  "cyborg-tower": "cyborg",
  "bumblebee-tower": "bumblebee",
  "batman-tower": "batman",
  "jinx-tower": "jinx",
  "wally-tower": "wally",
  "speedy-tower": "speedy",
};

// Process message queue every 15ms to prevent flooding
const processInterval = 15;
setInterval(() => {
  for (const [clientId, queue] of messageQueue.entries()) {
    if (queue.length === 0) continue;

    const client = Array.from(clients.keys()).find(
      (c) => clients.get(c).from === clientId && c.readyState === WebSocket.OPEN
    );

    if (client) {
      // Send up to 3 messages per interval
      const messagesToSend = queue.splice(0, 3);
      messagesToSend.forEach((msg) => {
        try {
          client.send(msg);
        } catch (e) {
          console.error(`[Server] Error sending to ${clientId}:`, e.message);
        }
      });
    } else {
      // Client disconnected, clear queue
      messageQueue.delete(clientId);
    }
  }
}, processInterval);

wss.on("connection", (ws, req) => {
  const query = url.parse(req.url, true).query;
  const from = query.from || "unknown";

  // Initialize client data
  clients.set(ws, { from, towers: new Set() });

  // If this is a tower, store its pair
  for (const [tower, recorder] of Object.entries(KNOWN_PAIRS)) {
    if (from === tower) {
      towerPairs.set(tower, recorder);
      break;
    }
  }

  console.log(`[Server] ${from} connected`);

  ws.on("message", (msg) => {
    let parsed;
    try {
      parsed = JSON.parse(msg.toString());
    } catch (err) {
      console.error("[Server] Failed to parse message", err);
      return;
    }

    // Broadcast control messages (e.g. join/leave signals)
    if (parsed.type) {
      console.log(`[Server] Control message from ${from}: ${parsed.type}`);

      // Only broadcast control messages to relevant clients
      for (const [client, clientData] of clients.entries()) {
        if (client.readyState === WebSocket.OPEN) {
          // Check if this is a tower specific message
          if (parsed.type.includes("-tower")) {
            const targetTower = parsed.type.split("-")[0] + "-tower";
            if (clientData.from === targetTower) {
              client.send(msg);
              break; // Send only to the specific tower
            }
          } else {
            client.send(msg); // For other control messages, send to all
          }
        }
      }
      return;
    }

    // Process audio messages (must include from and audio)
    if (!parsed.from || !parsed.audio) return;

    // Find towers that should receive this audio
    for (const [client, clientData] of clients.entries()) {
      // Skip if this is the sender
      if (client === ws) continue;

      // Skip if client is closed
      if (client.readyState !== WebSocket.OPEN) continue;

      // If this is a tower client
      const isTower = towerPairs.has(clientData.from);

      if (isTower) {
        const pairedWith = towerPairs.get(clientData.from);

        // Only send to towers if it's not from their paired recorder
        if (parsed.from !== pairedWith) {
          // Queue message for this client
          if (!messageQueue.has(clientData.from)) {
            messageQueue.set(clientData.from, []);
          }
          messageQueue.get(clientData.from).push(msg);
        }
      } else {
        // For non-tower clients (like other components), send all audio
        client.send(msg);
      }
    }
  });

  ws.on("close", () => {
    const clientData = clients.get(ws);
    console.log(`[Server] ${clientData.from} disconnected`);
    clients.delete(ws);

    // Clear any pending messages
    if (messageQueue.has(clientData.from)) {
      messageQueue.delete(clientData.from);
    }
  });

  ws.on("error", (err) => {
    const clientData = clients.get(ws) || { from: "unknown" };
    console.error(`[Server] Error on ${clientData.from}:`, err);
    clients.delete(ws);

    // Clear any pending messages
    if (messageQueue.has(clientData.from)) {
      messageQueue.delete(clientData.from);
    }
  });
});

console.log(
  "[Server] Optimized WebSocket relay running on ws://localhost:8080"
);
