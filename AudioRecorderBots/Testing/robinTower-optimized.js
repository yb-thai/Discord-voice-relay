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

const TOKEN = process.env.ROBIN_TOWER_TOKEN;
const ROBIN_ID = "robin-tower";
const PAIRED_WITH = "robin";

const ws = new WebSocket(`ws://localhost:8080/?from=${ROBIN_ID}`);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let robinConnection = null;
let incomingAudio = null;
const audioBufferQueue = [];
const SILENCE_FRAME = Buffer.alloc(1920);

ws.on("open", () => console.log(`[${ROBIN_ID}] WebSocket connected`));
ws.on("close", () => console.log(`[${ROBIN_ID}] WebSocket closed`));
ws.on("error", (err) => console.error(`[${ROBIN_ID}] WebSocket error:`, err));

client.once("ready", () => {
  console.log(`🔊 ${ROBIN_ID} ready. Will auto-join when signaled.`);
});

ws.on("message", async (raw) => {
  try {
    const parsed = JSON.parse(raw.toString());

    // JOIN signal
    if (parsed.type === "join-robin-tower") {
      const { guildId, channelId } = parsed;
      console.log(`[${ROBIN_ID}] 🚀 Joining guild ${guildId}, channel ${channelId}`);

      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel) {
        console.warn(`[${ROBIN_ID}] ⚠️ Channel not found: ${channelId}`);
        return;
      }

      incomingAudio = new Readable({ read() {} });

      robinConnection = joinVoiceChannel({
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
      robinConnection.subscribe(player);

      // Smooth stream feeding every 20ms ... maybe? T_T
      setInterval(() => {
        if (!incomingAudio || !robinConnection) return;
        const buffer = audioBufferQueue.length > 0 ? audioBufferQueue.shift() : SILENCE_FRAME;
        incomingAudio.push(buffer);
      }, 20);
    }

    // LEAVE signal
    else if (parsed.type === "leave-robin-tower") {
      const { guildId } = parsed;
      console.log(`[${ROBIN_ID}] 🛑 Leave signal for guild ${guildId}`);

      const connection = getVoiceConnection(guildId);
      if (connection) {
        try {
          connection.destroy();
          robinConnection = null;
          incomingAudio = null;
          audioBufferQueue.length = 0;
          console.log(`[${ROBIN_ID}] ✅ Disconnected from voice.`);
        } catch (err) {
          console.error(`[${ROBIN_ID}] ❌ Error during disconnect:`, err);
        }
      } else {
        console.log(`[${ROBIN_ID}] ⚠️ No active voice connection found.`);
      }
    }

    // Incoming audio
    else if (parsed.from && parsed.audio && parsed.from !== PAIRED_WITH) {
      const buffer = Buffer.from(parsed.audio, "base64");
      audioBufferQueue.push(buffer);
    }

  } catch (err) {
    console.error(`[${ROBIN_ID}] ❌ WS message error:`, err);
  }
});

client.login(TOKEN);
