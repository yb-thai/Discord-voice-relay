const { REST, Routes } = require("discord.js");
require("dotenv").config();

const TOKEN = process.env.BEASTBOY_TOWER_TOKEN;
const CLIENT_ID = process.env.CLIENT_BEASTBOY_TOWER_ID;
const GUILD_ID = process.env.GUILD_ID_MYSTICAL;

const rest = new REST({ version: "10" }).setToken(TOKEN);

rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] })
  .then(() => console.log("🧹 commands removed from guild."))
  .catch(console.error);
