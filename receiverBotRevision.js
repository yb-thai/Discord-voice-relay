require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events} = require("discord.js");
const { joinVoiceChannel, EndBehaviorType } = require("@discordjs/voice");
const prism = require("prism-media");

const ws = new WebSocket("ws://localhost:8080"); // Connect to the server

const TOKEN = "MTM2MTg1OTMwOTk2ODk1MzQ5MA.GxaG2G.afb5VFOjbviGpO3AgmhfF8lsHU6Tv9GsmweEoQ";

const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
    ],
  });

client.once("ready", () => {
    console.log("🎙️ Receiver bot ready. Use /insideman to start.");
  });
  
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "insideman") {
      const voiceChannel = interaction.member.voice.channel;
  
      if (!voiceChannel) {
        await interaction.reply("❌ You must be in a voice channel to use this command.");
        return;
      }
     const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true,
      });
  
      await interaction.reply(`🛰️ Joined ${voiceChannel.name} — capturing audio.`);
  

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
} // sus
});

client.login(TOKEN);
