// starfire is a bit different from batman implement tracking who use prompt and only track that user voice input
// use for main shotcaller, maybe just maybe - possible can use for two way communication brute force. 

require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events } = require("discord.js");
const { joinVoiceChannel, EndBehaviorType, getVoiceConnection } = require("@discordjs/voice");
const prism = require("prism-media");
const AudioMixer = require("audio-mixer");

const TOKEN = process.env.STARFIRE_TOKEN;

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => console.log("[Starfire] WebSocket connected"));
ws.on("close", () => console.log("[Starfire] WebSocket closed"));
ws.on("error", (err) => console.error("[Starfire] WebSocket error:", err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let starfireConnection = null;
let mixer = null;

client.once("ready", () => {
  console.log("🌟 Starfire ready. Use /starfire to capture audio from the caller only.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // START
  if (interaction.commandName === "starfire") {
    const voiceChannel = interaction.member.voice.channel;
    const userId = interaction.user.id;

    if (!voiceChannel) {
      await interaction.reply({ content: "❌ You must be in a voice channel to use this command.", ephemeral: true });
      return;
    }

    if (starfireConnection) {
      await interaction.reply({ content: "ℹ️ Starfire is already running.", ephemeral: true });
      return;
    }

    starfireConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

        mixer = new AudioMixer.Mixer({
          channels: 2,
          bitDepth: 16,
          sampleRate: 48000,
          clearInterval: 100,
        });
    
        mixer.on("data", (chunk) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(chunk);
          }
        });

    starfireConnection.receiver.speaking.on("start", (speakingUserId) => {
      if (speakingUserId !== userId) return;

      console.log(`[Starfire] User ${speakingUserId} started speaking`);

      const opusStream = starfireConnection.receiver.subscribe(speakingUserId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 100,
        },
      });

      const pcmStream = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 480,
      });

      opusStream.pipe(pcmStream);

      const input = new AudioMixer.Input({
              channels: 2,
              bitDepth: 16,
              sampleRate: 48000,
              volume: 50,
            });
      
            pcmStream.pipe(input);
            mixer.addInput(input);
      
            opusStream.on("end", () => {
              console.log(`User ${userId} stopped speaking`);
              mixer.removeInput(input);
            });

      opusStream.on("error", console.error);
      pcmStream.on("error", console.error);
    });

    await interaction.reply({
      content: `🛰️ Starfire joined ${voiceChannel.name} and will only stream **your voice**.`,
      ephemeral: true,
    });
  }

  // STOP
  if (interaction.commandName === "stop-starfire") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      connection.destroy();
      starfireConnection = null;
      await interaction.reply({ content: "🛑 Starfire has left the channel.", ephemeral: true });
    } else {
      await interaction.reply({ content: "⚠️ Starfire is not active in this guild.", ephemeral: true });
    }
  }
});

client.login(TOKEN);
