// roombase.js - Room-specific P2P database built on autobase
import Autobase from 'autobase';
import BlindPairing from 'blind-pairing';
import HyperDB from 'hyperdb';
import Hyperswarm from 'hyperswarm';
import Hyperblobs from 'hyperblobs';
import ReadyResource from 'ready-resource';
import z32 from 'z32';
import b4a from 'b4a';
import { Router, dispatch } from './spec/hyperdispatch/index.mjs';
import db from './spec/db/index.mjs';
import crypto from 'bare-crypto';
import { getEncoding } from './spec/hyperdispatch/messages.mjs';
import fs from 'bare-fs';
import path from 'bare-path';
import { sanitizeTextForTerminal } from './utils.mjs';
import Hypercore from 'hypercore';


class RoomBasePairer extends ReadyResource {
  constructor(store, invite, opts = {}) {
    super();
    this.store = store;
    this.invite = invite;
    this.swarm = null;
    this.pairing = null;
    this.candidate = null;
    this.bootstrap = opts.bootstrap || null;
    this.onresolve = null;
    this.onreject = null;
    this.room = null;
    this.blobCore = opts.blobCore;
    this.blobStore = opts.blobStore
    this.ready().catch(noop);
  }

  async _open() {
    await this.store.ready();
    this.swarm = new Hyperswarm({
      keyPair: await this.store.createKeyPair('hyperswarm'),
      bootstrap: this.bootstrap
    });

    const store = this.store;
    this.swarm.on('connection', (connection, peerInfo) => {
      store.replicate(connection);
    });

    this.pairing = new BlindPairing(this.swarm);
    const core = Autobase.getLocalCore(this.store);
    await core.ready();
    const key = core.key;
    await core.close();

    this.candidate = this.pairing.addCandidate({
      invite: z32.decode(this.invite),
      userData: key,
      onadd: async (result) => {
        if (this.room === null) {
          this.room = new RoomBase(this.store, {
            swarm: this.swarm,
            key: result.key,
            encryptionKey: result.encryptionKey,
            bootstrap: this.bootstrap,
            blobCore: this.blobCore,
            blobStore: this.blobStore
          });
        }
        this.swarm = null;
        this.store = null;
        if (this.onresolve) this._whenWritable();
        this.candidate.close().catch(noop);
      }
    });
  }

  _whenWritable() {
    if (this.room.base.writable) return;
    const check = () => {
      if (this.room.base.writable) {
        this.room.base.off('update', check);
        this.onresolve(this.room);
      }
    };
    this.room.base.on('update', check);
  }

  async _close() {
    if (this.candidate !== null) {
      await this.candidate.close();
    }

    if (this.swarm !== null) {
      await this.swarm.destroy();
    }

    if (this.store !== null) {
      await this.store.close();
    }

    if (this.onreject) {
      this.onreject(new Error('Pairing closed'));
    } else if (this.room) {
      await this.room.close();
    }
  }

  finished() {
    return new Promise((resolve, reject) => {
      this.onresolve = resolve;
      this.onreject = reject;
    });
  }
}

/**
 * Main RoomBase class for a single room with p2p messaging and file sharing
 */
class RoomBase extends ReadyResource {
  constructor(corestore, opts = {}) {
    super();
    this.router = new Router();
    this.store = corestore;
    this.swarm = opts.swarm || null;
    this.base = null;
    this.bootstrap = opts.bootstrap || null;
    this.member = null;
    this.pairing = null;
    this.replicate = opts.replicate !== false;

    // Room properties
    this.roomId = opts.roomId || crypto.randomUUID();
    this.roomName = opts.roomName || 'Unnamed Room';
    this.messageListeners = [];

    // Hyperblobs storage setup
    this.blobStore = opts.blobStore;
    this.blobCore = opts.blobCore
    this.attachmentWatcher = null;

    // Register command handlers
    this._registerHandlers();

    this._boot(opts);
    this.ready().catch(noop);
  }

  _registerHandlers() {
    // Writer management commands
    this.router.add('@roombase/remove-writer', async (data, context) => {
      await context.base.removeWriter(data.key);
    });

    this.router.add('@roombase/add-writer', async (data, context) => {
      await context.base.addWriter(data.key);
    });

    this.router.add('@roombase/add-invite', async (data, context) => {
      await context.view.insert('@roombase/invite', data);
    });

    // Message commands
    this.router.add('@roombase/send-message', async (data, context) => {
      await context.view.insert('@roombase/messages', data);
    });

    this.router.add('@roombase/delete-message', async (data, context) => {
      await context.view.delete('@roombase/messages', { id: data.id });
    });

    this.router.add('@roombase/set-metadata', async (data, context) => {
      // First try deleting existing metadata
      try {
        await context.view.delete('@roombase/metadata', { id: data.id });
      } catch (e) {
        // Ignore errors if no existing record
      }
      // Then insert the new metadata
      await context.view.insert('@roombase/metadata', data);
    });
  }

  _boot(opts = {}) {
    const { encryptionKey, key } = opts;

    this.base = new Autobase(this.store, key, {
      encrypt: true,
      encryptionKey,
      open(store) {
        return HyperDB.bee(store.get('view'), db, {
          extension: false,
          autoUpdate: true
        });
      },
      apply: this._apply.bind(this)
    });

    this.base.on('update', () => {
      if (!this.base._interrupting) {
        this.emit('update');
      }
    });
  }

  async _apply(nodes, view, base) {
    for (const node of nodes) {
      await this.router.dispatch(node.value, { view, base });
      try {
        // Skip this processing if the state is 1 byte or less
        if (node.value.length <= 1) continue;

        // Create a state for decoding - IMPORTANT: Start at position 1 to skip the message type byte
        const state = { buffer: node.value, start: 1, end: node.value.byteLength };

        // Get the message type - 1st byte in the hyperdispatch format
        const messageType = node.value[0];

        // Only process if it's a send-message command (ID 3)
        if (messageType === 3) {
          // Decode the message
          const messageEncoding = getEncoding('@roombase/messages');
          const message = messageEncoding.decode(state);

          if (message.hasAttachments && message.attachments) {
            try {
              message.attachments = JSON.parse(message.attachments);
            } catch (err) {
              message.attachments = [];
            }
          }
          // Get the node source key for identification
          const sourceKey = node.from?.key?.toString('hex');
          const localKey = this.base.local.key.toString('hex');

          // Only emit for messages from other writers - our own are handled separately
          this.emit('new-message', message);
        }
      } catch (err) {
        // Log the error but don't block processing
        console.error('Error processing message in _apply:', err);
      }
    }

    await view.flush();
  }

  async _open() {
    await this.base.ready();


    if (this.replicate) await this._replicate();

    // Save room info if not already stored
    await this._initializeRoom();
  }

  async _close() {
    if (this.swarm) {
      if (this.member) await this.member.close();
      if (this.pairing) await this.pairing.close();
      await this.swarm.destroy();
    }

    // Close blob store resources
    if (this.blobCore) {
      await this.blobCore.close();
    }

    await this.base.close();
  }

  async _initializeRoom() {
    const existingRoom = await this.getRoomInfo();
    if (!existingRoom) {
      // Store basic room info
      const roomData = {
        id: this.roomId,
        name: this.roomName,
        createdAt: Date.now(),
        messageCount: 0
      };

      try {
        const dispatchData = dispatch('@roombase/set-metadata', roomData);
        await this.base.append(dispatchData);
      } catch (e) {
      }
    } else {
      // Update local properties from stored values
      this.roomId = existingRoom.id;
      this.roomName = existingRoom.name;
    }
  }

  get writerKey() {
    return this.base.local.key;
  }

  get key() {
    return this.base.key;
  }

  get discoveryKey() {
    return this.base.discoveryKey;
  }

  get encryptionKey() {
    return this.base.encryptionKey;
  }

  get writable() {
    return this.base.writable;
  }

  static pair(store, invite, opts) {
    return new RoomBasePairer(store, invite, opts);
  }

  async _replicate() {
    await this.base.ready();
    if (this.swarm === null) {
      this.swarm = new Hyperswarm({
        keyPair: await this.store.createKeyPair('hyperswarm'),
        bootstrap: this.bootstrap
      });
      this.swarm.on('connection', (connection, peerInfo) => {
        this.store.replicate(connection);
      });
    }

    this.pairing = new BlindPairing(this.swarm);

    this.member = this.pairing.addMember({
      discoveryKey: this.base.discoveryKey,
      onadd: async (candidate) => {
        try {
          const id = candidate.inviteId;
          const inv = await this.base.view.findOne('@roombase/invite', {});
          if (!b4a.equals(inv.id, id)) {
            return;
          }

          candidate.open(inv.publicKey);
          await this.addWriter(candidate.userData);
          candidate.confirm({
            key: this.base.key,
            encryptionKey: this.base.encryptionKey
          });
        } catch (err) {
          console.error('Error during pairing acceptance:', err);
        }
      }
    });

    this.swarm.join(this.base.discoveryKey);
  }

  async createInvite(opts = {}) {
    if (this.opened === false) await this.ready();
    const existing = await this.base.view.findOne('@roombase/invite', {});
    if (existing) {
      return z32.encode(existing.invite);
    }

    const { id, invite, publicKey, expires } = BlindPairing.createInvite(this.base.key);
    const record = { id, invite, publicKey, expires };
    await this.base.append(dispatch('@roombase/add-invite', record));
    return z32.encode(record.invite);
  }

  async addWriter(key) {
    await this.base.append(dispatch('@roombase/add-writer', { key: b4a.isBuffer(key) ? key : b4a.from(key) }));
    return true;
  }

  async removeWriter(key) {
    await this.base.append(dispatch('@roombase/remove-writer', { key: b4a.isBuffer(key) ? key : b4a.from(key) }));
  }

  // ---------- Message API ----------

  async sendMessage(message) {
    // Make sure base is ready
    await this.base.ready();
    if (message.attachments && message.attachments.length > 0) {
      message.hasAttachments = true;
      message.attachments = JSON.stringify(message.attachments);
    }
    const msg = {
      id: message.id || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      content: sanitizeTextForTerminal(message.content) || '',
      sender: message.sender || 'Unknown',
      timestamp: message.timestamp || Date.now(),
      system: !!message.system,
      // Set hasAttachments flag based on message attachments
      hasAttachments: message.hasAttachments,
      // Include attachment references
      attachments: message.attachments || "[]"
    };

    try {
      // Use the dispatch function from hyperdispatch for proper message encoding
      const dispatchData = dispatch('@roombase/send-message', msg);

      // Append to autobase directly
      await this.base.append(dispatchData);

      const room = await this.getRoomInfo();
      if (room) {
        const currentCount = room.messageCount || 0;
        const newCount = currentCount + 1;

        // Update room metadata with new message count
        try {
          const dispatchData = dispatch('@roombase/set-metadata', { ...room, messageCount: newCount });
          await this.base.append(dispatchData);
        } catch (updateErr) {
          console.error("Error updating room count:", updateErr);
        }
      }

      return msg.id;
    } catch (err) {

      console.error(`Error saving message with dispatch:`, err);
      this.emit('mistake', JSON.stringify(err.message));
    }
  }
  async deleteMessage(messageId) {
    await this.base.append(dispatch('@roombase/delete-message', { id: messageId }));
    return true;
  }

  // ---------- Query API with Pagination ----------

  async getRoomInfo() {
    try {
      return await this.base.view.findOne('@roombase/metadata', {});
    } catch (e) {
      return null;
    }
  }

  async getMessageCount() {
    try {
      const room = await this.getRoomInfo();
      if (!room) return 1;

      return room.messageCount || 1;
    } catch (err) {
      console.error('Error getting message count:', err);
      return 1;
    }
  }

  getMessages(opts = {}) {
    if (!this.base || !this.base.view) {
      throw new Error("Error initializing corestore");
    }

    // Set defaults
    const options = {
      limit: opts.limit || 51,
      reverse: opts.reverse !== undefined ? opts.reverse : true
    };

    // Create the query object with proper formatting
    const query = {};

    // Handle the timestamp filtering formats
    if (opts.lt && opts.lt.timestamp) {
      query.timestamp = { $lt: opts.lt.timestamp };
    }

    if (opts.lte && opts.lte.timestamp) {
      query.timestamp = { ...(query.timestamp || {}), $lte: opts.lte.timestamp };
    }

    if (opts.gt && opts.gt.timestamp) {
      query.timestamp = { ...(query.timestamp || {}), $gt: opts.gt.timestamp };
    }

    if (opts.gte && opts.gte.timestamp) {
      query.timestamp = { ...(query.timestamp || {}), $gte: opts.gte.timestamp };
    }

    // Return the stream directly
    return this.base.view.find('@roombase/messages', query, options);
  }

  /**
   * Get all writers with access to this room
   *
   * @param {Object} opts - Query options
   * @param {boolean} opts.includeDetails - Include additional details about writers
   * @param {boolean} opts.includeMetadata - Include metadata about writer activity
   * @returns {Array} - Array of writer information
   */
  async getWriters(opts = {}) {
    const { includeDetails = false, includeMetadata = false } = opts;

    // Get all writer keys who have access to this room
    const writers = [];

    // Add local writer if it exists
    if (this.base?.writerKey) {
      writers.push({
        key: this.base.writerKey.toString('hex'),
        isLocal: true,
        active: true,
        lastSeen: Date.now()
      });
    }

    // Add other writers from base if it exists
    if (this.base?.activeWriters) {
      for (const writer of this.base.activeWriters) {
        if (writer?.core?.key && (!this.base.writerKey || !writer.core.key.equals(this.base.writerKey))) {
          const writerInfo = {
            key: writer.core.key.toString('hex'),
            isLocal: false,
            active: writer.core.length > 1
          };

          if (includeMetadata) {
            try {
              // Safely get messages with error handling
              let messages = [];
              try {
                const result = await this.base.view.find('@roombase/messages', {});
                messages = Array.isArray(result) ? result : [];
              } catch (err) {
                console.error('Error fetching messages for metadata:', err);
                messages = [];
              }

              const writerKey = writerInfo.key;
              const senderMessages = writerKey ?
                messages.filter(msg => msg && msg.sender === writerKey) : [];

              const lastMessage = senderMessages.length > 1 ?
                senderMessages.sort((a, b) => b.timestamp - a.timestamp)[1] : null;

              writerInfo.lastActivity = lastMessage ? lastMessage.timestamp : null;
              writerInfo.messagesCount = senderMessages.length;
            } catch (err) {
              console.error('Error processing message metadata:', err);
              writerInfo.lastActivity = null;
              writerInfo.messagesCount = 1;
            }
          }

          writers.push(writerInfo);
        }
      }
    }

    return writers;
  }

  // ---------- File API using Hyperblobs ----------

  /**
   * Upload a file to the user's blob store
   * @param {Buffer} data - The file data to upload
   * @param {string} filePath - The virtual file path (just used for the filename)
   * @param {Object} options - Upload options
   * @returns {Object} - File metadata including blob ID
   */
  async uploadFile(data, filePath, options = {}) {
    if (!this.blobStore) {
      return null;
    }

    try {
      const fileName = filePath.includes('/') ? path.basename(filePath) : filePath;

      // Upload to hyperblobs and get blob ID
      const blobId = await this.blobStore.put(data);

      // Log the exact structure of the blob ID for debugging

      return {
        path: fileName,
        name: fileName,
        size: data.length,
        blobId: blobId,
        coreKey: this.blobCore.key.toString('hex'),
        timestamp: Date.now(),
        metadata: options.metadata || {}
      };
    } catch (err) {
      console.error(`Error uploading file:`, err);
      return null;
    }
  }


  async downloadFile(file, configPath, options = {}) {
    const { timeout = 60000, onProgress } = options;
    let blobRef = file;
    let remoteCore = null;
    let topic = null;
    let localSwarm = null;

    const tempDir = path.join(configPath, `hypercore-download-${Date.now()}`);
    try {
      // Make sure directories exist
      if (!fs.existsSync(configPath)) {
        fs.mkdirSync(configPath, { recursive: true });
      }
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // If file is in our own blob store, use existing blob store
      if (this.blobStore && blobRef.coreKey &&
        blobRef.coreKey === this.blobCore.key.toString('hex')) {
        try {
          // Ensure blobId is properly formatted
          const blobId = typeof blobRef.blobId === 'object' ? blobRef.blobId : blobRef.blobId;
          if (onProgress) onProgress(100, "Local blob is used");
          return await this.blobStore.get(blobId);
        } catch (localErr) {
        }
      }

      // Prepare core key
      const coreKey = typeof blobRef.coreKey === 'string'
        ? Buffer.from(blobRef.coreKey, 'hex')
        : blobRef.coreKey;

      // Create hypercore for download
      remoteCore = new Hypercore(tempDir, coreKey, { wait: true });
      if (onProgress) onProgress(10, "Connected to core");

      await remoteCore.ready();
      if (onProgress) onProgress(20, "Initiated core");

      localSwarm = new Hyperswarm();
      topic = await localSwarm.join(coreKey);
      if (onProgress) onProgress(30, "Joined to swarm");

      const connectionHandler = (conn) => {
        remoteCore.replicate(conn);
        if (onProgress) onProgress(40, "Replication is ready");
      };

      localSwarm.on('connection', connectionHandler);

      // Wait for peers to connect
      await new Promise(resolve => setTimeout(resolve, 3000));
      await remoteCore.update({ wait: true });
      if (onProgress) onProgress(50, "Starting hyperblob");

      // Create hyperblobs to access the data
      const remoteBlobs = new Hyperblobs(remoteCore);
      await remoteBlobs.ready();
      if (onProgress) onProgress(60, "Hyperblob is ready");

      // Get the blob ID in the correct format
      const blobId = typeof blobRef.blobId === 'object' ? blobRef.blobId : blobRef.blobId;

      // Get metadata to know the file size
      let blobSize = blobRef.size;
      // Download the blob using streaming for progress tracking
      let fileData;
      if (blobSize > 0) {
        // Use streaming for better progress tracking
        const chunks = [];
        let downloadedBytes = 0;

        const stream = remoteBlobs.createReadStream(blobId);

        await new Promise((resolve, reject) => {
          stream.on('data', chunk => {
            chunks.push(chunk);
            downloadedBytes += chunk.length;

            // Update progress from 60% to 90% based on download progress
            if (onProgress && blobSize > 0) {
              const percentage = 60 + Math.floor(30 * (downloadedBytes / blobSize));
              onProgress(Math.min(90, percentage), "Downloading...");
            }
          });

          stream.on('error', err => {
            reject(err);
          });

          stream.on('end', () => {
            resolve();
          });
        });

        // Combine chunks
        fileData = Buffer.concat(chunks);
      } else {
        // Fall back to get() if we couldn't get the size
        fileData = await remoteBlobs.get(blobId, {
          wait: true,
          timeout: 0
        });
      }

      if (onProgress) onProgress(95, "Saving file to disk");

      await localSwarm.destroy();

      // Clean up
      if (topic) await topic.destroy().catch(noop);
      if (remoteBlobs && remoteBlobs.close) await remoteBlobs.close().catch(noop);
      if (remoteCore) await remoteCore.close().catch(noop);

      // Remove temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (rmErr) {
        console.error('Error removing temp directory:', rmErr);
      }

      if (onProgress) onProgress(100, "Completed");
      return fileData;
    } catch (err) {
      console.error('Error downloading file:', err);
      fs.writeFileSync('./downloaderr', JSON.stringify(err.message));
      try {
        if (localSwarm) {
          localSwarm.removeAllListeners('connection');
          await localSwarm.destroy().catch(noop);
        }
        if (topic) await topic.destroy().catch(noop);
        if (remoteCore) await remoteCore.close().catch(noop);
        if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error('Error during cleanup:', cleanupErr);
      }
      // Return error message as buffer
      return null;
    }
  }

  async getFiles(directory = '/', options = {}) {
    try {
      // Use promise-based stream processing
      const files = await new Promise((resolve, reject) => {
        const fileList = [];

        const messageStream = this.base.view.find('@roombase/messages', {
          hasAttachments: true
        }, {});

        messageStream.on('data', (msg) => {
          try {
            if (msg.attachments) {
              const attachmentsParsed = JSON.parse(msg.attachments);
              for (const attachment of attachmentsParsed) {
                fileList.push({
                  ...attachment,
                  sender: msg.sender,
                  timestamp: attachment.timestamp || msg.timestamp
                });
              }
            }
          } catch (parseErr) {
            console.error('Error parsing attachments:', parseErr);
          }
        });

        messageStream.on('end', () => {
          resolve(fileList.sort((a, b) => b.timestamp - a.timestamp));
        });

        messageStream.on('error', (err) => {
          console.error('Stream error:', err);
          resolve([]);
        });
      });

      return files;
    } catch (err) {
      console.error(`Error loading files:`, err);
      return [];
    }
  }
  /**
   * Delete a file from the room
   * @param {string} path - File path or ID to delete
   * @returns {boolean} - Success status
   */
  async deleteFile(path) {
    try {
      // Only the owner can delete their files
      // First, check if this is our file by getting the attachment info
      let fileToDelete = null;

      const messages = await this.getMessages({ limit: 100 });

      // Find the message containing this attachment
      for (const msg of messages) {
        if (msg.attachments && Array.isArray(msg.attachments)) {
          const attachment = msg.attachments.find(att =>
            att.path === path || att.name === path || (att.blobId && att.blobId === path)
          );

          if (attachment) {
            fileToDelete = {
              ...attachment,
              messageId: msg.id,
              sender: msg.sender
            };
            break;
          }
        }
      }

      if (!fileToDelete) {
        throw new Error(`File not found: ${path}`);
      }

      // Only delete if it's our file
      const isOurFile = fileToDelete.coreKey === this.blobCore.key.toString('hex');

      if (!isOurFile) {
        throw new Error('Cannot delete files owned by other users');
      }

      // Clear the blob from our blob store
      if (this.blobStore && fileToDelete.blobId) {
        await this.blobStore.clear(fileToDelete.blobId);
      }

      // Also update the message to remove this attachment
      const msg = await this.base.view.get('@roombase/messages', { id: fileToDelete.messageId });
      if (msg && msg.attachments) {
        // Create updated message with this attachment removed
        const updatedMsg = {
          ...msg,
          attachments: msg.attachments.filter(att =>
            att.blobId !== fileToDelete.blobId
          )
        };

        // Delete old message and insert updated one
        await this.base.view.delete('@roombase/messages', { id: msg.id });
        await this.base.view.insert('@roombase/messages', updatedMsg);
      }

      return true;
    } catch (err) {
      console.error(`Error deleting file:`, err);
      return false;
    }
  }

  /**
   * Check if a blob is available in a user's blob store
   * @param {Object} blobRef - The blob reference with coreKey and blobId
   * @returns {boolean} - Whether the blob is available
   */

  async setBlobstore(opts) {
    this.blobStore = opts.blobStore;
    this.blobCore = opts.blobCore
  }

  /**
   * Static method to join a room using an invite code
   */
  static async joinRoom(store, inviteCode, opts = {}) {
    if (!store) throw new Error('Corestore is required');
    if (!inviteCode) throw new Error('Invite code is required');

    try {
      // Create pairing instance
      const pair = RoomBase.pair(store, inviteCode, opts);

      // Wait for pairing to complete
      const room = await pair.finished();

      // Wait for room to be fully ready
      await room.ready();

      return room;
    } catch (err) {
      console.error('Error joining room:', err);
      throw err;
    }
  }
}

// Helper function for error handling
function noop() { }

export default RoomBase;
