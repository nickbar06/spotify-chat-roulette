const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

async function authenticateUser(accessToken) {
    spotifyApi.setAccessToken(accessToken);
    try {
        const me = await spotifyApi.getMe();
        return me.body;
    } catch (error) {
        throw new Error('Authentication error: ' + error.message);
    }
}

async function authenticateSocket(socket, next) {
    const accessToken = socket.handshake.query.accessToken;
    if (!accessToken) {
        return next(new Error('Authentication error: No access token provided'));
    }

    try {
        const user = await authenticateUser(accessToken);
        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Authentication error: ' + error.message));
    }
}

module.exports = { authenticateSocket, authenticateUser };
