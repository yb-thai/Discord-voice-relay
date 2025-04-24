require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { joinVoiceChannel, EndBehaviorType, getVoiceConnection } = require("@discordjs/voice");
const prism = require("prism-media");
const AudioMixer = require("audio-mixer");

const TOKEN = process.env.CYBORG_TOKEN;
const ws = new WebSocket("ws://localhost:8080/?from=cyborg");

ws.on("open", () => console.log("[cyborg] WebSocket connected"));
ws.on("close", () => console.log("[cyborg] WebSocket closed"));
ws.on("error", (err) => console.error("[cyborg] WebSocket error:", err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let cyborgConnection = null;
let mixer = null;
let isMuted = true;

client.once("ready", () => {
  console.log("🤖 cyborg is ready. Use /cyborg to stream your voice.");
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
        .setLabel("🔇 Mute Cyborg")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute Cyborg")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.update({
      content: `🤖 Cyborg is ${isMuted ? "muted" : "unmuted"} — toggle below:`,
      components: [row],
    });
    return;
  }

  // START
  if (interaction.commandName === "cyborg") {
    const voiceChannel = interaction.member.voice.channel;
    const userId = interaction.user.id;

    if (!voiceChannel) {
      await interaction.reply({ content: "❌ Join a voice channel first.", ephemeral: true });
      return;
    }

    if (cyborgConnection) {
      await interaction.reply({ content: "ℹ️ Cyborg is already listening.", ephemeral: true });
      return;
    }

    cyborgConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    //  Signal Cyborg-Tower to join
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "join-cyborg-tower",
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
        ws.send(JSON.stringify({ from: "cyborg", audio: chunk.toString("base64") }));
      }
    });

    cyborgConnection.receiver.speaking.on("start", (speakingUserId) => {
      if (isMuted || speakingUserId !== userId) return;

      const opusStream = cyborgConnection.receiver.subscribe(speakingUserId, {
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
        .setLabel("🔇 Mute Cyborg")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute Cyborg")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `🤖 Cyborg has joined and is listening to **only you**.\nUse the buttons below to mute/unmute.`,
      components: [row],
      ephemeral: true,
    });
  }

  // STOP
  if (interaction.commandName === "stop-cyborg") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      connection.destroy();
      cyborgConnection = null;
    }
  
    //  Notify Cyborg-Tower to disconnect
    if (ws.readyState === WebSocket.OPEN) {
      const leaveSignal = {
        type: "leave-cyborg-tower",
        guildId: interaction.guild.id,
      };
  
      console.log("[Cyborg] 🔴 Sending leave signal to Cyborg-Tower:", leaveSignal);
      ws.send(JSON.stringify(leaveSignal));
    } else {
      console.log("[Cyborg] ⚠️ WebSocket not open, cannot send leave signal.");
    }
  
    await interaction.reply({ content: "🛑 Cyborg has left and notified his tower.", ephemeral: true });
  }
});

client.login(TOKEN);
