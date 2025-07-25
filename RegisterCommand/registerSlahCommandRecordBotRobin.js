const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();
const TOKEN = (process.env.ROBIN_TOKEN);
const commands = [
  new SlashCommandBuilder().setName("robin").setDescription("Receiver bot: capture audio from your current voice channel."),
  new SlashCommandBuilder().setName("stop-robin").setDescription("Stop receiver bot and leave the channel."),
  // plug in help page here
  new SlashCommandBuilder().setName("titans").setDescription("Help page"),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// Replace with your bot's app ID and server ID:
const CLIENT_ID = (process.env.CLIENT_ROBIN_ID);
const GUILD_ID = (process.env.GUILD_ID_HOLY);

rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
  .then(() => console.log("✅ Slash commands registered."))
  .catch(console.error);
