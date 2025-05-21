require("dotenv").config();
const fs = require("fs");
const prism = require("prism-media");
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const AudioMixer = require("audio-mixer");
const path = require("path");

const TOKEN = process.env.STARFIRE_TOKEN;
const ws = new WebSocket("ws://localhost:8080/?from=starfire");

ws.on("open", () => console.log("[starfire] WebSocket connected"));
ws.on("close", () => console.log("[starfire] WebSocket closed"));
ws.on("error", (err) => console.error("[starfire] WebSocket error:", err));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent],
});

let starfireConnection = null;
let isMuted = true;
let mixer = null;
const SILENCE_FRAME = Buffer.alloc(1920);

// Initialize mixer and input
const audioBufferQueue = [];
mixer = new AudioMixer.Mixer({
  channels: 2,
  bitDepth: 16,
  sampleRate: 48000,
  clearInterval: 20,
});
const input = new AudioMixer.Input({
  channels: 2,
  bitDepth: 16,
  sampleRate: 48000,
  volume: 100,
});
mixer.addInput(input);

// Feed mixer from queue
setInterval(() => {
  const buffer = audioBufferQueue.length > 0 ? audioBufferQueue.shift() : SILENCE_FRAME;
  input.write(buffer);
}, 20);

// Stream mixed output to WebSocket
mixer.on("data", (chunk) => {
  if (ws.readyState === WebSocket.OPEN && !isMuted && !chunk.equals(SILENCE_FRAME)) {
    ws.send(JSON.stringify({ from: "starfire", audio: chunk.toString("base64") }));
  }
});

client.once("ready", () => {
  console.log("🐲 STARFIRE ready. Use /starfire to stream an MP3 or your voice.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // 🔇🔊 Button control
  if (interaction.isButton()) {
    isMuted = interaction.customId === "mute";
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("mute").setLabel("🔇 Mute STARFIRE")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("unmute").setLabel("🔊 Unmute STARFIRE")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
    await interaction.update({
      content: `🐲 STARFIRE is ${isMuted ? "muted" : "unmuted"} — toggle below:`,
      components: [row],
    });
    return;
  }

  // ▶️ /starfire command
  if (interaction.commandName === "starfire") {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: "❌ Join a voice channel first.", ephemeral: true });
      return;
    }
    if (starfireConnection) {
      await interaction.reply({ content: "ℹ️ STARFIRE is already running.", ephemeral: true });
      return;
    }

    // Join VC
    starfireConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    // Notify Tower
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "join-starfire-tower",
        guildId: voiceChannel.guild.id,
        channelId: voiceChannel.id,
      }));
    }

    // Play test MP3
    const mp3Path = path.join(__dirname, "music.mp3");
    if (!fs.existsSync(mp3Path)) {
      await interaction.reply({ content: "❌ music.mp3 not found in bot folder.", ephemeral: true });
      return;
    }

    const mp3Stream = fs.createReadStream(mp3Path);
    const ffmpeg = new prism.FFmpeg({
      args: ["-analyzeduration", "0", "-loglevel", "0", "-i", "-", "-f", "s16le", "-ar", "48000", "-ac", "2"],
    });

    mp3Stream.pipe(ffmpeg).on("data", (chunk) => {
      audioBufferQueue.push(chunk);
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("mute").setLabel("🔇 Mute STARFIRE")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("unmute").setLabel("🔊 Unmute STARFIRE")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: "🐲 STARFIRE joined and is playing **music.mp3**.\nUse buttons below to mute/unmute.",
      components: [row],
      ephemeral: true,
    });
  }

  // ⏹️ /stop-starfire
  if (interaction.commandName === "stop-starfire") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      connection.destroy();
      starfireConnection = null;
    }

    if (ws.readyState === WebSocket.OPEN) {
      const leaveSignal = {
        type: "leave-starfire-tower",
        guildId: interaction.guild.id,
      };
      console.log("[STARFIRE] 🔴 Sending leave signal to STARFIRE-Tower:", leaveSignal);
      ws.send(JSON.stringify(leaveSignal));
    }

    await interaction.reply({ content: "🛑 STARFIRE has left and notified his tower.", ephemeral: true });
  }
});

client.login(TOKEN);
