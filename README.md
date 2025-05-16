#  Batman, Starfire & Robin (Prototype)   - Discord Voice Relay Bot System

This is a multi-bot voice system for Discord built with `discord.js` and `@discordjs/voice`. It includes:

- **Batman**: Captures audio from everyone in a voice channel and sends it over a WebSocket.
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

## Upgrade Version:


- **Batman**: Captures audio from everyone in a voice channel and sends it over a WebSocket.
- Instead of having  **Robin** (1-5): Listens on WebSocket and plays audio into a different voice channel. I have a tower(replay-bot) correspondence with each record-bot when started.
-  **Starfire**: Captures **only the voice** of the user who triggered the `/starfire` command and streams it via WebSocket. when Starfire starts it will also start the starfire-Tower in the same channel. The tower is a replay bot that relays all other bots' communication.
-  Each bot has a pop-up message that can mute/unmute for 2 ways of communication. 

## Current Challenge: 

- 2 bots talking at the same time, we have no issue - all other 10 bots can replay the message with no delay and lag. However, if 3 bots are talking at the same time. It floated the WebSocket and voice started to lag.
- To mitigate this, we can only have 2 main shot-callers. The rest of the bots need to ensure it is muted if they are not the main shot-caller.

## How to run:

- You need your own bots with the token in the .env file. change the codes as needed mostly it just the bot application ID, Tokens, and Guild ID. 
- Run the central websocket - `node .\Websockets\centralWebsocket.js`
- Run the bots `npm run start:all`
- You need to register the slash command for running the bot. 
