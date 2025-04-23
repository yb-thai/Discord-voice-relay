require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  getVoiceConnection,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const { Readable, PassThrough } = require("stream");

const TOKEN = process.env.WALLY_TOWER_TOKEN;
const WALLY_ID = "wally-tower";
const PAIRED_WITH = "wally";

const ws = new WebSocket(`ws://localhost:8080/?from=${WALLY_ID}`);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let wallyConnection = null;
let wsHandler = null;
let audioStream = null;
let player = null;
let silenceTimer;

const SILENCE_FRAME = Buffer.alloc(1920);

ws.on("open", () => console.log(`[${WALLY_ID}] WebSocket connected`));
ws.on("close", () => console.log(`[${WALLY_ID}] WebSocket closed`));
ws.on("error", (err) => console.error(`[${WALLY_ID}] WebSocket error:`, err));

client.once("ready", () => {
  console.log(`🔊 ${WALLY_ID} ready. Will auto-join when signaled.`);
});

ws.on("message", async (raw) => {
  try {
    const parsed = JSON.parse(raw.toString());

    if (parsed.type === "join-wally-tower") {
      const { guildId, channelId } = parsed;
      console.log(`[${WALLY_ID}] 🚀 Received join-wally-tower for guild ${guildId}, channel ${channelId}`);

      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel) {
        console.warn(`[${WALLY_ID}] ⚠️ Channel not found for ID: ${channelId}`);
        return;
      }

      audioStream = new PassThrough();

      wallyConnection = joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      player = createAudioPlayer();
      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Raw,
      });

      player.play(resource);
      wallyConnection.subscribe(player);

      // Silence keep-alive
      clearInterval(silenceTimer);
      silenceTimer = setInterval(() => {
        if (audioStream && player.state.status === AudioPlayerStatus.Playing) {
          audioStream.write(SILENCE_FRAME);
        }
      }, 30);
    }

    else if (parsed.type === "leave-wally-tower") {
      const { guildId } = parsed;
      console.log(`[${WALLY_ID}] 🛑 Received leave-wally-tower for guild ${guildId}`);

      const connection = getVoiceConnection(guildId);
      if (connection) {
        try {
          connection.destroy();
          wallyConnection = null;
          audioStream = null;
          if (silenceTimer) clearInterval(silenceTimer);
          console.log(`[${WALLY_ID}] ✅ Disconnected from voice.`);
        } catch (err) {
          console.error(`[${WALLY_ID}] ❌ Error during disconnect:`, err);
        }
      } else {
        console.log(`[${WALLY_ID}] ⚠️ No voice connection to destroy.`);
      }
    }

    else if (parsed.from && parsed.audio && parsed.from !== PAIRED_WITH) {
      if (audioStream && parsed.audio) {
        const buffer = Buffer.from(parsed.audio, "base64");
        audioStream.write(buffer);
      }
    }

  } catch (err) {
    console.error(`[${WALLY_ID}] ❌ WS parse error:`, err);
  }
});

client.login(TOKEN);
