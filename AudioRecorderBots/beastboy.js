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

const TOKEN = process.env.BEASTBOY_TOKEN;
const BOT_ID = "beastboy";
const ws = new WebSocket(`ws://localhost:8080/?from=${BOT_ID}`);

// Audio configuration
let audioQueue = [];
const MAX_QUEUE_SIZE = 5; // Maximum number of audio chunks to queue before sending
const CHUNK_SEND_INTERVAL = 20; // Send chunks every 20ms for rate control

ws.on("open", () => console.log(`[${BOT_ID}] WebSocket connected`));
ws.on("close", () => console.log(`[${BOT_ID}] WebSocket closed`));
ws.on("error", (err) => console.error(`[${BOT_ID}] WebSocket error:`, err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let voiceConnection = null;
let mixer = null;
let isMuted = true;
let audioSendInterval = null;

function startAudioSendInterval() {
  if (audioSendInterval) clearInterval(audioSendInterval);

  audioSendInterval = setInterval(() => {
    if (audioQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
      const chunk = audioQueue.shift();
      ws.send(
        JSON.stringify({
          from: BOT_ID,
          audio: chunk.toString("base64"),
          timestamp: Date.now(),
        })
      );
    }
  }, CHUNK_SEND_INTERVAL);
}

function stopAudioSendInterval() {
  if (audioSendInterval) {
    clearInterval(audioSendInterval);
    audioSendInterval = null;
  }
  audioQueue = [];
}

client.once("ready", () => {
  console.log(`🐲 ${BOT_ID} is ready. Use /${BOT_ID} to stream your voice.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // 🎛️ Button interaction
  if (interaction.isButton()) {
    if (interaction.customId === "mute") isMuted = true;
    if (interaction.customId === "unmute") isMuted = false;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mute")
        .setLabel("🔇 Mute BeastBoy")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute BeastBoy")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.update({
      content: `🐲 BeastBoy is ${
        isMuted ? "muted" : "unmuted"
      } — toggle below:`,
      components: [row],
    });
    return;
  }

  // START
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

    if (voiceConnection) {
      await interaction.reply({
        content: "ℹ️ BeastBoy is already listening.",
        ephemeral: true,
      });
      return;
    }

    voiceConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    //  Signal BeastBoy-Tower to join
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "join-beastboy-tower",
          guildId: voiceChannel.guild.id,
          channelId: voiceChannel.id,
        })
      );
    }

    // Create audio mixer with better settings
    mixer = new AudioMixer.Mixer({
      channels: 2,
      bitDepth: 16,
      sampleRate: 48000,
      clearInterval: 20, // Lower interval for smoother audio
    });

    // Start audio sending interval
    startAudioSendInterval();

    // Handle mixed audio data
    mixer.on("data", (chunk) => {
      if (isMuted) return;

      // Queue audio for rate-controlled sending
      if (audioQueue.length < MAX_QUEUE_SIZE) {
        audioQueue.push(chunk);
      }
    });

    voiceConnection.receiver.speaking.on("start", (speakingUserId) => {
      if (isMuted || speakingUserId !== userId) return;

      const opusStream = voiceConnection.receiver.subscribe(speakingUserId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 100 },
      });

      const pcmStream = new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 480,
      });

      const input = new AudioMixer.Input({
        channels: 2,
        bitDepth: 16,
        sampleRate: 48000,
        volume: 50,
      });

      opusStream.pipe(pcmStream).pipe(input);
      mixer.addInput(input);

      opusStream.on("end", () => mixer.removeInput(input));
      opusStream.on("error", console.error);
      pcmStream.on("error", console.error);
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mute")
        .setLabel("🔇 Mute BeastBoy")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute BeastBoy")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `🐲 BeastBoy has joined and is listening to **only you**.\nUse the buttons below to mute/unmute.`,
      components: [row],
      ephemeral: true,
    });
  }

  // STOP
  if (interaction.commandName === "stop-beastboy") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      connection.destroy();
      voiceConnection = null;
      mixer = null;
    }

    // Stop sending audio
    stopAudioSendInterval();

    //  Notify BeastBoy-Tower to disconnect
    if (ws.readyState === WebSocket.OPEN) {
      const leaveSignal = {
        type: "leave-beastboy-tower",
        guildId: interaction.guild.id,
      };

      console.log(
        `[${BOT_ID}] 🔴 Sending leave signal to BeastBoy-Tower:`,
        leaveSignal
      );
      ws.send(JSON.stringify(leaveSignal));
    } else {
      console.log(
        `[${BOT_ID}] ⚠️ WebSocket not open, cannot send leave signal.`
      );
    }

    await interaction.reply({
      content: "🛑 BeastBoy has left and notified his tower.",
      ephemeral: true,
    });
  }
});

client.login(TOKEN);
