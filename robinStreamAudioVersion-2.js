require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  getVoiceConnection,
} = require("@discordjs/voice");
const { Readable } = require("stream");

const TOKEN = process.env.ROBIN_2_TOKEN;
const ws = new WebSocket("ws://localhost:8080");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

const SILENCE_FRAME = Buffer.alloc(1920);
let robinConnection = null;
let wsHandler = null;
let incomingAudio = null;
let lastPushed = Date.now();

ws.on("open", () => console.log("[Robin] WebSocket connected"));
ws.on("close", () => console.log("[Robin] WebSocket closed"));
ws.on("error", (err) => console.error("[Robin] WebSocket error:", err));

client.once("ready", () => {
  console.log("🔊 Audio stream bot ready. Use /robin-2 to play audio.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

    // START COMMAND
    if (interaction.commandName === "robin-2") {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        await interaction.reply({ content: "❌ You must be in a voice channel to use this command.", ephemeral: true });
        return;
      }
  
      if (robinConnection) {
        await interaction.reply({ content: "ℹ️ Robin-2 is already capturing audio.", ephemeral: true });
        return;
      }

    // Set up fresh stream
    incomingAudio = new Readable({
      read() {},
    });

    robinConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    await interaction.reply({ content: `🛰️ Robin-2 joined ${voiceChannel.name} and started spying mission.`, ephemeral: true });

    const player = createAudioPlayer();
    const resource = createAudioResource(incomingAudio, {
      inputType: StreamType.Raw,
    });

    player.play(resource);
    robinConnection.subscribe(player);

    player.on("stateChange", (oldState, newState) => {
      console.log(`[Robin-2] Player state: ${oldState.status} ➝ ${newState.status}`);
    });

    player.on("error", (error) => {
      console.error(`[Robin-2] Player error:`, error.message);
    });

    // ✅ Register a single ws message handler
    if (wsHandler) ws.off("message", wsHandler); // unregister old handler if exists
    wsHandler = (data) => {
      console.log(`[Robin-2] Received ${data.length} bytes`);
      incomingAudio.push(data);
      lastPushed = Date.now();
    };
    ws.on("message", wsHandler);

    // Silence filler
    setInterval(() => {
      if (Date.now() - lastPushed > 30) {
        incomingAudio.push(SILENCE_FRAME);
        lastPushed = Date.now();
      }
    }, 10);
  }

    // STOP COMMAND
    if (interaction.commandName === "stop-robin-2") {
      const connection = getVoiceConnection(interaction.guild.id);
      if (connection) {
        connection.destroy();
        batmanConnection = null;
  
        await interaction.reply({ content: "🛑 Robin-2 has left the mission.", ephemeral: true });
       // logChannel.send(`🛑 **Robin-2 has left** the voice channel in ${interaction.guild.name}.`);
      } else {
        await interaction.reply({ content: "⚠️ Robin-2 is not currently in a voice channel.", ephemeral: true });
      }
    }
});

client.login(TOKEN);
