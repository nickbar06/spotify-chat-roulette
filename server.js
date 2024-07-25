require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');
const CircularBuffer = require('./CircularBuffer');
const {authenticateSocket} = require("./middleware/authMiddleware")

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: "http://localhost:4200",
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
    }
});

// Add body-parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: 'http://localhost:4200',
    credentials: true
}));

const spotifyApi = new (require('spotify-web-api-node'))({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

const messageBuffers = {};

async function refreshAccessToken(refreshToken) {
    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: process.env.SPOTIFY_CLIENT_ID,
            client_secret: process.env.SPOTIFY_CLIENT_SECRET
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = response.data.access_token;
        spotifyApi.setAccessToken(accessToken);
        console.log('Access token refreshed');
        return accessToken;
    } catch (error) {
        console.error('Error refreshing access token', error);
        throw new Error('Error refreshing access token');
    }
}

async function authenticateUser(accessToken) {
    spotifyApi.setAccessToken(accessToken);
    try {
        const me = await spotifyApi.getMe();
        return me.body;
    } catch (error) {
        throw new Error('Authentication error: ' + error.message);
    }
}

async function getCurrentPlayback() {
    try {
        const currentPlayback = await spotifyApi.getMyCurrentPlaybackState();
        return currentPlayback.body;
    } catch (error) {
        throw new Error('Error getting current playback: ' + error.message);
    }
}

function setupSocketListeners(socket) {
    console.log("Setting up socket listeners");

    socket.on('get_current_song', async (artistName) => {
        try {
            if (artistName) {
                socket.join(artistName);
                socket.room = artistName;
                console.log(`User ${socket.user.display_name} joined room: ${artistName}`);
            } else {
                const currentPlayback = await getCurrentPlayback(socket.user.accessToken);
                const artistName = currentPlayback.item.artists[0].name;
                socket.join(artistName);
                socket.room = artistName;
                console.log(`User ${socket.user.display_name} joined room: ${artistName}`);
            }

            if (!messageBuffers[artistName]) {
                messageBuffers[artistName] = new CircularBuffer(100);
            }

            const last100Messages = messageBuffers[artistName].getAll();
            console.log(`Last 100 messages for room ${artistName}:`, last100Messages);
            last100Messages.forEach((msg) => {
                socket.emit('chat_message', msg);
            });

            io.to(artistName).emit('new_user', `${socket.user.display_name} joined ${artistName} chat`);

            socket.on('disconnect', () => {
                console.log('Client disconnected');
                io.to(artistName).emit('user_left', `${socket.user.display_name} left ${artistName} chat`);
            });

            socket.on('chat_message', (payload) => {
                console.log(`Message received from ${socket.user.display_name}: ${payload.message}`);
                const userMessage = {
                    user: socket.user.display_name,
                    message: payload.message
                };

                messageBuffers[artistName].add(userMessage);
                console.log(`Updated message buffer for room ${artistName}:`, messageBuffers[artistName].getAll());

                io.to(artistName).emit('chat_message', userMessage);
            });
        } catch (error) {
            console.error('Error getting current song', error);
        }
    });
}
app.get('/login', (req, res) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
    const scopes = 'user-read-playback-state user-read-currently-playing';
    const authorizeURL = `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    res.json(authorizeURL);
});

app.get('/callback', async (req, res) => {
    console.log('Callback route hit');
    const code = req.query.code || null;
    console.log('Authorization code:', req.query.code);

    if (!code) {
        res.redirect('/#/error/invalid_code');
        return;
    }

    try {
        // Log the request being made
        console.log('Making token exchange request with the following parameters:');
        console.log('Grant type: authorization_code');
        console.log('Code:', code);
        console.log('Redirect URI:', process.env.SPOTIFY_REDIRECT_URI);
        console.log('Client ID:', process.env.SPOTIFY_CLIENT_ID);
        console.log('Client Secret:', process.env.SPOTIFY_CLIENT_SECRET);

        const data = await spotifyApi.authorizationCodeGrant(code);
        const { access_token, refresh_token } = data.body;

        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);

        console.log('Access Token:', access_token);
        console.log('Refresh Token:', refresh_token);

        const user = await authenticateUser(access_token);
        const userId = user.id;

        global.users = global.users || {};
        global.users[userId] = { accessToken: access_token, refreshToken: refresh_token, userInfo: user };

        res.redirect(`http://localhost:4200/callback?userId=${userId}`);
    } catch (error) {
        console.error('Error during Spotify authorization:', error);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        res.redirect('/#/error/invalid_token');
    }
});

app.get('/refresh-token', async (req, res) => {
    const refreshToken = req.query.refresh_token;
    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
    }

    try {
        const accessToken = await refreshAccessToken(refreshToken);
        res.json({ accessToken });
    } catch (error) {
        res.status(500).json({ error: 'Failed to refresh access token' });
    }
});

io.use(authenticateSocket);

io.on('connection', (socket) => {
    console.log('A user connected:', socket.user.display_name);
    setupSocketListeners(socket);
});

const PORT = process.env.PORT || 4000;
const startServer = () => {
    return server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();

module.exports = { authenticateUser, getCurrentPlayback, setupSocketListeners, refreshAccessToken, startServer, server };
