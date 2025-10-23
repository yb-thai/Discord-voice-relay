#  Titans  - Discord Voice Relay Bot System

Techincal attribute:

- Voice capture and streaming: the system uses voice connection APIs to subscribe to user audio streams (PCM/Opus frames) via Discord’s voice infrastructure.

- WebSocket audio transport layer: a central WebSocket hub is used to distribute captured audio data in real-time to multiple bots (listeners/relays).

- Multi-bot architecture: there’s a “capture-bot” (e.g., “Batman”) capturing from source channel, and one or more “playback-bots” (e.g., “Robin”) that receive audio and play it into target channels.

- Slash-command triggered capture: there is a bot (e.g., “Starfire”) that triggers capture of only one user's voice and relays it in real-time.

- PCM/Opus audio frames: the raw audio stream is handled at a low level (audio packets) rather than just high-level playback; enabling features like silence-detection, user-specific streams, and custom relay logic.

- Node.js + JavaScript stack: The bots are implemented using Node.js with discord.js (for Discord API) + @discordjs/voice (for low-level voice) + WebSocket libraries for transport.

- EndBehaviour / silence detection: The system uses “end behaviour” logic to terminate subscriptions or streams after user stops speaking or silence threshold is reached.

- Guild/Channel/User IDs, voice channel lifecycle management: Joining/leaving channels, subscribing/unsubscribing, handling speaking events, cleaning up resources.

This is a multi-bot voice system for Discord built with `discord.js` and `@discordjs/voice`. It includes:

- **Batman**: Captures audio from everyone in a voice channel and sends it over a WebSocket.
- **Robin** (1-5): Listens on WebSocket and plays audio into a different voice channel.
- **Starfire**: Captures **only the voice** of the user who triggered the `/starfire` command and streams it via WebSocket.

---

## 🔧 Features

| Bot      | Role                           | Description |
|----------|--------------------------------|-------------|
|  Batman   | Audio Capture Bot             | Captures **all users** in a channel and streams PCM audio via WebSocket. |
|  (bot)-Tower   | Audio Playback Bot       | Receives audio from WebSocket and plays into a voice channel. Multiple towers can run in parallel. |
|  Starfire | Private Audio Capture Bot     | Captures **only the voice** of the user who triggered the slash command and sends PCM audio via WebSocket. |

+ Additional bots have been added to expand the more channel and more cross server communication. 

---

## Upgrade Version:


- **Batman**: Captures audio from everyone in a voice channel and sends it over a WebSocket. - Use for big meeting. 
- I have a tower(replay-bot) correspondence with each record-bot when started.
-  **Starfire**: Captures **only the voice** of the user who triggered the `/starfire` command and streams it via WebSocket. when Starfire starts it will also start the starfire-Tower in the same channel. The tower is a replay bot that relays all other bots' communication.
-  Each bot has a pop-up message that can mute/unmute for 2 ways of communication. 

## Current Challenge: 

- 2 bots talking at the same time, we have no issue - all other 10 bots can replay the message with no delay and lag. However, if 10 recorder bots are talking at the same time. It floated the WebSocket and voice started to lag.
- To mitigate this, I added multiple websockets to handle the traffic flow for recorder bots. Currently we are good with 6-7 recorder bots sending packets at the same time. 

## How to run:

- You need your own bots with the token in the .env file. change the codes as needed mostly it just the bot application ID, Tokens, and Guild ID. 
- Run the central websocket - `node .\Websockets\centralWebsocket.js`
- Run the bots `npm run start:all`
- You need to register the slash command for running the bot. 
