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

const TOKEN = process.env.BATMAN_TOWER_TOKEN;
const BATMAN_ID = "batman-tower";
const PAIRED_WITH = "batman";

const ws = new WebSocket(`ws://localhost:8080/?from=${BATMAN_ID}`);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

let batmanConnection = null;
let wsHandler = null;
let incomingAudio = null;
let lastPushed = Date.now();
const SILENCE_FRAME = Buffer.alloc(1920);

ws.on("open", () => console.log(`[${BATMAN_ID}] WebSocket connected`));
ws.on("close", () => console.log(`[${BATMAN_ID}] WebSocket closed`));
ws.on("error", (err) => console.error(`[${BATMAN_ID}] WebSocket error:`, err));

client.once("ready", () => {
  console.log(`🔊 ${BATMAN_ID} ready. Will auto-join when signaled.`);
});

ws.on("message", async (raw) => {
  try {
    const parsed = JSON.parse(raw.toString());

    if (parsed.type === "join-batman-tower") {
      const { guildId, channelId } = parsed;
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);
      if (!channel) return;

      console.log(`[${BATMAN_ID}] Joining ${channel.name}`);

      incomingAudio = new Readable({ read() {} });
      batmanConnection = joinVoiceChannel({
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
      batmanConnection.subscribe(player);

      lastPushed = Date.now();

      setInterval(() => {
        if (!incomingAudio || !batmanConnection) return;
        if (Date.now() - lastPushed > 30) {
          incomingAudio.push(SILENCE_FRAME);
          lastPushed = Date.now();
        }
      }, 10);
    }

    else if (parsed.type === "leave-batman-tower") {
      const { guildId } = parsed;
      console.log(`[${BATMAN_ID}] Disconnecting from guild ${guildId}`);

      const connection = getVoiceConnection(guildId);
      if (connection) {
        connection.destroy();
        batmanConnection = null;
        incomingAudio = null;
      }
    }

    else if (parsed.from && parsed.audio && parsed.from !== PAIRED_WITH) {
      if (incomingAudio) {
        incomingAudio.push(Buffer.from(parsed.audio, "base64"));
        lastPushed = Date.now();
      }
    }
  } catch (err) {
    console.error(`[${BATMAN_ID}] WebSocket message error:`, err);
  }
});

client.login(TOKEN);
