const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();
const TOKEN = (process.env.BATMAN_TOKEN);
const commands = [
  new SlashCommandBuilder().setName("batman").setDescription("Receiver bot: capture audio from your current voice channel."),
  new SlashCommandBuilder().setName("stop-batman").setDescription("Stop receiver bot and leave the channel."),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// Replace with your bot's app ID and server ID:
const CLIENT_ID = "1362327265278431262";
const GUILD_ID = (process.env.GUILD_ID);

rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
  .then(() => console.log("✅ Slash commands registered."))
  .catch(console.error);
