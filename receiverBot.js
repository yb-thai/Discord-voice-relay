const WebSocket = require("ws");
const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, EndBehaviorType } = require("@discordjs/voice");
const prism = require("prism-media");

const ws = new WebSocket("ws://localhost:8080"); // Connect to the server

const TOKEN = "TOKEN";
const GUILD_ID = "SERVER";
const CHANNEL_A_ID = "LISTENING_CHANNEL";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once("ready", async () => {
  console.log(`Bot A is ready`);

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(CHANNEL_A_ID);

  const connection = joinVoiceChannel({
    channelId: CHANNEL_A_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true,
  });

  connection.receiver.speaking.on("start", (userId) => {
    console.log(`User ${userId} started speaking`);

    const opusStream = connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 100,
      },
    });

    const pcmStream = new prism.opus.Decoder({
      rate: 48000,
      channels: 2,
      frameSize: 960,
    });

    opusStream.pipe(pcmStream);

    opusStream.on("error", console.error);
    pcmStream.on("error", console.error);

    pcmStream.on("data", (chunk) => {
      console.log(`[Bot A] Decoded PCM chunk: ${chunk.length}`);
    });

    // Pipe to the relay streamopusStream.pipe(pcmStream);
    pcmStream.on("data", (chunk) => {
      // Check if WebSocket is still open before pushing data
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`[Bot A] Captured PCM chunk: ${chunk.length} bytes`); // Log chunk size
        ws.send(chunk); // Send PCM data to the WebSocket server
      } else {
        console.error("[Bot A] WebSocket is not open. Not sending data.");
      }
    });
    opusStream.on("end", () => {
      console.log(`User ${userId} stopped speaking`);
    });

    // Prevent pushing after EOF

    pcmStream.on("end", () => {
      console.log("[Bot A] PCM stream ended");
      isSending = false;
    });

    pcmStream.on("error", (err) => {
      console.error("[Bot A] PCM stream error:", err);
      isSending = false;
    });

    connection.receiver.speaking.on("end", (userId) => {
      console.log(`[Bot A] User ${userId} stopped speaking`);
      // no need to close the WebSocket
    });
  });

  // Handle WebSocket events
  ws.on("open", () => {
    console.log("[Bot A] WebSocket connection established");
  });

  ws.on("close", () => {
    console.log("[Bot A] WebSocket connection closed");
  });

  ws.on("error", (err) => {
    console.error("[Bot A] WebSocket error:", err);
  });
});

client.login(TOKEN);
