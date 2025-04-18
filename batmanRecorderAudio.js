require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events } = require("discord.js");
const { joinVoiceChannel, EndBehaviorType, getVoiceConnection } = require("@discordjs/voice");
const prism = require("prism-media");
const TOKEN = (process.env.BATMAN_TOKEN);


const ws = new WebSocket("ws://localhost:8080"); // Connect to the server
// connect to the relay server 
ws.on("open", () => {
  console.log("[Batman] WebSocket connection established");
});
ws.on("close", () => {
  console.log("[Batman] WebSocket connection closed");
});
ws.on("error", (err) => {
  console.error("[Batman] WebSocket error:", err);
});


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let batmanConnection = null;

client.once("ready", () => {
  console.log("🎙️ Batman (Recorder bot) ready. Use /batman to start capturing audio.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Start recording
  if (interaction.commandName === "batman") {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply("❌ You must be in a voice channel to use this command.");
      return;
    }

    if (batmanConnection) {
      await interaction.reply("ℹ️ Batman is already capturing audio.");
      return;
    }
    batmanConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    await interaction.reply(`🛰️ Joined ${voiceChannel.name} — now capturing audio.`);



    batmanConnection.receiver.speaking.on("start", (userId) => {
      console.log(`User ${userId} started speaking`);

      const opusStream = batmanConnection.receiver.subscribe(userId, {
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
      // Pipe the Opus stream through the decoder.
      opusStream.pipe(pcmStream);

      opusStream.on("error", console.error);
      pcmStream.on("error", console.error);

      pcmStream.on("data", (chunk) => {
        console.log(`[Batman] Decoded PCM chunk: ${chunk.length}`);
      });

      // Pipe to the relay streamopusStream.pipe(pcmStream);
      pcmStream.on("data", (chunk) => {
        // Check if WebSocket is still open before pushing data
        if (ws.readyState === WebSocket.OPEN) {
          console.log(`[Batman] Captured PCM chunk: ${chunk.length} bytes`); // Log chunk size
          ws.send(chunk); // Send PCM data to the WebSocket server
        } else {
          console.error("[Batman] WebSocket is not open. Not sending data.");
        }
      });
      opusStream.on("end", () => {
        console.log(`User ${userId} stopped speaking`);
      });

      // Prevent pushing after EOF

      pcmStream.on("end", () => {
        console.log("[Batman] PCM stream ended");
        isSending = false;
      });

      pcmStream.on("error", (err) => {
        console.error("[Batman] PCM stream error:", err);
        isSending = false;
      });

      batmanConnection.receiver.speaking.on("end", (userId) => {
        console.log(`[Batman] User ${userId} stopped speaking`);
        // no need to close the WebSocket
      });
    });

    // Handle WebSocket events
    ws.on("open", () => {
      console.log("[Batman] WebSocket connection established");
    });

    ws.on("close", () => {
      console.log("[Batman] WebSocket connection closed");
    });

    ws.on("error", (err) => {
      console.error("[Batman] WebSocket error:", err);
    });
  } // sus

  // Stop recording
  if (interaction.commandName === "stop-batman") {
    batmanConnection = getVoiceConnection(interaction.guild.id);
    if (batmanConnection) {
      batmanConnection.destroy();
      await interaction.reply("🛑 Batman has left the voice channel.");
    } else {
      await interaction.reply("⚠️ Batman is not currently in a voice channel.");
    }
  }
});

client.login(TOKEN);
