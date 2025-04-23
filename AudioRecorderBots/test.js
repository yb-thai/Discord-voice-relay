require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { joinVoiceChannel, EndBehaviorType, getVoiceConnection } = require("@discordjs/voice");
const prism = require("prism-media");
const AudioMixer = require("audio-mixer");

const TOKEN = process.env.WALLY_TOKEN;
const ws = new WebSocket("ws://localhost:8080/?from=wally");

ws.on("open", () => console.log("[Wally] WebSocket connected"));
ws.on("close", () => console.log("[Wally] WebSocket closed"));
ws.on("error", (err) => console.error("[Wally] WebSocket error:", err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let wallyConnection = null;
let mixer = null;
let isMuted = true;

client.once("ready", () => {
  console.log("⚡ Wally ready. Use /wally to start.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // 🔘 Handle mute/unmute button press
  if (interaction.isButton()) {
    isMuted = interaction.customId === "mute";
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mute")
        .setLabel("🔇 Mute Wally")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute Wally")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.update({
      content: `🛰️ Wally is now ${isMuted ? "muted" : "unmuted"}.`,
      components: [row],
    });
    return;
  }

  // 🟢 START
  if (interaction.commandName === "wally") {
    const voiceChannel = interaction.member.voice.channel;
    const userId = interaction.user.id;

    if (!voiceChannel) {
      await interaction.reply({ content: "❌ You must be in a voice channel.", ephemeral: true });
      return;
    }

    if (wallyConnection) {
      await interaction.reply({ content: "ℹ️ Wally is already active.", ephemeral: true });
      return;
    }

    // Join voice
    wallyConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    // Notify Wally-Tower to join
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "join-wally-tower",
        guildId: voiceChannel.guild.id,
        channelId: voiceChannel.id,
      }));
    }

    mixer = new AudioMixer.Mixer({
      channels: 2,
      bitDepth: 16,
      sampleRate: 48000,
      clearInterval: 100,
    });

    mixer.on("data", (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ from: "wally", audio: chunk.toString("base64") }));
      }
    });

    wallyConnection.receiver.speaking.on("start", (speakingUserId) => {
      if (isMuted || speakingUserId !== userId) return;

      const opusStream = wallyConnection.receiver.subscribe(speakingUserId, {
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
        .setLabel("🔇 Mute Wally")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute Wally")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `🛰️ Wally is listening to **only you**.\nToggle mute below.`,
      components: [row],
      ephemeral: true,
    });
  }

  // 🔴 STOP
  if (interaction.commandName === "stop-wally") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      connection.destroy();
      wallyConnection = null;
    }

    if (ws.readyState === WebSocket.OPEN) {
      const leaveSignal = {
        type: "leave-wally-tower",
        guildId: interaction.guild.id,
      };
      console.log("[Wally] 🔴 Sending leave signal to Wally-Tower:", leaveSignal);
      ws.send(JSON.stringify(leaveSignal));
    } else {
      console.log("[Wally] ⚠️ WebSocket not open, cannot send leave signal.");
    }

    await interaction.reply({ content: "🛑 Wally has stopped and notified his tower.", ephemeral: true });
  }
});

client.login(TOKEN);
