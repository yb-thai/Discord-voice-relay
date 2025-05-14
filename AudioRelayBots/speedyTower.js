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

const TOKEN = process.env.SPEEDY_TOWER_TOKEN;
const SPEEDY_ID = "speedy-tower";
const PAIRED_WITH = "speedy";

const ws = new WebSocket(`ws://localhost:8080/?from=${SPEEDY_ID}`);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let speedyConnection = null;
let wsHandler = null;
let incomingAudio = null;
let lastPushed = Date.now();
const SILENCE_FRAME = Buffer.alloc(1920);

ws.on("open", () => console.log(`[${SPEEDY_ID}] WebSocket connected`));
ws.on("close", () => console.log(`[${SPEEDY_ID}] WebSocket closed`));
ws.on("error", (err) => console.error(`[${SPEEDY_ID}] WebSocket error:`, err));

client.once("ready", () => {
  console.log(`🔊 ${SPEEDY_ID} ready. Will auto-join when signaled.`);
});

ws.on("message", async (raw) => {
  // console.log(`[${SPEEDY_ID}] 📩 Raw WS Message Received: ${raw.toString()}`);
  
  try {
    const parsed = JSON.parse(raw.toString());

    //  JOIN signal
    if (parsed.type === "join-speedy-tower") {
      const { guildId, channelId } = parsed;
      console.log(`[${SPEEDY_ID}] 🚀 Received join-speedy-tower for guild ${guildId}, channel ${channelId}`);

      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel) {
        console.warn(`[${SPEEDY_ID}] ⚠️ Channel not found for ID: ${channelId}`);
        return;
      }

      console.log(`[${SPEEDY_ID}] Connecting to ${channel.name} (${channelId})`);

      incomingAudio = new Readable({ read() {} });

      speedyConnection = joinVoiceChannel({
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
      speedyConnection.subscribe(player);

      lastPushed = Date.now();

      // Silence pusher
      setInterval(() => {
        if (!incomingAudio || !speedyConnection) return;
        if (Date.now() - lastPushed > 30) {
          incomingAudio.push(SILENCE_FRAME);
          lastPushed = Date.now();
        }
      }, 10);
      
    }

    // LEAVE signal
    else if (parsed.type === "leave-speedy-tower") {
      const { guildId } = parsed;
      console.log(`[${SPEEDY_ID}] 🛑 Received leave-speedy-tower for guild ${guildId}`);

      const connection = getVoiceConnection(guildId);
      if (connection) {
        try {
          connection.destroy();
          speedyConnection = null;
          incomingAudio = null;
          console.log(`[${SPEEDY_ID}] ✅ Successfully disconnected from voice.`);
        } catch (err) {
          console.error(`[${SPEEDY_ID}] ❌ Error while destroying connection:`, err);
        }
      } else {
        console.log(`[${SPEEDY_ID}] ⚠️ No active voice connection to destroy.`);
      }
    }

    //  Audio stream
    else if (parsed.from && parsed.audio && parsed.from !== PAIRED_WITH) {
      if (incomingAudio) {
        incomingAudio.push(Buffer.from(parsed.audio, "base64"));
        lastPushed = Date.now();
      }
    }

  } catch (err) {
    console.error(`[${SPEEDY_ID}] ❌ WebSocket message error:`, err);
  }
});


client.login(TOKEN);
