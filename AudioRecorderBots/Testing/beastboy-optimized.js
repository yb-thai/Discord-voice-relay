require("dotenv").config();
const WebSocket = require("ws");
const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  joinVoiceChannel,
  EndBehaviorType,
  getVoiceConnection,
} = require("@discordjs/voice");
const prism = require("prism-media");
const AudioMixer = require("audio-mixer");

// --- Constants
const TOKEN = process.env.BEASTBOY_TOKEN;
const ws = new WebSocket("ws://localhost:8080/?from=beastboy");
const SILENCE_FRAME = Buffer.alloc(1920); // 20ms silence at 48kHz stereo 16-bit

// --- WebSocket Handlers
ws.on("open", () => console.log("[beastboy] WebSocket connected"));
ws.on("close", () => console.log("[beastboy] WebSocket closed"));
ws.on("error", (err) => console.error("[beastboy] WebSocket error:", err));

// --- Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// --- State
let beastboyConnection = null;
let isMuted = true;
const audioBufferQueue = [];

const mixer = new AudioMixer.Mixer({
  channels: 2,
  bitDepth: 16,
  sampleRate: 48000,
  clearInterval: 20,
});

const input = new AudioMixer.Input({
  channels: 2,
  bitDepth: 16,
  sampleRate: 48000,
  volume: 100,
});

mixer.addInput(input);

// Feed mixer from buffer queue (or silence)
setInterval(() => {
  const buffer = audioBufferQueue.length > 0 ? audioBufferQueue.shift() : SILENCE_FRAME;
  input.write(buffer);
}, 20);

// Send non-silent audio only if not muted
mixer.on("data", (chunk) => {
  if (
    ws.readyState === WebSocket.OPEN &&
    !isMuted &&
    !chunk.equals(SILENCE_FRAME)
  ) {
    ws.send(
      JSON.stringify({
        from: "beastboy",
        audio: chunk.toString("base64"),
      })
    );
  }
});

client.once("ready", () => {
  console.log("🌟 beastboy is ready. Use /beastboy to stream your voice.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // Button handling
  if (interaction.isButton()) {
    if (interaction.customId === "mute") isMuted = true;
    if (interaction.customId === "unmute") isMuted = false;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mute")
        .setLabel("🔇 Mute Beastboy")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute Beastboy")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.update({
      content: `🌟 Beastboy is ${isMuted ? "muted" : "unmuted"} — toggle below:`,
      components: [row],
    });
    return;
  }

  // Start command
  if (interaction.commandName === "beastboy") {
    const voiceChannel = interaction.member.voice.channel;
    const userId = interaction.user.id;

    if (!voiceChannel) {
      await interaction.reply({
        content: "❌ Join a voice channel first.",
        ephemeral: true,
      });
      return;
    }

    if (beastboyConnection) {
      await interaction.reply({
        content: "ℹ️ Beastboy is already listening.",
        ephemeral: true,
      });
      return;
    }

    beastboyConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    // Signal tower to join
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "join-beastboy-tower",
          guildId: voiceChannel.guild.id,
          channelId: voiceChannel.id,
        })
      );
    }

    // Start capturing voice
    beastboyConnection.receiver.speaking.on("start", (speakingUserId) => {
      if (isMuted || speakingUserId !== userId) return;

      const opusStream = beastboyConnection.receiver.subscribe(speakingUserId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 100 },
      });

      const pcmStream = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 960,
      });

      opusStream.pipe(pcmStream);

      pcmStream.on("data", (chunk) => {
        audioBufferQueue.push(chunk);
      });

      opusStream.on("error", console.error);
      pcmStream.on("error", console.error);
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mute")
        .setLabel("🔇 Mute Beastboy")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute Beastboy")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `🌟 Beastboy has joined and is listening to **only you**.\nUse the buttons below to mute/unmute.`,
      components: [row],
      ephemeral: true,
    });
  }

  // Stop command
  if (interaction.commandName === "stop-beastboy") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      connection.destroy();
      beastboyConnection = null;
    }

    if (ws.readyState === WebSocket.OPEN) {
      const leaveSignal = {
        type: "leave-beastboy-tower",
        guildId: interaction.guild.id,
      };
      console.log("[Beastboy] 🔴 Sending leave signal to Beastboy-Tower:", leaveSignal);
      ws.send(JSON.stringify(leaveSignal));
    } else {
      console.log("[Beastboy] ⚠️ WebSocket not open, cannot send leave signal.");
    }

    await interaction.reply({
      content: "🛑 Beastboy has left and notified her tower.",
      ephemeral: true,
    });
  }
});

client.login(TOKEN);
