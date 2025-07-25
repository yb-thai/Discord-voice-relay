const { REST, Routes } = require("discord.js");
require("dotenv").config();

const TOKEN = process.env.RAVEN_TOWER_TOKEN;
const CLIENT_ID = process.env.CLIENT_RAVEN_TOWER_ID;
const GUILD_ID = process.env.GUILD_ID_DARKNESS;

const rest = new REST({ version: "10" }).setToken(TOKEN);

rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] })
  .then(() => console.log("🧹 commands removed from guild."))
  .catch(console.error);
