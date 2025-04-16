require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
} = require("@discordjs/voice");
const ffmpeg = require("ffmpeg-static");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const fs = require("fs");

const TOKEN = "MTM2MTg3ODgyNTI0NzU3MjEyOA.GTIahn._1vKKS6h5LImGtSZw2Vr06svMq6T0HDCX3GE3E";


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

// Create a persistent Readable stream that Bot A will push audio into
const incomingAudio = new Readable({
  read() {}, // no-op
});

ws.on("message", (data) => {
  // Push received raw PCM data into the stream
  console.log(`[Bot B] Received data: ${data.length} bytes`);
  incomingAudio.push(data);
  lastPushed = Date.now();
});

let lastPushed = Date.now();

console.log("[Bot B] Connected to audio relay server");

client.once("ready", () => {
    console.log("🔊 Audio stream bot ready. Use /outsideman to play audio.");
  });
  
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
  
    if (interaction.commandName === "outsideman") {
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
      });
  
      await interaction.reply(`🔊 Joined ${voiceChannel.name} — playing audio.`);

  const player = createAudioPlayer();

  player.on("stateChange", (oldState, newState) => {
    console.log(
      `[Bot B] AudioPlayer transitioned from ${oldState.status} to ${newState.status}`
    );
  });

  player.on("error", (error) => {
    console.error(`[Bot B] AudioPlayer error:`, error.message);
  });

  player.on("stateChange", (old, newS) => {
    console.log(`[Bot B] Player state: ${old.status} ➝ ${newS.status}`);
  });

  // Create a Discord audio resource from ffmpeg stdout
  const resource = createAudioResource(incomingAudio, {
    inputType: StreamType.Raw, // explicitly tell Discord it's raw PCM
  });

  player.on(AudioPlayerStatus.Playing, () => {
    console.log("[Bot B] 🔊 Now playing audio");
  });

  player.on(AudioPlayerStatus.Idle, () => {
    console.log("[Bot B] ⚠️ Player is idle");
  });

  player.on("error", (err) => {
    console.error("[Bot B] Player error:", err);
  });

  connection.subscribe(player);

  setInterval(() => {
    const now = Date.now();
    if (now - lastPushed > 30) {
      console.log(`[Bot B] Pushing silence frame to avoid idle.`);
      incomingAudio.push(SILENCE_FRAME);
      lastPushed = now;
    }
  }, 10);
    
  player.play(resource); // start playback
    } //sus
});

client.login(TOKEN);
