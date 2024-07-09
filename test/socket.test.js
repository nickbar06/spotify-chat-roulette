require('dotenv').config();
const io = require('socket.io-client');
const { startServer, stopServer } = require('../server');
const sinon = require('sinon');
const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const path = require('path');

// Load users from the JSON file
const users = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'users.json'))).users;
// Load chatroom data from the JSON file
const chatroom = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'chatroom.json')));

describe('Socket.IO Server', () => {
  let testServer;
  let clients = [];
  let chatroomClients = [];
  let currentRoom;
  let authenticateUserStub;
  let clientCredentialsGrantStub;
  let getMeStub;
  let getMyCurrentPlaybackStateStub;
  let setAccessTokenStub;
  let storedAccessToken;

  beforeAll((done) => {
    console.log('Starting server...');
    testServer = startServer();
    done();
  });

  afterAll((done) => {
    console.log('Stopping server...');
    stopServer();
    done();
  });

  beforeEach((done) => {
    console.log('Stubbing functions...');

    // Stub the authenticateUser function globally
    authenticateUserStub = sinon.stub(require('../server'), 'authenticateUser').callsFake((accessToken) => {
      console.log(`Stubbed authenticateUser called with accessToken: ${accessToken}`);
      const user = users.find(user => user.token === accessToken);
      if (user) {
        return Promise.resolve({ display_name: user.display_name });
      } else {
        return Promise.reject(new Error('Invalid token'));
      }
    });

    // Stub the clientCredentialsGrant function globally
    clientCredentialsGrantStub = sinon.stub(SpotifyWebApi.prototype, 'clientCredentialsGrant').callsFake(() => {
      console.log('Stubbed clientCredentialsGrant called');
      return Promise.resolve({
        body: {
          access_token: 'new_access_token'
        }
      });
    });

    // Stub the setAccessToken function globally
    setAccessTokenStub = sinon.stub(SpotifyWebApi.prototype, 'setAccessToken').callsFake((token) => {
      console.log(`Stubbed setAccessToken called with token: ${token}`);
      storedAccessToken = token;
    });

    // Stub the getMe function globally
    getMeStub = sinon.stub(SpotifyWebApi.prototype, 'getMe').callsFake(() => {
      console.log(`Stubbed getMe called with storedAccessToken: ${storedAccessToken}`);
      const user = users.find(user => user.token === storedAccessToken);
      if (user) {
        return Promise.resolve({
          body: {
            display_name: user.display_name
          }
        });
      } else {
        return Promise.reject(new Error('Invalid token'));
      }
    });

    // Stub the getMyCurrentPlaybackState function globally
    getMyCurrentPlaybackStateStub = sinon.stub(SpotifyWebApi.prototype, 'getMyCurrentPlaybackState').callsFake(() => {
      console.log('Stubbed getMyCurrentPlaybackState called');
      return Promise.resolve({
        body: {
          item: {
            artists: [{ name: currentRoom }]
          }
        }
      });
    });

    // Connect clients
    console.log('Connecting clients...');
    clients = [
      io('http://localhost:4000'),
      io('http://localhost:4000'),
      io('http://localhost:4000'),
      io('http://localhost:4000')
    ];

    // Wait for clients to connect
    let connectCount = 0;
    clients.forEach(client => {
      client.on('connect', () => {
        console.log('Client connected');
        connectCount += 1;
        if (connectCount === clients.length) done();
      });
    });
  });

  afterEach((done) => {
    console.log('Restoring stubs and disconnecting clients...');
    // Restore the original functions
    authenticateUserStub.restore();
    clientCredentialsGrantStub.restore();
    setAccessTokenStub.restore();
    getMeStub.restore();
    getMyCurrentPlaybackStateStub.restore();

    // Disconnect clients
    let disconnectCount = 0;
    clients.forEach(client => {
      if (client.connected) {
        client.on('disconnect', () => {
          console.log('Client disconnected');
          disconnectCount += 1;
          if (disconnectCount === clients.length) done();
        });
        client.disconnect();
      } else {
        disconnectCount += 1;
        if (disconnectCount === clients.length) done();
      }
    });
  });

  test('should allow both users to see each other’s messages in the same room', (done) => {
    currentRoom = 'artist1';
    const messageA = { user: 'user_A', message: 'hello' };
    const messageB = { user: 'user_B', message: 'world' };

    let receivedMessagesA = [];
    let receivedMessagesB = [];

    clients[0].on('authenticated', () => {
      console.log('Client A authenticated');
      clients[0].emit('get_current_song', currentRoom);
    });

    clients[1].on('authenticated', () => {
      console.log('Client B authenticated');
      clients[1].emit('get_current_song', currentRoom);
    });

    clients[0].on('new_user', (message) => {
      console.log('Client A new_user:', message);
    });

    clients[1].on('new_user', (message) => {
      console.log('Client B new_user:', message);
    });

    clients[0].on('chat_message', (message) => {
      console.log('Client A received message:', message);
      receivedMessagesA.push(message);
      if (receivedMessagesA.length === 2 && receivedMessagesB.length === 2) {
        expect(receivedMessagesA).toEqual(expect.arrayContaining([messageA, messageB]));
        expect(receivedMessagesB).toEqual(expect.arrayContaining([messageA, messageB]));
        done();
      }
    });

    clients[1].on('chat_message', (message) => {
      console.log('Client B received message:', message);
      receivedMessagesB.push(message);
      if (receivedMessagesA.length === 2 && receivedMessagesB.length === 2) {
        expect(receivedMessagesA).toEqual(expect.arrayContaining([messageA, messageB]));
        expect(receivedMessagesB).toEqual(expect.arrayContaining([messageA, messageB]));
        done();
      }
    });

    setTimeout(() => {
      console.log('Sending messages');
      clients[0].emit('chat_message', messageA);
      clients[1].emit('chat_message', messageB);
    }, 1000);

    clients[0].emit('authenticate', users.find(user => user.display_name === 'user_A').token);
    clients[1].emit('authenticate', users.find(user => user.display_name === 'user_B').token);
  }, 30000);  
  
  test('should not allow users to see each other’s messages in different rooms', (done) => {
    const messageA = { user: 'user_A', message: 'hello' };
    const messageB = { user: 'user_B', message: 'world' };

    let receivedMessagesA = [];
    let receivedMessagesB = [];

    clients[0].on('authenticated', () => {
      console.log('Client A authenticated');
      clients[0].emit('get_current_song', 'artist1');
    });

    clients[1].on('authenticated', () => {
      console.log('Client B authenticated');
      clients[1].emit('get_current_song', 'artist2');
    });

    clients[0].on('new_user', (message) => {
      console.log('Client A new_user:', message);
    });

    clients[1].on('new_user', (message) => {
      console.log('Client B new_user:', message);
    });

    clients[0].on('chat_message', (message) => {
      console.log('Client A received message:', message);
      receivedMessagesA.push(message);
      if (receivedMessagesA.length === 1 && receivedMessagesB.length === 1) {
        expect(receivedMessagesA).toEqual(expect.arrayContaining([messageA]));
        expect(receivedMessagesB).toEqual(expect.arrayContaining([messageB]));
        done();
      }
    });

    clients[1].on('chat_message', (message) => {
      console.log('Client B received message:', message);
      receivedMessagesB.push(message);
      if (receivedMessagesA.length === 1 && receivedMessagesB.length === 1) {
        expect(receivedMessagesA).toEqual(expect.arrayContaining([messageA]));
        expect(receivedMessagesB).toEqual(expect.arrayContaining([messageB]));
        done();
      }
    });

    setTimeout(() => {
      console.log('Sending messages');
      clients[0].emit('chat_message', messageA);
      clients[1].emit('chat_message', messageB);
    }, 1000);

    clients[0].emit('authenticate', users.find(user => user.display_name === 'user_A').token);
    clients[1].emit('authenticate', users.find(user => user.display_name === 'user_B').token);
  }, 30000); // Increased timeout to 30000 ms (30 seconds)


  test('should allow a new user to see all messages in room "ADTR"', (done) => {
    currentRoom = chatroom.chatroomName;
    const initialMessages = chatroom.messages.map(msg => ({
      user: msg.display_name,
      message: msg.message
    }));

    let receivedMessages = [];

    // Create socket connections for all users in chatroom.json
    chatroomClients = chatroom.messages.reduce((acc, msg) => {
      const user = users.find(u => u.display_name === msg.display_name);
      if (user) {
        const client = io('http://localhost:4000');
        acc.push({ client, user });
      }
      return acc;
    }, []);

    // Authenticate and join the room for existing users
    let authCount = 0;
    chatroomClients.forEach(({ client, user }) => {
      client.on('authenticated', () => {
        client.emit('get_current_song', currentRoom);
        authCount += 1;
        if (authCount === chatroomClients.length) {
          // Emit initial messages after all clients are authenticated and joined
          initialMessages.forEach((msg, index) => {
            setTimeout(() => {
              const { client } = chatroomClients.find(c => c.user.display_name === msg.user);
              client.emit('chat_message', msg);
              console.log(`Message sent from ${msg.user}: ${msg.message}`);
            }, index * 100);
          });

          // Delay new user authentication to ensure all initial messages are sent
          setTimeout(() => {
            console.log('Authenticating new client');
            clients[3].emit('authenticate', users.find(user => user.display_name === 'newUser').token);
          }, 2000); // 2 seconds to ensure all initial messages are sent
        }
      });
      client.emit('authenticate', user.token);
    });

    clients[3].on('authenticated', () => {
      console.log('New Client authenticated');
      clients[3].emit('get_current_song', currentRoom);
    });

    clients[3].on('chat_message', (message) => {
      console.log('New Client received message:', message);
      receivedMessages.push(message);
      if (receivedMessages.length === initialMessages.length) {
        expect(receivedMessages).toEqual(expect.arrayContaining(initialMessages));
        done();
      }
    });

    setTimeout(() => {
      console.log('Checking if all messages were received');
      expect(receivedMessages.length).toBe(initialMessages.length);
      done();
    }, 10000); // 10 seconds to check if all messages were received
  }, 30000); // Increased timeout to 30000 ms (30 seconds)
});
