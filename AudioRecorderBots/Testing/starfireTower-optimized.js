require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  getVoiceConnection,
} = require("@discordjs/voice");
const { Readable } = require("stream");
const AudioMixer = require("audio-mixer");

const TOKEN = process.env.STARFIRE_TOWER_TOKEN;
const TOWER_ID = "starfire-tower";
const PAIRED_WITH = "starfire";
const SILENCE_FRAME = Buffer.alloc(1920);

const ws = new WebSocket("ws://localhost:8080/?from=" + TOWER_ID);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let voiceConnection = null;
let mixer = null;
let incomingAudio = null;
let lastPushed = Date.now();
const userBuffers = {};
const mixerInputs = {};

client.once("ready", () => {
  console.log(`🔊 ${TOWER_ID} ready.`);
});

ws.on("open", () => console.log(`[${TOWER_ID}] WebSocket connected`));
ws.on("close", () => console.log(`[${TOWER_ID}] WebSocket closed`));
ws.on("error", (err) => console.error(`[${TOWER_ID}] WebSocket error:`, err));

ws.on("message", async (raw) => {
  try {
    const parsed = JSON.parse(raw.toString());

    // Join voice channel
    if (parsed.type === "join-starfire-tower") {
      const { guildId, channelId } = parsed;
      console.log(`[${TOWER_ID}] 🚀 Joining ${guildId}:${channelId}`);

      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel) return console.warn(`[${TOWER_ID}] ⚠️ Channel not found.`);

      incomingAudio = new Readable({ read() {} });

      voiceConnection = joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      const player = createAudioPlayer();
      const resource = createAudioResource(incomingAudio, {
        inputType: StreamType.Raw,
      });

      player.play(resource);
      voiceConnection.subscribe(player);

      mixer = new AudioMixer.Mixer({
        channels: 2,
        bitDepth: 16,
        sampleRate: 48000,
        clearInterval: 20,
      });

      // Push mixed data to stream only if available
      mixer.on("data", (chunk) => {
        if (incomingAudio) {
          incomingAudio.push(chunk);
          lastPushed = Date.now();
        }
      });

      // Feed user mixer inputs on fixed interval
      setInterval(() => {
        if (!mixer) return;

        Object.entries(mixerInputs).forEach(([fromId, input]) => {
          const queue = userBuffers[fromId] || [];
          const next = queue.length > 0 ? queue.shift() : SILENCE_FRAME;
          input.write(next);
        });

        if (incomingAudio && Date.now() - lastPushed > 30) {
          incomingAudio.push(SILENCE_FRAME);
          lastPushed = Date.now();
        }
      }, 20);
    }

    // Leave voice channel
    else if (parsed.type === "leave-starfire-tower") {
      const { guildId } = parsed;
      const conn = getVoiceConnection(guildId);
      if (conn) {
        conn.destroy();
        voiceConnection = null;
        incomingAudio = null;
        console.log(`[${TOWER_ID}] 🛑 Disconnected from voice.`);
      }
    }

    // Audio stream
    else if (parsed.from && parsed.audio && parsed.from !== PAIRED_WITH) {
      const fromId = parsed.from;
      const buffer = Buffer.from(parsed.audio, "base64");

      if (!userBuffers[fromId]) userBuffers[fromId] = [];
      if (!mixerInputs[fromId] && mixer) {
        const input = new AudioMixer.Input({
          channels: 2,
          bitDepth: 16,
          sampleRate: 48000,
          volume: 100,
        });
        mixer.addInput(input);
        mixerInputs[fromId] = input;
        console.log(`[${TOWER_ID}] 🎧 Added mixer input for ${fromId}`);
      }

      userBuffers[fromId].push(buffer);
    }
  } catch (err) {
    console.error(`[${TOWER_ID}] ❌ WebSocket message error:`, err);
  }
});

client.login(TOKEN);
