require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  getVoiceConnection,
} = require("@discordjs/voice");
const ffmpeg = require("ffmpeg-static");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const fs = require("fs");

const TOKEN = (process.env.ROBIN_1_TOKEN);


const ws = new WebSocket("ws://localhost:8080"); // Connect to the server


const chunkQueue = [];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

const SILENCE_FRAME = Buffer.alloc(1920); // 20ms @ 48kHz stereo s16le

// Create a persistent Readable stream that Batman will push audio into
const incomingAudio = new Readable({
  read() { }, // no-op
});

ws.on("message", (data) => {
  console.log(`[Robin] Received ${data.length} bytes`);
});
ws.on("open", () => { console.log("[Robin] WebSocket connected"); });
ws.on("close", () => { console.log("[Robin] WebSocket closed"); });
ws.on("error", (err) => { console.error("[Robin] WebSocket error:", err); });

ws.on("message", (data) => {
  // Push received raw PCM data into the stream
  console.log(`[Robin-1] Received data: ${data.length} bytes`);
  incomingAudio.push(data);
  lastPushed = Date.now();
});

let lastPushed = Date.now();
// Global variable for Robin's voice robinConnection
let robinConnection = null;

console.log("[Robin-1] Connected to audio relay server");

client.once("ready", () => {
  console.log("🔊 Audio stream bot ready. Use /robin-1 to play audio.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "robin-1") {
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply("❌ You must be in a voice channel to use this command.");
      return;
    }

 

    robinConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    await interaction.reply(`🔊 Joined ${voiceChannel.name} — start playing audio.`);

    const player = createAudioPlayer();

    player.on("stateChange", (oldState, newState) => {
      console.log(
        `[Robin-1] AudioPlayer transitioned from ${oldState.status} to ${newState.status}`
      );
    });

    player.on("error", (error) => {
      console.error(`[Robin-1] AudioPlayer error:`, error.message);
    });

    player.on("stateChange", (old, newS) => {
      console.log(`[Robin-1] Player state: ${old.status} ➝ ${newS.status}`);
    });

    // Create a Discord audio resource from ffmpeg stdout
    const resource = createAudioResource(incomingAudio, {
      inputType: StreamType.Raw, // explicitly tell Discord it's raw PCM
    });

    player.on(AudioPlayerStatus.Playing, () => {
      console.log("[Robin-1] 🔊 Now playing audio");
    });

    player.on(AudioPlayerStatus.Idle, () => {
      console.log("[Robin-1] ⚠️ Player is idle");
    });

    player.on("error", (err) => {
      console.error("[Robin-1] Player error:", err);
    });

    robinConnection.subscribe(player);

    setInterval(() => {
      const now = Date.now();
      if (now - lastPushed > 30) {
        // console.log(`[Robin-1] Pushing silence frame to avoid idle.`);
        incomingAudio.push(SILENCE_FRAME);
        lastPushed = now;
      }
    }, 10);

    player.play(resource); // start playback
  } //sus

  if (interaction.commandName === "stop-robin-1") {
      robinConnection = getVoiceConnection(interaction.guild.id);
    if (robinConnection) {
      robinConnection.destroy();
      await interaction.reply("🛑 Robin-1 has left the voice channel.");
    } else {
      await interaction.reply("⚠️ Robin-1 is not currently in a voice channel.");
    }
  }
});

client.login(TOKEN);
