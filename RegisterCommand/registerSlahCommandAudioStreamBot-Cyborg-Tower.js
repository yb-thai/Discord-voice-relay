const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();
const TOKEN = (process.env.ROBIN_5_TOKEN);
const commands = [
  new SlashCommandBuilder().setName("robin-5").setDescription("Audio stream bot: play audio into your current voice channel."),
  new SlashCommandBuilder().setName("stop-robin-5").setDescription("Stop stream bot and leave the channel."),

].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// Replace with your bot's app ID and server ID:
const CLIENT_ID = (process.env.CLIENT_ROBIN_5_ID);
const GUILD_ID = (process.env.GUILD_ID_DARKNESS);

rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
  .then(() => console.log("✅ Slash commands registered."))
  .catch(console.error);
