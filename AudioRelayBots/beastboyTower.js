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

const TOKEN = process.env.BEASTBOY_TOWER_TOKEN;
const BEASTBOY_ID = "beastboy-tower";
const PAIRED_WITH = "beastboy";

const ws = new WebSocket(`ws://localhost:8080/?from=${BEASTBOY_ID}`);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let beastboyConnection = null;
let wsHandler = null;
let incomingAudio = null;
let lastPushed = Date.now();
const SILENCE_FRAME = Buffer.alloc(1920);

ws.on("open", () => console.log(`[${BEASTBOY_ID}] WebSocket connected`));
ws.on("close", () => console.log(`[${BEASTBOY_ID}] WebSocket closed`));
ws.on("error", (err) => console.error(`[${BEASTBOY_ID}] WebSocket error:`, err));

client.once("ready", () => {
  console.log(`🔊 ${BEASTBOY_ID} ready. Will auto-join when signaled.`);
});

ws.on("message", async (raw) => {
  // console.log(`[${BEASTBOY_ID}] 📩 Raw WS Message Received: ${raw.toString()}`);
  
  try {
    const parsed = JSON.parse(raw.toString());

    // 🚀 JOIN signal
    if (parsed.type === "join-beastboy-tower") {
      const { guildId, channelId } = parsed;
      console.log(`[${BEASTBOY_ID}] 🚀 Received join-beastboy-tower for guild ${guildId}, channel ${channelId}`);

      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel) {
        console.warn(`[${BEASTBOY_ID}] ⚠️ Channel not found for ID: ${channelId}`);
        return;
      }

      console.log(`[${BEASTBOY_ID}] Connecting to ${channel.name} (${channelId})`);

      incomingAudio = new Readable({ read() {} });

      beastboyConnection = joinVoiceChannel({
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
      beastboyConnection.subscribe(player);

      lastPushed = Date.now();

      // Silence pusher
      setInterval(() => {
        if (!incomingAudio || !beastboyConnection) return;
        if (Date.now() - lastPushed > 20) {
          incomingAudio.push(SILENCE_FRAME);
          lastPushed = Date.now();
        }
      }, 20);
      
    }

    // 🛑 LEAVE signal
    else if (parsed.type === "leave-beastboy-tower") {
      const { guildId } = parsed;
      console.log(`[${BEASTBOY_ID}] 🛑 Received leave-beastboy-tower for guild ${guildId}`);

      const connection = getVoiceConnection(guildId);
      if (connection) {
        try {
          connection.destroy();
          beastboyConnection = null;
          incomingAudio = null;
          console.log(`[${BEASTBOY_ID}] ✅ Successfully disconnected from voice.`);
        } catch (err) {
          console.error(`[${BEASTBOY_ID}] ❌ Error while destroying connection:`, err);
        }
      } else {
        console.log(`[${BEASTBOY_ID}] ⚠️ No active voice connection to destroy.`);
      }
    }

    // 🎧 Audio stream
    else if (parsed.from && parsed.audio && parsed.from !== PAIRED_WITH) {
      if (incomingAudio) {
        incomingAudio.push(Buffer.from(parsed.audio, "base64"));
        lastPushed = Date.now();
      }
    }

  } catch (err) {
    console.error(`[${BEASTBOY_ID}] ❌ WebSocket message error:`, err);
  }
});


client.login(TOKEN);
