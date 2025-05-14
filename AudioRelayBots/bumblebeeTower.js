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

const TOKEN = process.env.BUMBLEBEE_TOWER_TOKEN;
const BUMBLEBEE_ID = "bumblebee-tower";
const PAIRED_WITH = "bumblebee";

const ws = new WebSocket(`ws://localhost:8080/?from=${BUMBLEBEE_ID}`);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let bumblebeeConnection = null;
let wsHandler = null;
let incomingAudio = null;
let lastPushed = Date.now();
const SILENCE_FRAME = Buffer.alloc(1920);

ws.on("open", () => console.log(`[${BUMBLEBEE_ID}] WebSocket connected`));
ws.on("close", () => console.log(`[${BUMBLEBEE_ID}] WebSocket closed`));
ws.on("error", (err) => console.error(`[${BUMBLEBEE_ID}] WebSocket error:`, err));

client.once("ready", () => {
  console.log(`🔊 ${BUMBLEBEE_ID} ready. Will auto-join when signaled.`);
});

ws.on("message", async (raw) => {
  // console.log(`[${BUMBLEBEE_ID}] 📩 Raw WS Message Received: ${raw.toString()}`);
  
  try {
    const parsed = JSON.parse(raw.toString());

    //  JOIN signal
    if (parsed.type === "join-bumblebee-tower") {
      const { guildId, channelId } = parsed;
      console.log(`[${BUMBLEBEE_ID}] 🚀 Received join-bumblebee-tower for guild ${guildId}, channel ${channelId}`);

      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel) {
        console.warn(`[${BUMBLEBEE_ID}] ⚠️ Channel not found for ID: ${channelId}`);
        return;
      }

      console.log(`[${BUMBLEBEE_ID}] Connecting to ${channel.name} (${channelId})`);

      incomingAudio = new Readable({ read() {} });

      bumblebeeConnection = joinVoiceChannel({
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
      bumblebeeConnection.subscribe(player);

      lastPushed = Date.now();

      // Silence pusher
      setInterval(() => {
        if (!incomingAudio || !bumblebeeConnection) return;
        if (Date.now() - lastPushed > 30) {
          incomingAudio.push(SILENCE_FRAME);
          lastPushed = Date.now();
        }
      }, 10);
      
    }

    // LEAVE signal
    else if (parsed.type === "leave-bumblebee-tower") {
      const { guildId } = parsed;
      console.log(`[${BUMBLEBEE_ID}] 🛑 Received leave-bumblebee-tower for guild ${guildId}`);

      const connection = getVoiceConnection(guildId);
      if (connection) {
        try {
          connection.destroy();
          bumblebeeConnection = null;
          incomingAudio = null;
          console.log(`[${BUMBLEBEE_ID}] ✅ Successfully disconnected from voice.`);
        } catch (err) {
          console.error(`[${BUMBLEBEE_ID}] ❌ Error while destroying connection:`, err);
        }
      } else {
        console.log(`[${BUMBLEBEE_ID}] ⚠️ No active voice connection to destroy.`);
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
    console.error(`[${BUMBLEBEE_ID}] ❌ WebSocket message error:`, err);
  }
});


client.login(TOKEN);
