require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { joinVoiceChannel, EndBehaviorType, getVoiceConnection } = require("@discordjs/voice");
const prism = require("prism-media");
const AudioMixer = require("audio-mixer");

const TOKEN = process.env.BATMAN_TOKEN;
const ws = new WebSocket("ws://localhost:8080/?from=batman");

ws.on("open", () => console.log("[Batman] 🛜 WebSocket connected"));
ws.on("close", () => console.log("[Batman] 🔌 WebSocket disconnected"));
ws.on("error", (err) => console.error("[Batman] 🚨 WebSocket error:", err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let batmanConnection = null;
let mixer = null;
let isMuted = true;

client.once("ready", () => {
  console.log("🦇 Batman is ready. Use /batman to stream everyone's voices.");
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
        .setLabel("🔇 Mute Batman")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute Batman")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.update({
      content: `🛰️ Batman is ${isMuted ? "muted" : "unmuted"} — toggle below:`,
      components: [row],
    });
    return;
  }

  // 🦇 START Batman
  if (interaction.commandName === "batman") {
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      await interaction.reply({ content: "❌ Join a voice channel first.", ephemeral: true });
      return;
    }

    if (batmanConnection) {
      await interaction.reply({ content: "ℹ️ Batman is already listening.", ephemeral: true });
      return;
    }

    batmanConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    // 🚀 Signal Batman-Tower to join
    if (ws.readyState === WebSocket.OPEN) {
      const joinSignal = {
        type: "join-batman-tower",
        guildId: voiceChannel.guild.id,
        channelId: voiceChannel.id,
      };
      console.log("[Batman] 🚀 Sending join signal to Batman-Tower:", joinSignal);
      ws.send(JSON.stringify(joinSignal));
    } else {
      console.log("[Batman] ⚠️ WebSocket not open, cannot send join signal.");
    }

    mixer = new AudioMixer.Mixer({
      channels: 2,
      bitDepth: 16,
      sampleRate: 48000,
      clearInterval: 100,
    });

    mixer.on("data", (chunk) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ from: "batman", audio: chunk.toString("base64") }));
      }
    });

    batmanConnection.receiver.speaking.on("start", (speakingUserId) => {
      if (isMuted) return;

      const opusStream = batmanConnection.receiver.subscribe(speakingUserId, {
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
        .setLabel("🔇 Mute Batman")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute Batman")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `🛰️ Batman has joined and is recording **everyone**.\nUse the buttons below to mute/unmute.`,
      components: [row],
      ephemeral: true,
    });
  }

  // 🛑 STOP Batman
  if (interaction.commandName === "stop-batman") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      connection.destroy();
      batmanConnection = null;
    }

    // 🚨 Notify Batman-Tower to disconnect
    if (ws.readyState === WebSocket.OPEN) {
      const leaveSignal = {
        type: "leave-batman-tower",
        guildId: interaction.guild.id,
      };
      console.log("[Batman] 🔴 Sending leave signal to Batman-Tower:", leaveSignal);
      ws.send(JSON.stringify(leaveSignal));
    } else {
      console.log("[Batman] ⚠️ WebSocket not open, cannot send leave signal.");
    }

    await interaction.reply({ content: "🛑 Batman has left and notified his tower.", ephemeral: true });
  }
});

client.login(TOKEN);
