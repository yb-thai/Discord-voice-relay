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

const TOKEN = process.env.STARFIRE_TOWER_TOKEN;
const STARFIRE_ID = "starfire-tower";
const PAIRED_WITH = "starfire";

const ws = new WebSocket(`ws://localhost:8080/?from=${STARFIRE_ID}`);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let starfireConnection = null;
let incomingAudio = null;
const audioBufferQueue = [];
const SILENCE_FRAME = Buffer.alloc(1920);

ws.on("open", () => console.log(`[${STARFIRE_ID}] WebSocket connected`));
ws.on("close", () => console.log(`[${STARFIRE_ID}] WebSocket closed`));
ws.on("error", (err) => console.error(`[${STARFIRE_ID}] WebSocket error:`, err));

client.once("ready", () => {
  console.log(`🔊 ${STARFIRE_ID} ready. Will auto-join when signaled.`);
});

ws.on("message", async (raw) => {
  try {
    const parsed = JSON.parse(raw.toString());

    // JOIN signal
    if (parsed.type === "join-starfire-tower") {
      const { guildId, channelId } = parsed;
      console.log(`[${STARFIRE_ID}] 🚀 Joining guild ${guildId}, channel ${channelId}`);

      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel) {
        console.warn(`[${STARFIRE_ID}] ⚠️ Channel not found: ${channelId}`);
        return;
      }

      incomingAudio = new Readable({ read() {} });

      starfireConnection = joinVoiceChannel({
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
      starfireConnection.subscribe(player);

      // Smooth stream feeding every 20ms ... maybe? T_T
      setInterval(() => {
        if (!incomingAudio || !starfireConnection) return;
        const buffer = audioBufferQueue.length > 0 ? audioBufferQueue.shift() : SILENCE_FRAME;
        incomingAudio.push(buffer);
      }, 20);
    }

    // LEAVE signal
    else if (parsed.type === "leave-starfire-tower") {
      const { guildId } = parsed;
      console.log(`[${STARFIRE_ID}] 🛑 Leave signal for guild ${guildId}`);

      const connection = getVoiceConnection(guildId);
      if (connection) {
        try {
          connection.destroy();
          starfireConnection = null;
          incomingAudio = null;
          audioBufferQueue.length = 0;
          console.log(`[${STARFIRE_ID}] ✅ Disconnected from voice.`);
        } catch (err) {
          console.error(`[${STARFIRE_ID}] ❌ Error during disconnect:`, err);
        }
      } else {
        console.log(`[${STARFIRE_ID}] ⚠️ No active voice connection found.`);
      }
    }

    // Incoming audio
    else if (parsed.from && parsed.audio && parsed.from !== PAIRED_WITH) {
      const buffer = Buffer.from(parsed.audio, "base64");
      audioBufferQueue.push(buffer);
    }

  } catch (err) {
    console.error(`[${STARFIRE_ID}] ❌ WS message error:`, err);
  }
});

client.login(TOKEN);
