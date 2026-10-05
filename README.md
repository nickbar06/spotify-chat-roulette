# Spotify Chat Roulette

A local-first portfolio prototype that places Spotify listeners in a live chat room for the artist they are currently playing. When the primary artist changes, Socket.IO moves the listener to the new room automatically.

## What is included

- Vue 3 + TypeScript interface inspired by Spotify's desktop layout
- Spotify OAuth with server-side sessions and automatic token refresh
- Playlists, saved tracks/albums, and followed artists in the library
- Live playback state and Web API playback controls
- Spotify Web Playback SDK device for Premium accounts
- Artist-specific chat with the last 100 in-memory messages per room
- Seeded, clearly labeled demo listeners and active rooms for presentations
- Clickable listener profiles and a browser-local friends list
- Responsive chat drawer and mobile player

## Local setup

1. Create a Web API app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add this exact redirect URI to the app:

   ```text
   http://127.0.0.1:4000/callback
   ```

3. In Development Mode, add each Spotify account that will test the project to the app's user allowlist.
4. Copy the environment template and add your app credentials:

   ```bash
   cp .env.example .env
   ```

5. Install dependencies and run both applications:

   ```bash
   npm install
   npm install --prefix client
   npm run dev
   ```

6. Open [http://127.0.0.1:4200](http://127.0.0.1:4200).

Use `127.0.0.1` consistently. Spotify does not accept `localhost` as a new local redirect URI, and changing hostnames prevents the browser session cookie from being shared.

## Commands

```bash
npm run dev          # API on :4000 and Vue on :4200
npm run build        # Type-check and build the client
npm start            # Serve the API and a previously built client
npm test             # Run backend tests
```

## Playback behavior

The account-wide player state comes from Spotify's Web API. Progress is animated locally between updates. The browser player is powered by Spotify's Web Playback SDK; select **Listen here** in the bottom bar to transfer playback to it.

The Web Playback SDK requires Spotify Premium. If it cannot initialize, playback information and controls for an existing Spotify device remain available.

Paused tracks remain in their artist room. If nothing is playing or the current item has no Spotify artist, the listener moves to **The Lobby**.

## Presentation mode

The chat directory always includes several seeded artist rooms with labeled demo bots, recent messages, and participant counts. Open **Active chats** in the right column to browse one. While browsing, automatic artist routing pauses; choose **Back to my artist** to resume following your Spotify playback.

Select any demo listener's avatar or name to open their profile in the center column. Friend connections are stored in browser `localStorage` and do not modify Spotify account data.

## Project structure

```text
client/              Vue interface and Web Playback SDK integration
lib/routes.js        OAuth, library, playback, and control endpoints
lib/socket.js        Playback polling and artist-room chat
lib/spotify.js       Per-session Spotify clients and response normalization
server.js            Express, session, Socket.IO, and production client host
```

Chat history and sessions use process memory for this local demo and reset when the server restarts. A deployed version should use persistent session and message stores.

## Spotify attribution

Spotify metadata and artwork are displayed unchanged and link back to Spotify. This project is an independent prototype and is not endorsed by Spotify.
