// backend.mjs - Modified to fix UserBase initialization issue

import RPC from 'bare-rpc'
import fs from 'bare-fs'
import Corestore from 'corestore'
import bip39 from "bip39"
import b4a from "b4a"
import Hypercore from 'hypercore'
import Hyperblobs from 'hyperblobs'
const { IPC } = BareKit
import UserBase from './userbase/userbase.mjs'
import RoomBase from './roombase/roombase.mjs'
import { generateUUID } from './utils.mjs'

// const path =
//   Bare.argv[0] === 'android'
//     ? '/data/data/to.holepunch.bare.expo/autopass-example'
//     : './tmp/autopass-example/'

let roomBlobStores = {};
let roomBlobCores = {};
const getDataPath = () => {
  // Get instance identifier - can be passed as a launch parameter or from env
  const instanceId = Math.ceil(Math.random() * 100)

  // Base path depends on platform
  const basePath = Bare.argv[0] === 'android'
    ? '/data/data/to.holepunch.bare.expo/autopass-example'
    : './tmp/autopass-example';

  // Append instance ID if provided
  return instanceId ? `${basePath}-${instanceId}` : basePath;
};

const path = getDataPath();
const userBasePath = path + '/userbase/'
const roomBasePath = path + '/roombase/'
let trying;
// Global variables
let userCorestore;
let userBase;
let roomBases = {};
let roomCorestores = {}

let isBackendInitialized = false;
// Create necessary directories
if (!fs.existsSync(path)) {
  fs.mkdirSync(path, { recursive: true })
}
if (!fs.existsSync(userBasePath)) {
  fs.mkdirSync(userBasePath, { recursive: true })
}
if (!fs.existsSync(roomBasePath)) {
  fs.mkdirSync(roomBasePath, { recursive: true })
}


const genSeed = () => {
  const words = []
  for (let i = 0; i < 20; i++) {
    const mnem = bip39.generateMnemonic()
    const word = mnem.split(' ')?.[0]
    words.push(word)
  }
  return words
}

const sendSeed = () => {
  const seed = genSeed()
  const req = rpc.request('seedGenerated')
  req.send(JSON.stringify(seed))
}

// Function to initialize UserBase if not already initialized
const initializeUserBase = async () => {
  try {
    // If UserBase is already initialized and ready, just return it
    if (userBase) {
      await userBase.ready();
      return userBase;
    }

    // Check if user directory exists
    if (!fs.existsSync(userBasePath)) {
      console.log('User directory does not exist');
      return null;
    }

    // Initialize corestore if not already done
    if (!userCorestore) {
      userCorestore = new Corestore(userBasePath);
      await userCorestore.ready();
    }

    // Create UserBase instance
    userBase = new UserBase(userCorestore);
    await userBase.ready();

    return userBase;
  } catch (error) {
    console.error('Error initializing UserBase:', error);
    return null;
  }
}

const rpc = new RPC(IPC, (req, error) => {
  console.log('Received RPC request:', req.command)

  if (req.command === 'teardown') {
    teardown()
  }

  // Add this to your RPC command handlers:
  if (req.command === 'reinitialize') {
    console.info('REINIT')
    reinitializeBackend();
  }

  if (req.command === 'generateSeed') {
    sendSeed()
  }

  if (req.command === 'checkUserExists') {
    checkExistingUser()
  }

  if (req.command === 'confirmSeed') {
    const data = b4a.toString(req.data)
    const parsedData = JSON.parse(data)
    createNewAccount(parsedData)
  }

  if (req.command === 'updateUserProfile') {
    const data = b4a.toString(req.data)
    const parsedData = JSON.parse(data)
    updateUserProfile(parsedData)
  }

  // Room-related commands
  if (req.command === 'createRoom') {
    const data = b4a.toString(req.data)
    const parsedData = JSON.parse(data)
    createRoom(parsedData)
  }

  // Add this to the RPC handler in backend.mjs
  if (req.command === 'joinRoomByInvite') {
    const data = b4a.toString(req.data);
    const parsedData = JSON.parse(data);
    joinRoomByInvite(parsedData);
  }

  if (req.command === 'getRooms') {
    getRooms()
  }

  if (req.command === 'joinRoom') {
    const data = b4a.toString(req.data)
    const parsedData = JSON.parse(data)
    joinRoom(parsedData.roomId)
  }

  if (req.command === 'leaveRoom') {
    const data = b4a.toString(req.data)
    const parsedData = JSON.parse(data)
    leaveRoom(parsedData.roomId)
  }

  if (req.command === 'sendMessage') {
    const data = b4a.toString(req.data)
    const parsedData = JSON.parse(data)
    sendMessage(parsedData)
  }


  if (req.command === 'loadMoreMessages') {
    const data = b4a.toString(req.data);
    const parsedData = JSON.parse(data);
    loadMoreMessages(parsedData);
  }

  if (req.command === 'olderMessages') {
    try {
      const data = b4a.toString(req.data);
      const parsedData = JSON.parse(data);
      console.log('Older messages received:', parsedData);

      if (updateMessages && Array.isArray(parsedData.messages)) {
        // These are older messages, so we want to append them
        updateMessages(parsedData.messages, false);
      }
    } catch (e) {
      console.error('Error handling olderMessages:', e);
    }
  }



})

const updateUserProfile = async (profileData) => {
  try {
    // First ensure UserBase is initialized
    const ub = await initializeUserBase();
    if (!ub) {
      console.error('UserBase not initialized');
      const response = {
        success: false,
        error: 'UserBase not initialized'
      };
      const req = rpc.request('profileUpdated');
      req.send(JSON.stringify(response));
      return response;
    }

    // Update the user profile
    const result = await ub.updateUserProfile(profileData);

    if (result.success) {
      // Get updated user data
      const updatedUser = await ub.getUserData();

      // Send response back to the client
      const response = {
        success: true,
        user: updatedUser
      };
      const req = rpc.request('profileUpdated');
      req.send(JSON.stringify(response));
      return response;
    } else {
      const response = {
        success: false,
        error: result.error || 'Failed to update profile'
      };
      const req = rpc.request('profileUpdated');
      req.send(JSON.stringify(response));
      return response;
    }
  } catch (err) {
    console.error('Error updating user profile:', err);
    const response = {
      success: false,
      error: err.message || 'Unknown error updating profile'
    };
    const req = rpc.request('profileUpdated');
    req.send(JSON.stringify(response));
    return response;
  }
}

const createNewAccount = async (seed) => {
  if (userCorestore) {
    await userCorestore?.close?.()
  }
  if (userBase) return { exists: true }

  if (hasAccount()) {
    return { exists: true }
  }

  if (!seed || seed.length == 0) {
    return { invalidSeed: true }
  }

  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(userBasePath)) {
      fs.mkdirSync(userBasePath, { recursive: true })
    }

    // Initialize corestore
    userCorestore = new Corestore(userBasePath)
    await userCorestore.ready()

    // Create userbase
    userBase = new UserBase(userCorestore, { userSeed: seed })
    await userBase.ready()

    const user = await userBase.getUserData()
    const req = rpc.request('userInfo')
    req.send(JSON.stringify(user))

    // Return success with user ID
    return {
      success: true,
      user
    }
  } catch (err) {
    console.error('Error creating account:', err)
    return { success: false, error: err.message }
  }
}

const hasAccount = () => {
  return fs.existsSync(userBasePath)
}

const checkExistingUser = async () => {
  try {
    // Check if user directory exists
    if (!fs.existsSync(userBasePath)) {
      console.log('User directory does not exist, sending No User response');
      const req = rpc.request('userCheckResult');
      req.send(JSON.stringify({ exists: false }));
      return;
    }

    // Check if directory is empty
    const files = fs.readdirSync(userBasePath);
    if (files.length === 0) {
      console.log('User directory exists but is empty, sending No User response');
      const req = rpc.request('userCheckResult');
      req.send(JSON.stringify({ exists: false }));
      return;
    }

    // If userBase already initialized, use it
    if (userBase) {
      try {
        await userBase.ready();
        const userData = await userBase.getUserData();
        if (userData) {
          console.log('Found existing user data:', userData.id);
          const req = rpc.request('userCheckResult');
          req.send(JSON.stringify({ exists: true, user: userData }));
          return;
        } else {
          console.log('No user data found despite directory existing');
          const req = rpc.request('userCheckResult');
          req.send(JSON.stringify({ exists: false }));
          return;
        }
      } catch (err) {
        console.error('Error getting user data from initialized userBase:', err);
        // Fall through to re-initialization attempt
      }
    }

    // Otherwise, initialize corestore and userbase
    try {
      console.log('Initializing corestore and userbase...');
      userCorestore = new Corestore(userBasePath);
      await userCorestore.ready();

      userBase = new UserBase(userCorestore);
      await userBase.ready();

      const userData = await userBase.getUserData();

      if (userData && userData.id) {
        console.log('Successfully loaded existing user:', userData.id);
        const req = rpc.request('userCheckResult');
        req.send(JSON.stringify({ exists: true, user: userData }));
      } else {
        console.log('No valid user data found, treating as new user');
        const req = rpc.request('userCheckResult');
        req.send(JSON.stringify({ exists: false }));

        // Clean up incomplete user data
        if (userBase) {
          await userBase.close().catch(e => console.error('Error closing userBase:', e));
          userBase = null;
        }
        if (userCorestore) {
          await userCorestore.close().catch(e => console.error('Error closing userCorestore:', e));
          userCorestore = null;
        }
      }
    } catch (err) {
      console.error('Error loading existing user:', err);
      const req = rpc.request('userCheckResult');
      req.send(JSON.stringify({
        exists: false,
        error: err.message || 'Failed to load user data'
      }));

      // Clean up on error
      if (userBase) {
        await userBase.close().catch(() => { });
        userBase = null;
      }
      if (userCorestore) {
        await userCorestore.close().catch(() => { });
        userCorestore = null;
      }
    }
  } catch (error) {
    console.error('Error in checkExistingUser:', error);
    const req = rpc.request('userCheckResult');
    req.send(JSON.stringify({
      exists: false,
      error: error.message || 'Unknown error checking user'
    }));
  }
};

/************************* 
 * ROOM RELATED FUNCTIONS
 *************************/



// Replace the existing createRoom function in backend.mjs with this improved version
const createRoom = async (roomData) => {
  try {
    console.log('Creating room with data:', roomData);

    // First ensure UserBase is initialized
    const ub = await initializeUserBase();
    if (!ub) {
      console.error('UserBase not initialized');
      throw new Error('UserBase not initialized');
    }

    await ub.ready();
    const user = await ub.getUserData();

    if (!user) {
      console.error('User not found');
      throw new Error('User not found');
    }

    // Generate a unique room ID using our utility function
    const roomId = generateUUID();
    console.log(`Creating room: ${roomId} (${roomData.name})`);

    // Create room directory
    const roomDir = `${roomBasePath}/${roomId}`;
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }

    // Create corestore for the room
    const roomCorestore = new Corestore(roomDir);
    await roomCorestore.ready();

    // Set up blob core and store for attachments
    const blobCore = new Hypercore(roomDir + '/blobs');
    await blobCore.ready();

    const blobStore = new Hyperblobs(blobCore);
    await blobStore.ready();

    // Store blob references in our maps
    roomBlobCores[roomId] = blobCore;
    roomBlobStores[roomId] = blobStore;

    // Create the room
    const room = new RoomBase(roomCorestore, {
      roomId: roomId,
      roomName: roomData.name,
      blobCore,
      blobStore
    });

    await room.ready();

    // Store the room instances
    roomCorestores[roomId] = roomCorestore;
    roomBases[roomId] = room;

    // Create an invite for others to join
    const invite = await room.createInvite();
    console.log(`Created invite for room ${roomId}: ${invite.substring(0, 10)}...`);

    // Create room object for response
    const newRoom = {
      id: roomId,
      name: roomData.name,
      description: roomData.description || `A room created by ${user.name}`,
      createdAt: Date.now(),
      invite: invite,
      key: room.key.toString('hex'),
      encryptionKey: room.encryptionKey.toString('hex')
    };

    // Set up message listener
    room.on('new-message', (msg) => {
      // Format the message
      const formattedMessage = {
        id: msg.id,
        roomId: roomId,
        content: msg.content,
        sender: msg.sender,
        timestamp: msg.timestamp,
        system: msg.system || false
      };

      console.log(`New message in room ${roomId}:`, formattedMessage.id);

      // Send to client
      const req = rpc.request('newMessage');
      req.send(JSON.stringify({
        success: true,
        message: formattedMessage
      }));
    });
    room._hasMessageListener = true;

    // Add this room to the user's rooms list
    let userRooms = [];

    // Handle different formats of user.rooms
    if (user.rooms) {
      if (typeof user.rooms === 'string') {
        try {
          userRooms = JSON.parse(user.rooms);
          if (!Array.isArray(userRooms)) {
            console.error('user.rooms parsed to non-array:', userRooms);
            userRooms = [];
          }
        } catch (e) {
          console.error('Error parsing user.rooms:', e);
          userRooms = [];
        }
      } else if (Array.isArray(user.rooms)) {
        userRooms = [...user.rooms];
      }
    }

    console.log('Current user rooms:', userRooms);
    userRooms.push(newRoom);
    console.log(`Added room ${roomId} to user's rooms. Total rooms: ${userRooms.length}`);

    // Update the user profile with the new rooms list
    console.log('Updating user profile with new rooms list');
    const updatedRooms = JSON.stringify(userRooms);
    const updateResult = await ub.updateUserProfile({
      rooms: updatedRooms
    });

    if (!updateResult.success) {
      console.error('Error updating user profile:', updateResult.error);
    }

    // Get updated user data and confirm the update worked
    const updatedUser = await ub.getUserData();
    console.log('Updated user data:', updatedUser);

    // Double check rooms were saved
    let savedRooms = [];
    if (typeof updatedUser.rooms === 'string') {
      try {
        savedRooms = JSON.parse(updatedUser.rooms);
      } catch (e) {
        console.error('Error parsing updated user.rooms:', e);
      }
    } else if (Array.isArray(updatedUser.rooms)) {
      savedRooms = updatedUser.rooms;
    }

    console.log(`User now has ${savedRooms.length} rooms saved`);

    // Send updated user info back to client
    const userReq = rpc.request('userInfo');
    userReq.send(JSON.stringify(updatedUser));

    // Also send room list update
    const roomsReq = rpc.request('roomsList');
    roomsReq.send(JSON.stringify({
      success: true,
      rooms: savedRooms
    }));

    // Send room creation response
    const response = {
      success: true,
      room: newRoom
    };

    const req = rpc.request('roomCreated');
    req.send(JSON.stringify(response));
    console.log(`Room ${roomId} created successfully, response sent to client`);

    return response;
  } catch (error) {
    console.error('Error creating room:', error);
    const response = {
      success: false,
      error: error.message || 'Unknown error creating room'
    };

    const req = rpc.request('roomCreated');
    req.send(JSON.stringify(response));
    return response;
  }
};


const initializeUserRooms = async () => {
  if (!userBase) return;

  try {
    await userBase.ready();
    const userData = await userBase.getUserData();

    if (!userData.rooms || !Array.isArray(userData.rooms) || userData.rooms.length === 0) {
      console.log('No rooms to initialize');
      return;
    }

    console.log(`Initializing ${userData.rooms.length} rooms for user`);

    const initializedRooms = [];

    for (const roomData of userData.rooms) {
      try {
        // Skip if already initialized
        if (roomBases[roomData.id]) {
          initializedRooms.push(roomData.id);
          continue;
        }

        // Initialize the room
        const room = await initializeRoom(roomData);

        if (room) {
          initializedRooms.push(roomData.id);

          // Update message count if possible
          try {
            await room.getMessageCount();
          } catch (countErr) {
            console.error(`Error getting message count for room ${roomData.id}:`, countErr);
          }
        }
      } catch (roomErr) {
        console.error(`Error initializing room ${roomData.id}:`, roomErr);
      }
    }

    console.log(`Initialized ${initializedRooms.length} rooms: ${initializedRooms.join(', ')}`);
  } catch (error) {
    console.error('Error initializing user rooms:', error);
  }
};

// Initialize an existing room
const initializeRoom = async (roomData) => {
  try {
    // roomData can be either a string roomId or a room object
    const roomId = typeof roomData === 'string' ? roomData : roomData.id;
    console.log(`Initializing room: ${roomId}`);

    // If the room is already initialized, return it
    if (roomBases[roomId]) {
      console.log(`Room ${roomId} already initialized`);
      return roomBases[roomId];
    }

    const roomDir = `${roomBasePath}/${roomId}`;

    // If the room directory doesn't exist, create it
    if (!fs.existsSync(roomDir)) {
      console.log(`Room directory does not exist, creating: ${roomDir}`);
      fs.mkdirSync(roomDir, { recursive: true });
    }

    // Create corestore for the room
    const roomCorestore = new Corestore(roomDir);
    await roomCorestore.ready();

    // Set up blob core and store for attachments
    const blobCore = new Hypercore(roomDir + '/blobs');
    await blobCore.ready();

    const blobStore = new Hyperblobs(blobCore);
    await blobStore.ready();

    // Store blob references
    roomBlobCores[roomId] = blobCore;
    roomBlobStores[roomId] = blobStore;

    // Create the room instance - use stored key and encryption key if available
    let roomOptions = {
      blobCore,
      blobStore
    };

    // If we have full room data (not just an ID)
    if (typeof roomData === 'object') {
      roomOptions.roomId = roomData.id;
      roomOptions.roomName = roomData.name;

      // If we have the encryption key and room key, use them
      if (roomData.key && roomData.encryptionKey) {
        console.log(`Using stored keys for room ${roomId}`);
        roomOptions.key = Buffer.from(roomData.key, 'hex');
        roomOptions.encryptionKey = Buffer.from(roomData.encryptionKey, 'hex');
      }
    }

    // Create the room instance
    console.log(`Creating RoomBase instance for ${roomId}`, roomOptions);
    const room = new RoomBase(roomCorestore, roomOptions);
    await room.ready();
    console.log(`Room ${roomId} is ready`);

    // Set up message listener if not already set
    if (!room._hasMessageListener) {
      room.on('new-message', (msg) => {
        // Format the message
        const formattedMessage = {
          id: msg.id,
          roomId: roomId, // Make sure roomId is included
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp,
          system: msg.system || false
        };

        console.log(`New message in room ${roomId}:`, formattedMessage.id);

        // Send to client
        const req = rpc.request('newMessage');
        req.send(JSON.stringify({
          success: true,
          message: formattedMessage
        }));
      });

      room._hasMessageListener = true;
      console.log(`Message listener set up for room ${roomId}`);
    }

    // Store the instances
    roomCorestores[roomId] = roomCorestore;
    roomBases[roomId] = room;

    console.log(`Room ${roomId} initialized successfully`);
    return room;
  } catch (error) {
    console.error(`Error initializing room:`, error);
    return null;
  }
};


// Also update the getMessagesFromRoom function for better message formatting:
const getMessagesFromRoom = async (room, roomId, options = {}) => {
  const { limit = 50, reverse = true, before = null, after = null } = options;

  try {
    // Build query options
    const queryOptions = {
      limit,
      reverse
    };

    // Add timestamp filters if provided
    if (before !== null) {
      queryOptions.lt = { timestamp: before };
    }

    if (after !== null) {
      queryOptions.gt = { timestamp: after };
    }

    console.log(`Getting messages for room ${roomId} with options:`, queryOptions);

    // Get messages
    const messageStream = room.getMessages(queryOptions);
    let messages = [];

    // Handle different return types (promise vs stream)
    if (messageStream.then) {
      // It's a promise that resolves to an array
      messages = await messageStream;
    } else if (messageStream.on) {
      // It's a Node.js stream
      messages = await new Promise((resolve, reject) => {
        const results = [];
        messageStream.on('data', msg => results.push(msg));
        messageStream.on('end', () => resolve(results));
        messageStream.on('error', err => {
          console.error('Error in message stream:', err);
          resolve(results); // Resolve with partial results on error
        });
      });
    } else if (Array.isArray(messageStream)) {
      // It's already an array
      messages = messageStream;
    }

    console.log(`Retrieved ${messages.length} messages from room ${roomId}`);

    // Format messages with roomId
    const formattedMessages = messages.map(msg => ({
      id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      roomId: roomId,
      content: msg.content || "",
      sender: msg.sender || "Unknown",
      timestamp: msg.timestamp || Date.now(),
      system: msg.system || false,
      // Include attachments if present
      hasAttachments: msg.hasAttachments || false,
      attachments: msg.attachments || null
    }));

    console.log(`Formatted ${formattedMessages.length} messages with roomId ${roomId}`);
    return formattedMessages;

  } catch (error) {
    console.error('Error getting messages from room:', error);
    return [];
  }
};

// Also update the joinRoom function for better error handling:
const joinRoom = async (roomId) => {
  try {
    console.log(`Joining room: ${roomId}`);

    if (!roomId) {
      throw new Error('No roomId provided');
    }

    // Initialize the room if needed
    let room = roomBases[roomId];
    if (!room) {
      console.log(`Room ${roomId} not initialized yet, looking up room data...`);

      // Find the room data in user's rooms
      const ub = await initializeUserBase();
      if (!ub) {
        throw new Error('UserBase not initialized');
      }

      await ub.ready();
      const userData = await ub.getUserData();

      if (!userData || !userData.rooms) {
        throw new Error('User data not available or no rooms found');
      }

      // Find the room data
      let roomData = null;
      if (typeof userData.rooms === 'string') {
        try {
          const parsedRooms = JSON.parse(userData.rooms);
          roomData = parsedRooms.find(r => r.id === roomId);
        } catch (e) {
          console.error('Error parsing rooms from user data:', e);
        }
      } else if (Array.isArray(userData.rooms)) {
        roomData = userData.rooms.find(r => r.id === roomId);
      }

      if (!roomData) {
        throw new Error(`Room ${roomId} not found in user data`);
      }

      console.log(`Found room data:`, roomData);
      room = await initializeRoom(roomData);
      if (!room) {
        throw new Error(`Failed to initialize room: ${roomId}`);
      }
    }

    await room.ready();
    console.log(`Room ${roomId} is ready`);

    // Get recent messages
    const messages = await getMessagesFromRoom(room, roomId, { limit: 50 });
    console.log(`Retrieved ${messages.length} messages from room ${roomId}`);

    // Send response with messages
    const response = {
      success: true,
      roomId,
      messages
    };

    console.log(`Sending ${messages.length} messages to client for room ${roomId}`);
    const req = rpc.request('roomMessages');
    req.send(JSON.stringify(response));

  } catch (error) {
    console.error('Error joining room:', error);
    const response = {
      success: false,
      error: error.message || 'Unknown error joining room',
      roomId,
      messages: []
    };

    const req = rpc.request('roomMessages');
    req.send(JSON.stringify(response));
  }
};
// Leave a room (cleanup)
const leaveRoom = async (roomId) => {
  try {
    // Nothing to do if the room isn't initialized
    if (!roomBases[roomId]) {
      return;
    }

    // For now, we'll keep the room initialized since we might need it again
  } catch (error) {
    console.error('Error leaving room:', error);
  }
};

// Send a message to a room
const sendMessage = async (messageData) => {
  try {
    const roomId = messageData.roomId;

    // Make sure the room is initialized
    let room = roomBases[roomId];
    if (!room) {
      room = await initializeRoom(roomId);
      if (!room) {
        throw new Error(`Failed to initialize room: ${roomId}`);
      }
    }

    await room.ready();

    // Create a unique message ID if not provided
    const messageId = messageData.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Format the message
    const message = {
      id: messageId,
      content: messageData.content,
      sender: messageData.sender,
      timestamp: messageData.timestamp || Date.now(),
      system: Boolean(messageData.system), // Ensure it's a boolean
    };

    // Send the message - this will trigger the 'new-message' event we're listening for
    await room.sendMessage(message);

    // Add roomId to the message
    message.roomId = roomId;

    const response = {
      success: true,
      message: message
    };

    const req = rpc.request('newMessage');
    req.send(JSON.stringify(response));

  } catch (error) {
    console.error('Error sending message:', error);
    const response = {
      success: false,
      error: error.message || 'Unknown error sending message'
    };

    const req = rpc.request('newMessage');
    req.send(JSON.stringify(response));
  }
};


const loadMoreMessages = async (params) => {
  const { roomId, before, limit = 20 } = params;

  try {
    // Initialize the room if needed
    let room = roomBases[roomId];
    if (!room) {
      // Find the room data in user's rooms
      const ub = await initializeUserBase();
      await ub.ready();
      const userData = await ub.getUserData();

      const roomData = userData.rooms.find(r => r.id === roomId);
      if (!roomData) {
        throw new Error(`Room ${roomId} not found in user data`);
      }

      room = await initializeRoom(roomData);
      if (!room) {
        throw new Error(`Failed to initialize room: ${roomId}`);
      }
    }

    await room.ready();

    // Get older messages
    const messages = await getMessagesFromRoom(room, roomId, {
      limit,
      reverse: true,
      before
    });

    // Send response
    const response = {
      success: true,
      roomId,
      messages,
      isOlderMessages: true // Flag to indicate these are older messages
    };

    const req = rpc.request('olderMessages');
    req.send(JSON.stringify(response));

  } catch (error) {
    console.error('Error loading more messages:', error);
    const response = {
      success: false,
      error: error.message || 'Unknown error loading more messages',
      roomId,
      messages: []
    };

    const req = rpc.request('olderMessages');
    req.send(JSON.stringify(response));
  }
};



// Get all rooms the user is part of
const getRooms = async () => {
  try {
    // First ensure UserBase is initialized
    const ub = await initializeUserBase();
    if (!ub) {
      throw new Error('UserBase not initialized');
    }

    await ub.ready();
    const user = await ub.getUserData();

    let rooms = [];

    // If user has rooms data, use it
    if (user.rooms && Array.isArray(user.rooms)) {
      rooms = user.rooms;
    }

    // Initialize any rooms that aren't already loaded
    for (const room of rooms) {
      if (!roomBases[room.id]) {
        await initializeRoom(room.id);
      }
    }

    // Send response
    const response = {
      success: true,
      rooms: rooms
    };

    const req = rpc.request('roomsList');
    req.send(JSON.stringify(response));

  } catch (error) {
    console.error('Error getting rooms:', error);
    const response = {
      success: false,
      error: error.message || 'Unknown error getting rooms',
      rooms: []
    };

    const req = rpc.request('roomsList');
    req.send(JSON.stringify(response));
  }
};


// Clean up all resources properly
// In backend.mjs, replace the cleanupResources function with this robust version:

const cleanupResources = async () => {
  console.log('Cleaning up all resources...');

  // Wrap entire cleanup in try/catch to ensure it continues even if parts fail
  try {
    // Close all room instances
    const roomIds = Object.keys(roomBases);
    console.log(`Closing ${roomIds.length} rooms...`);

    for (const roomId of roomIds) {
      try {
        // Close blob resources first
        if (roomBlobStores[roomId]) {
          console.log(`Closing blobstore for room: ${roomId}`);
          await roomBlobStores[roomId].close().catch(err => {
            console.error(`Error closing blobstore for room ${roomId}:`, err);
          });
          delete roomBlobStores[roomId];
        }

        if (roomBlobCores[roomId]) {
          console.log(`Closing blobcore for room: ${roomId}`);
          await roomBlobCores[roomId].close().catch(err => {
            console.error(`Error closing blobcore for room ${roomId}:`, err);
          });
          delete roomBlobCores[roomId];
        }

        // Then close the room instance
        if (roomBases[roomId]) {
          console.log(`Closing room: ${roomId}`);
          await roomBases[roomId].close().catch(err => {
            console.error(`Error closing room ${roomId}:`, err);
          });
          delete roomBases[roomId];
        }

        if (roomCorestores[roomId]) {
          await roomCorestores[roomId].close().catch(err => {
            console.error(`Error closing room corestore ${roomId}:`, err);
          });
          delete roomCorestores[roomId];
        }
      } catch (err) {
        console.error(`Error during room cleanup for ${roomId}:`, err);
        // Continue with other rooms even if one fails
      }
    }

    // Reset room collections
    roomBases = {};
    roomCorestores = {};
    roomBlobStores = {};
    roomBlobCores = {};

    // Close user resources with proper null checks
    if (userBase) {
      try {
        console.log('Closing userBase...');
        await userBase.close().catch(err => {
          console.error('Error closing userBase:', err);
        });
      } catch (err) {
        console.error('Error during userBase cleanup:', err);
      } finally {
        userBase = null;
      }
    }

    if (userCorestore) {
      try {
        console.log('Closing userCorestore...');
        await userCorestore.close().catch(err => {
          console.error('Error closing userCorestore:', err);
        });
      } catch (err) {
        console.error('Error during userCorestore cleanup:', err);
      } finally {
        userCorestore = null;
      }
    }

    isBackendInitialized = false;
  } catch (err) {
    console.error('Fatal error during cleanup:', err);
  }

  console.log('Resource cleanup complete');
}





const preInitializeAllRooms = async () => {
  try {
    // First check if user is initialized
    const ub = await initializeUserBase();
    if (!ub) {
      console.log('User base not initialized yet, skipping room pre-initialization');
      return;
    }

    await ub.ready();
    const userData = await ub.getUserData();

    if (!userData.rooms || !Array.isArray(userData.rooms) || userData.rooms.length === 0) {
      console.log('No rooms to pre-initialize');
      return;
    }

    console.log(`Pre-initializing ${userData.rooms.length} rooms for user`);

    // Initialize all rooms in parallel for better performance
    const promises = userData.rooms.map(async (roomData) => {
      try {
        // Skip if already initialized
        if (roomBases[roomData.id]) {
          console.log(`Room ${roomData.id} already initialized`);
          return;
        }

        // Initialize the room
        const room = await initializeRoom(roomData);

        if (room) {
          console.log(`Pre-initialized room: ${roomData.id} (${roomData.name})`);

          // Set up message listener if not already set
          if (!room._hasMessageListener) {
            room.on('new-message', (msg) => {
              // Format the message
              const formattedMessage = {
                id: msg.id,
                roomId: roomData.id,
                content: msg.content,
                sender: msg.sender,
                timestamp: msg.timestamp,
                system: msg.system || false
              };

              // Send to client
              const req = rpc.request('newMessage');
              req.send(JSON.stringify({
                success: true,
                message: formattedMessage
              }));
            });

            room._hasMessageListener = true;
            console.log(`Message listener set up for room ${roomData.id}`);
          }
        }
      } catch (error) {
        console.error(`Error pre-initializing room ${roomData.id}:`, error);
      }
    });

    await Promise.allSettled(promises);
    console.log('Pre-initialization of rooms complete');
  } catch (error) {
    console.error('Error in preInitializeAllRooms:', error);
  }
};















// Enhanced teardown function
const teardown = async () => {
  console.log('Performing teardown...');
  await cleanupResources();
  console.log('Teardown complete');
}

const reinitializeBackend = async () => {
  console.log('Reinitializing backend with room preloading...');
  if (trying) return;
  trying = true;

  try {
    // Clean up existing resources first
    await cleanupResources();

    // Add a delay to ensure resources are fully released
    await new Promise(resolve => setTimeout(resolve, 500));

    // Reinitialize user if account exists
    if (hasAccount()) {
      console.log('Reinitializing user account...');
      await initializeUserBase();

      // Pre-initialize all rooms to enable real-time updates from the start
      await preInitializeAllRooms();

      // Notify client that backend is ready
      const req = rpc.request('backendInitialized');
      req.send(JSON.stringify({ success: true }));

      // If user was initialized, also send user data
      if (userBase) {
        const userData = await userBase.getUserData();
        const userReq = rpc.request('userInfo');
        userReq.send(JSON.stringify(userData));
      }
    } else {
      console.log('No user account found');
      // Just notify that backend is ready
      const req = rpc.request('backendInitialized');
      req.send(JSON.stringify({ success: true }));
    }
  } catch (err) {
    console.error('Error reinitializing backend:', err);
    // Still notify client, but with error
    const req = rpc.request('backendInitialized');
    req.send(JSON.stringify({
      success: false,
      error: err.message || 'Failed to initialize backend'
    }));
  } finally {
    trying = false;
    isBackendInitialized = true;
    console.log('Backend reinitialization complete');
  }
};

const joinRoomByInvite = async (params) => {
  const { inviteCode } = params;

  if (!inviteCode || typeof inviteCode !== 'string') {
    const response = {
      success: false,
      error: 'Invalid invite code'
    };
    const req = rpc.request('roomJoinResult');
    req.send(JSON.stringify(response));
    return;
  }

  try {
    // First ensure UserBase is initialized
    const ub = await initializeUserBase();
    if (!ub) {
      throw new Error('UserBase not initialized');
    }

    await ub.ready();
    const user = await ub.getUserData();

    // Generate a unique room ID
    const roomId = generateUUID();

    // Create room directory
    const roomDir = `${roomBasePath}/${roomId}`;
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir, { recursive: true });
    }

    // Create corestore for the room
    const roomCorestore = new Corestore(roomDir);
    await roomCorestore.ready();

    // Set up blob core and store for attachments
    const blobCore = new Hypercore(roomDir + '/blobs');
    await blobCore.ready();

    const blobStore = new Hyperblobs(blobCore);
    await blobStore.ready();

    // Join the room using the invite code
    const room = await RoomBase.pair(roomCorestore, inviteCode, {
      blobCore,
      blobStore
    }).finished();

    await room.ready();

    // Get room info
    const roomInfo = await room.getRoomInfo();
    if (!roomInfo) {
      throw new Error('Could not get room information');
    }

    // Store the instances
    roomCorestores[roomId] = roomCorestore;
    roomBases[roomId] = room;

    // Set up message listener
    if (!room._hasMessageListener) {
      room.on('new-message', (msg) => {
        // Format the message
        const formattedMessage = {
          id: msg.id,
          roomId: roomId,
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp,
          system: msg.system || false
        };

        // Send to client
        const req = rpc.request('newMessage');
        req.send(JSON.stringify({
          success: true,
          message: formattedMessage
        }));
      });

      room._hasMessageListener = true;
    }

    // Create room object for user storage
    const newRoom = {
      id: roomId,
      name: roomInfo.name || 'Joined Room',
      description: `Joined via invite`,
      createdAt: roomInfo.createdAt || Date.now(),
      invite: inviteCode,
      key: room.key.toString('hex'),
      encryptionKey: room.encryptionKey.toString('hex')
    };

    // Add this room to the user's rooms list
    let userRooms = [];
    if (user.rooms) {
      // Parse existing rooms if it's a string
      if (typeof user.rooms === 'string') {
        try {
          userRooms = JSON.parse(user.rooms);
        } catch (e) {
          console.error('Error parsing user.rooms:', e);
          userRooms = [];
        }
      } else if (Array.isArray(user.rooms)) {
        userRooms = [...user.rooms];
      }
    }

    // Only add if not already in rooms
    if (!userRooms.some(r => r.id === roomId)) {
      userRooms.push(newRoom);

      // Update the user profile with the new rooms list
      await ub.updateUserProfile({
        rooms: JSON.stringify(userRooms)
      });
    }

    // Get updated user data
    const updatedUser = await ub.getUserData();

    // Send updated user info back to client
    const userReq = rpc.request('userInfo');
    userReq.send(JSON.stringify(updatedUser));

    // Send room join response
    const response = {
      success: true,
      room: newRoom
    };

    const req = rpc.request('roomJoinResult');
    req.send(JSON.stringify(response));

  } catch (error) {
    console.error('Error joining room by invite:', error);
    const response = {
      success: false,
      error: error.message || 'Failed to join room'
    };

    const req = rpc.request('roomJoinResult');
    req.send(JSON.stringify(response));
  }
};

// Add this line at the end of your initialization logic in backend.mjs
if (isBackendInitialized) {
  // Begin pre-loading rooms in the background for real-time updates
  preInitializeAllRooms().catch(err => {
    console.error('Error during room pre-initialization:', err);
  });
}
