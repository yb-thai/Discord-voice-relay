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

const TOKEN = process.env.CYBORG_TOWER_TOKEN;
const CYBORG_ID = "cyborg-tower";
const PAIRED_WITH = "cyborg";

const ws = new WebSocket(`ws://localhost:8080/?from=${CYBORG_ID}`);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let cyborgConnection = null;
let wsHandler = null;
let incomingAudio = null;
let lastPushed = Date.now();
const SILENCE_FRAME = Buffer.alloc(1920);

ws.on("open", () => console.log(`[${CYBORG_ID}] WebSocket connected`));
ws.on("close", () => console.log(`[${CYBORG_ID}] WebSocket closed`));
ws.on("error", (err) => console.error(`[${CYBORG_ID}] WebSocket error:`, err));

client.once("ready", () => {
  console.log(`🔊 ${CYBORG_ID} ready. Will auto-join when signaled.`);
});

ws.on("message", async (raw) => {
  // console.log(`[${CYBORG_ID}] 📩 Raw WS Message Received: ${raw.toString()}`);
  
  try {
    const parsed = JSON.parse(raw.toString());

    //  JOIN signal
    if (parsed.type === "join-cyborg-tower") {
      const { guildId, channelId } = parsed;
      console.log(`[${CYBORG_ID}] 🚀 Received join-cyborg-tower for guild ${guildId}, channel ${channelId}`);

      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel) {
        console.warn(`[${CYBORG_ID}] ⚠️ Channel not found for ID: ${channelId}`);
        return;
      }

      console.log(`[${CYBORG_ID}] Connecting to ${channel.name} (${channelId})`);

      incomingAudio = new Readable({ read() {} });

      cyborgConnection = joinVoiceChannel({
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
      cyborgConnection.subscribe(player);

      lastPushed = Date.now();

      // Silence pusher
      setInterval(() => {
        if (!incomingAudio || !cyborgConnection) return;
        if (Date.now() - lastPushed > 30) {
          incomingAudio.push(SILENCE_FRAME);
          lastPushed = Date.now();
        }
      }, 10);
      
    }

    // LEAVE signal
    else if (parsed.type === "leave-cyborg-tower") {
      const { guildId } = parsed;
      console.log(`[${CYBORG_ID}] 🛑 Received leave-cyborg-tower for guild ${guildId}`);

      const connection = getVoiceConnection(guildId);
      if (connection) {
        try {
          connection.destroy();
          cyborgConnection = null;
          incomingAudio = null;
          console.log(`[${CYBORG_ID}] ✅ Successfully disconnected from voice.`);
        } catch (err) {
          console.error(`[${CYBORG_ID}] ❌ Error while destroying connection:`, err);
        }
      } else {
        console.log(`[${CYBORG_ID}] ⚠️ No active voice connection to destroy.`);
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
    console.error(`[${CYBORG_ID}] ❌ WebSocket message error:`, err);
  }
});


client.login(TOKEN);
