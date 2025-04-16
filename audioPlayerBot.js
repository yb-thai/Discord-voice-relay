const WebSocket = require("ws");
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  NoSubscriberBehavior,
} = require("@discordjs/voice");
const ffmpeg = require("ffmpeg-static");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const fs = require("fs");

const TOKEN = "TOKEN";
const GUILD_ID = "SERVER";
const CHANNEL_B_ID = "REPLAY_CHANNEL";

const ws = new WebSocket("ws://localhost:8080"); // Connect to the server
const chunkQueue = [];
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
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

client.once("ready", async () => {
  console.log(`Bot B is ready`);

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(CHANNEL_B_ID);

  const connection = joinVoiceChannel({
    channelId: CHANNEL_B_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

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
});

client.login(TOKEN);
