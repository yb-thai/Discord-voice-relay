require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const TOKEN = process.env.BATMAN_TOKEN;
const CLIENT_ID = process.env.CLIENT_BATMAN_ID;
const GUILD_ID = process.env.GUILD_ID_RIZZ;

const commands = [
  new SlashCommandBuilder()
    .setName("batman")
    .setDescription("🦇 Batman: Start capturing everyone's voice in the voice channel."),
  
  new SlashCommandBuilder()
    .setName("stop-batman")
    .setDescription("🛑 Batman: Stop capturing and leave the voice channel."),
]
.map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("🔵 Registering Batman slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands },
    );
    console.log("✅ Successfully registered Batman slash commands!");
  } catch (error) {
    console.error("❌ Error registering slash commands:", error);
  }
})();
