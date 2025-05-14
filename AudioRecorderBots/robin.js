require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { joinVoiceChannel, EndBehaviorType, getVoiceConnection } = require("@discordjs/voice");
const prism = require("prism-media");
const AudioMixer = require("audio-mixer");

const TOKEN = process.env.ROBIN_TOKEN;
const ws = new WebSocket("ws://localhost:8080/?from=robin");

ws.on("open", () => console.log("[robin] WebSocket connected"));
ws.on("close", () => console.log("[robin] WebSocket closed"));
ws.on("error", (err) => console.error("[robin] WebSocket error:", err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let robinConnection = null;
let mixer = null;
let isMuted = true;

client.once("ready", () => {
  console.log("🦅 robin is ready. Use /robin to stream your voice.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  //  Button interaction
  if (interaction.isButton()) {
    if (interaction.customId === "mute") isMuted = true;
    if (interaction.customId === "unmute") isMuted = false;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mute")
        .setLabel("🔇 Mute Robin")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute Robin")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.update({
      content: `🦅 Robin is ${isMuted ? "muted" : "unmuted"} — toggle below:`,
      components: [row],
    });
    return;
  }

  // START
  if (interaction.commandName === "robin") {
    const voiceChannel = interaction.member.voice.channel;
    const userId = interaction.user.id;

    if (!voiceChannel) {
      await interaction.reply({ content: "❌ Join a voice channel first.", ephemeral: true });
      return;
    }

    if (robinConnection) {
      await interaction.reply({ content: "ℹ️ Robin is already listening.", ephemeral: true });
      return;
    }

    robinConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });

    // Signal Robin-Tower to join
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "join-robin-tower",
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
        ws.send(JSON.stringify({ from: "robin", audio: chunk.toString("base64") }));
      }
    });

    robinConnection.receiver.speaking.on("start", (speakingUserId) => {
      if (isMuted || speakingUserId !== userId) return;

      const opusStream = robinConnection.receiver.subscribe(speakingUserId, {
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
        .setLabel("🔇 Mute Robin")
        .setStyle(isMuted ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("unmute")
        .setLabel("🔊 Unmute Robin")
        .setStyle(!isMuted ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `🦅 Robin has joined and is listening to **only you**.\nUse the buttons below to mute/unmute.`,
      components: [row],
      ephemeral: true,
    });
  }

  const { EmbedBuilder } = require("discord.js");

if (interaction.commandName === "titans") {
  const embed = new EmbedBuilder()
    .setColor("#ff66cc")
    .setTitle("📚 Titans Voice Relay Help Guide")
    .setDescription("**Modular voice relay system built by @whiskey.**")
    .addFields(
      {
        name: "🎙️ Recorder Bots (Main Talkers)",
        value:
          "To start, Get in a Voice Channel" + "`/robin`, `/starfire`, `/raven`, `/cyborg`, `/terra`, `/jinx`, `/wally`, `/beastboy`, `/speedy`, `/bumblebee`\n" +
          "To Stop" + "`/stop-starfire`, `/stop-raven`, and so on..\n" +
          "_Each captures only the voice of the user who triggered it._",
      },
      {
        name: "🗼 Tower Bots (Listeners)",
        value:
          "Towers will Auto-join paired in voice channel on Main Talkers startup command:\n" +
          "`robin → robin-tower`\n" +
          "`starfire → starfire-tower`\n" +
          "`raven → raven-tower`\n" +
          "`cyborg → cyborg-tower`\n" +
          "`terra → terra-tower`\n" +
          "`jinx → jinx-tower`\n" +
          "`wally → wally-tower`\n" +
          "`beastboy → beastboy-tower`\n" +
          "`bumblebee → bumblebee-tower`\n" +
          "`speedy → speedy-tower`"
      },
      {
        name: "🔊 Mute/Unmute Controls",
        value:
          "• Bot will start muted. Pay attention to indicator. If not muted please mute the bot if you're not shotcalling. \n" +
          "• Toggle buttons shown in pop-up message for mute/unmute \n" 
          
      },
      {
        name: "🧠 Tips",
        value:
          "• Avoid echo by pairing each recorder with a tower in a separate VC.\n" +
          "• Towers only play audio from other recorders (never their own) to avoid echo feedback.\n" +
          "• Don't use Batman - It is for general purpose streaming everyone voices.\n" +
          "• Great for multi-party coordination in games/ops.",
      }
    )
    .setFooter({ text: "questions or feedback ping @Whiskey", iconURL: "https://cdn-icons-png.flaticon.com/512/8090/8090400.png" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}


  // STOP
  if (interaction.commandName === "stop-robin") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      connection.destroy();
      robinConnection = null;
    }
  
    // 🚨 Notify Robin-Tower to disconnect
    if (ws.readyState === WebSocket.OPEN) {
      const leaveSignal = {
        type: "leave-robin-tower",
        guildId: interaction.guild.id,
      };
  
      console.log("[Robin] 🔴 Sending leave signal to Robin-Tower:", leaveSignal);
      ws.send(JSON.stringify(leaveSignal));
    } else {
      console.log("[Robin] ⚠️ WebSocket not open, cannot send leave signal.");
    }
  
    await interaction.reply({ content: "🛑 Robin has left and notified his tower.", ephemeral: true });
  }
});

client.login(TOKEN);