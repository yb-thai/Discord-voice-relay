#  Batman & Robin &  Starfire - Discord Voice Relay Bot System

This is a multi-bot voice system for Discord built with `discord.js` and `@discordjs/voice`. It includes:

- **Batman**: Captures audio from everyone in a voice channel and sends it over WebSocket.
- **Robin** (1-5): Listens on WebSocket and plays audio into a different voice channel.
- **Starfire**: Captures **only the voice** of the user who triggered the `/starfire` command and streams it via WebSocket.

---

## 🔧 Features

| Bot      | Role                           | Description |
|----------|--------------------------------|-------------|
|  Batman   | Audio Capture Bot             | Captures **all users** in a channel and streams PCM audio via WebSocket. |
|  Robin   | Audio Playback Bot (1-5)       | Receives audio from WebSocket and plays into a voice channel. Multiple Robins can run in parallel. |
|  Starfire | Private Audio Capture Bot     | Captures **only the voice** of the user who triggered the slash command and sends PCM audio via WebSocket. |

---

## Next Plan:

1. Possible we can have designated party creatred in discord. To simply running the bot can initaite Robin in each party with one prompt command.
2. Possible add one propmt to stop all bot - ie. /stop-all.
3. Brute-force multiply Private Audio Capture Bots - to enable multiple users streaming to robin for additional shotcall input. 

