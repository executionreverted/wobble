// backend.mjs - Modified to fix UserBase initialization issue

import RPC from 'bare-rpc'
import fs from 'bare-fs'
import Corestore from 'corestore'
import bip39 from "bip39"
import b4a from "b4a"
import crypto from "bare-crypto"
import Hypercore from 'hypercore'
import Hyperblobs from 'hyperblobs'
const { IPC } = BareKit
import UserBase from './userbase/userbase.mjs'
import RoomBase from './roombase/roombase.mjs'

const path =
  Bare.argv[0] === 'android'
    ? '/data/data/to.holepunch.bare.expo/autopass-example'
    : './tmp/autopass-example/'
const userBasePath = path + 'userbase/'
const roomBasePath = path + 'roombase/'

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

// Utility function to generate a UUID since crypto.randomUUID might not be available
function generateUUID() {
  // Create random bytes
  const randomBytes = crypto.randomBytes(16);

  // Set version bits (Version 4 = random UUID)
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40; // Version 4
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80; // Variant

  // Convert to hex string with dashes
  const hexString = b4a.toString(randomBytes, 'hex');
  return [
    hexString.substring(0, 8),
    hexString.substring(8, 12),
    hexString.substring(12, 16),
    hexString.substring(16, 20),
    hexString.substring(20, 32)
  ].join('-');
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
      const req = rpc.request('userCheckResult')
      req.send(JSON.stringify({ exists: false }))
      return
    }

    // If userBase already initialized, use it
    if (userBase) {
      await userBase.ready()
      const userData = await userBase.getUserData()
      const req = rpc.request('userCheckResult')
      req.send(JSON.stringify({ exists: true, user: userData }))
      return
    }

    // Otherwise, initialize corestore and userbase
    try {
      userCorestore = new Corestore(userBasePath)
      await userCorestore.ready()

      userBase = new UserBase(userCorestore)
      await userBase.ready()

      const userData = await userBase.getUserData()
      const req = rpc.request('userCheckResult')
      req.send(JSON.stringify({ exists: true, user: userData }))
    } catch (err) {
      console.error('Error loading existing user:', err)
      const req = rpc.request('userCheckResult')
      req.send(JSON.stringify({
        exists: false,
        error: err.message || 'Failed to load user data'
      }))
    }
  } catch (error) {
    console.error('Error in checkExistingUser:', error)
    const req = rpc.request('userCheckResult')
    req.send(JSON.stringify({
      exists: false,
      error: error.message || 'Unknown error checking user'
    }))
  }
}

/************************* 
 * ROOM RELATED FUNCTIONS
 *************************/

// Create a new room
const createRoom = async (roomData) => {
  try {
    // First ensure UserBase is initialized
    const ub = await initializeUserBase();
    if (!ub) {
      throw new Error('UserBase not initialized');
    }

    await ub.ready();
    const user = await ub.getUserData();

    // Generate a unique room ID using our utility function
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

    // Create room object for response
    const newRoom = {
      id: roomId,
      name: roomData.name,
      description: roomData.description || `A room created by ${user.name}`,
      createdAt: Date.now(),
      invite: invite
    };

    // Add this room to the user's rooms list
    const userRooms = Array.isArray(user.rooms) ? [...user.rooms] : [];
    userRooms.push(newRoom);

    // Update the user profile with the new rooms list
    await ub.updateUserProfile({ rooms: userRooms });

    // Get updated user data
    const updatedUser = await ub.getUserData();

    // Send updated user info back to client
    const userReq = rpc.request('userInfo');
    userReq.send(JSON.stringify(updatedUser));

    // Send room creation response
    const response = {
      success: true,
      room: newRoom
    };

    const req = rpc.request('roomCreated');
    req.send(JSON.stringify(response));

  } catch (error) {
    console.error('Error creating room:', error);
    const response = {
      success: false,
      error: error.message || 'Unknown error creating room'
    };

    const req = rpc.request('roomCreated');
    req.send(JSON.stringify(response));
  }
};

// Initialize an existing room
const initializeRoom = async (roomId) => {
  try {
    const roomDir = `${roomBasePath}/${roomId}`;

    // If the room directory doesn't exist, return
    if (!fs.existsSync(roomDir)) {
      console.log(`Room directory does not exist for room: ${roomId}`);
      return null;
    }

    // If the room is already initialized, return it
    if (roomBases[roomId]) {
      return roomBases[roomId];
    }

    // Create corestore for the room
    const roomCorestore = new Corestore(roomDir);
    await roomCorestore.ready();

    // Set up blob core and store for attachments
    const blobCore = new Hypercore(roomDir + '/blobs');
    await blobCore.ready();

    const blobStore = new Hyperblobs(blobCore);
    await blobStore.ready();

    // Create the room instance
    const room = new RoomBase(roomCorestore, {
      blobCore,
      blobStore
    });

    await room.ready();

    // Store the instances
    roomCorestores[roomId] = roomCorestore;
    roomBases[roomId] = room;

    return room;
  } catch (error) {
    console.error(`Error initializing room ${roomId}:`, error);
    return null;
  }
};

// Join a room and get messages
const joinRoom = async (roomId) => {
  try {
    // Initialize the room if needed
    let room = roomBases[roomId];
    if (!room) {
      room = await initializeRoom(roomId);
      if (!room) {
        throw new Error(`Failed to initialize room: ${roomId}`);
      }
    }

    await room.ready();

    // Get room messages
    const messageStream = room.getMessages({ limit: 50, reverse: true });
    const messages = [];

    for await (const msg of messageStream) {
      messages.push({
        id: msg.id,
        roomId: roomId,
        content: msg.content,
        sender: msg.sender,
        timestamp: msg.timestamp,
        system: msg.system || false
      });
    }

    // Send response
    const response = {
      success: true,
      roomId: roomId,
      messages: messages
    };

    const req = rpc.request('roomMessages');
    req.send(JSON.stringify(response));

  } catch (error) {
    console.error('Error joining room:', error);
    const response = {
      success: false,
      error: error.message || 'Unknown error joining room',
      roomId: roomId,
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

    // Format the message
    const message = {
      content: messageData.content,
      sender: messageData.sender,
      timestamp: messageData.timestamp || Date.now(),
      system: messageData.system || false
    };

    // Send the message
    const messageId = await room.sendMessage(message);

    // Add id to the message and send response
    message.id = messageId;
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

const teardown = async () => {
  console.log('Tearing down backend...');

  // Close all room instances
  for (const roomId in roomBases) {
    try {
      await roomBases[roomId]?.close?.();
      await roomCorestores[roomId]?.close?.();
    } catch (err) {
      console.error(`Error closing room ${roomId}:`, err);
    }
  }

  // Clear room dictionaries
  roomBases = {};
  roomCorestores = {};

  // Close user resources
  if (userBase) {
    try {
      await userBase?.close?.();
    } catch (err) {
      console.error('Error closing userBase:', err);
    }
  }

  if (userCorestore) {
    try {
      await userCorestore?.close?.();
    } catch (err) {
      console.error('Error closing userCorestore:', err);
    }
  }

  console.log('Backend teardown complete');
}

// Initialize UserBase at startup if account exists
(async () => {
  if (hasAccount()) {
    try {
      await initializeUserBase();
      console.log("UserBase initialized on startup");
    } catch (err) {
      console.error("Failed to initialize UserBase on startup:", err);
    }
  }
})();

if (!isBackendInitialized) {
  isBackendInitialized = true;
  // Send initialization complete signal
  const initReq = rpc.request('backendInitialized');
  initReq.send(JSON.stringify({ success: true }));
}
