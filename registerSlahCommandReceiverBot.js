const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();
const TOKEN = "MTM2MTg1OTMwOTk2ODk1MzQ5MA.GxaG2G.afb5VFOjbviGpO3AgmhfF8lsHU6Tv9GsmweEoQ";
const commands = [
  new SlashCommandBuilder().setName("insideman").setDescription("Receiver bot: capture audio from your current voice channel."),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// Replace with your bot's app ID and server ID:
const CLIENT_ID = "MTM2MTg1OTMwOTk2ODk1MzQ5MA.GxaG2G.afb5VFOjbviGpO3AgmhfF8lsHU6Tv9GsmweEoQ";
const GUILD_ID = "853384666454294539";

rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
  .then(() => console.log("✅ Slash commands registered."))
  .catch(console.error);
