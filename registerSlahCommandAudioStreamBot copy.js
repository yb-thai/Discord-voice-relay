const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();
const TOKEN = "MTM2MTg3ODgyNTI0NzU3MjEyOA.GTIahn._1vKKS6h5LImGtSZw2Vr06svMq6T0HDCX3GE3E";
const commands = [
  new SlashCommandBuilder().setName("outsideman").setDescription("Audio stream bot: play audio into your current voice channel."),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// Replace with your bot's app ID and server ID:
const CLIENT_ID = "MTM2MTg3ODgyNTI0NzU3MjEyOA.GTIahn._1vKKS6h5LImGtSZw2Vr06svMq6T0HDCX3GE3E";
const GUILD_ID = "853384666454294539";

rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
  .then(() => console.log("✅ Slash commands registered."))
  .catch(console.error);
