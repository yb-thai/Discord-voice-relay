require("dotenv").config();
const WebSocket = require("ws");
const { Client, GatewayIntentBits, Events } = require("discord.js");
const { joinVoiceChannel, EndBehaviorType, getVoiceConnection } = require("@discordjs/voice");
const prism = require("prism-media");
const AudioMixer = require("audio-mixer");

const TOKEN = process.env.BATMAN_TOKEN;
const BOT_LOG_CHANNEL_ID = process.env.BOT_LOG_CHANNEL_ID;

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => console.log("[Batman] WebSocket connected"));
ws.on("close", () => console.log("[Batman] WebSocket closed"));
ws.on("error", (err) => console.error("[Batman] WebSocket error:", err));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let batmanConnection = null;
let mixer = null;

client.once("ready", () => {
  console.log("🎙️ Batman (Recorder bot) ready. Use /batman to start capturing audio.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "batman") {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: "❌ You must be in a voice channel to use this command.", ephemeral: true });
      return;
    }

    if (batmanConnection) {
      await interaction.reply({ content: "ℹ️ Batman is already capturing audio.", ephemeral: true });
      return;
    }

    batmanConnection = joinVoiceChannel({
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

    batmanConnection.receiver.speaking.on("start", (userId) => {
      console.log(`User ${userId} started speaking`);

      const opusStream = batmanConnection.receiver.subscribe(userId, {
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

    await interaction.reply({ content: `🛰️ Batman joined ${voiceChannel.name} and started spying on the mission.`, ephemeral: true });
  }

  if (interaction.commandName === "stop-batman") {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      connection.destroy();
      batmanConnection = null;
      mixer = null;
      await interaction.reply({ content: "🛑 Batman has left the mission channel.", ephemeral: true });
    } else {
      await interaction.reply({ content: "⚠️ Batman is not currently in a voice channel.", ephemeral: true });
    }
  }

  if (interaction.commandName === "batman-help") {
    await interaction.reply({
      ephemeral: true,
      content: `
📖 **Batman/Robin Voice Relay Bot Guide**

🔁 Use this to stream audio between Voice channel!
⚠️ Don't test break it - I build this from scratch only fix a few edge cases 😂. 

### 🎙️ For Sending Audio (Batman Bot):
\`/batman\` — Joins your channel and starts capturing voice should be the main channel.
\`/stop-batman\` — Makes Batman leave the channel.

### 🔊 For Listening (Robin Bots):
\`/robin-1\` — Joins your voice channel and plays audio.
\`/stop-robin-1\` — Makes Robin-1 leave the channel.

(Repeat for \`robin-2\`, etc.)

### ℹ️ Notes:
- The bots will start in the voice channel that the user currently in when prompted. 
- Batman will need to run in the Main voice channel for distribute the communication.
- Make sure both bots are running and connected to different voice channel. Otherwise you will hear ehco. 
- Only audio from Batman is transmitted.
- Robin can only listening and replay the communication from Batman. Robin currently cannot talk to batman. Maybe I add this in the future. Too much work at hand.
- Start Batman first, then the rest of the party can start Robins in each Party voice channel.
- I'm still working on hosting this bot server. For testing at the moment I host the server on my pc. So if we see the bot not responding message - I don't have the server running.

🛠️ Need help? or maybe feature request ping @whiskey.
      `,
    });
  }
});

client.login(TOKEN);
