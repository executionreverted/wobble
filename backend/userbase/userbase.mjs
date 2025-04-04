
// userbase.js - Room-specific P2P database built on autobase
import Autobase from 'autobase';
import BlindPairing from 'blind-pairing';
import HyperDB from 'hyperdb';
import Hyperswarm from 'hyperswarm';
import ReadyResource from 'ready-resource';
import z32 from 'z32';
import b4a from 'b4a';
import { Router, dispatch } from './spec/hyperdispatch/index.mjs';
import db from './spec/db/index.mjs';
import crypto from "bare-crypto"

class UserBasePairer extends ReadyResource {
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
    this.user = null;
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
          this.room = new UserBase(this.store, {
            swarm: this.swarm,
            key: result.key,
            encryptionKey: result.encryptionKey,
            bootstrap: this.bootstrap,
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
 * Main UserBase class for a single room with p2p messaging and file sharing
 */
class UserBase extends ReadyResource {
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
    this.userSeed = opts.userSeed;
    this.messageListeners = [];
    // Register command handlers
    this._registerHandlers();

    this._boot(opts);
    this.ready().catch(noop);
  }

  _registerHandlers() {
    // Writer management commands
    this.router.add('@userbase/remove-writer', async (data, context) => {
      await context.base.removeWriter(data.key);
    });

    this.router.add('@userbase/add-writer', async (data, context) => {
      await context.base.addWriter(data.key);
    });

    this.router.add('@userbase/add-invite', async (data, context) => {
      await context.view.insert('@userbase/invite', data);
    });


    this.router.add('@userbase/set-metadata', async (data, context) => {
      // First try deleting existing metadata
      try {
        await context.view.delete('@userbase/metadata', { id: data.id });
      } catch (e) {
        // Ignore errors if no existing record
      }
      // Then insert the new metadata
      await context.view.insert('@userbase/metadata', data);
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
    }

    await view.flush();
  }

  async _open() {
    await this.base.ready();


    if (this.replicate) await this._replicate();

    // Save room info if not already stored
    await this._initializeUser();
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

  async _initializeUser() {
    try {
      // Generate a deterministic public key from the seed phrase
      let pubKey;

      if (Array.isArray(this.userSeed)) {
        // If seed is an array of words, join them
        this.userSeed = this.userSeed.join(' ');
      }

      // Generate pubKey from seed using crypto
      const seedBuffer = b4a.from(this.userSeed);
      const hash = crypto.createHash('sha256').update(seedBuffer).digest();
      pubKey = b4a.toString(hash, 'hex');

      // Set as the user's public key
      this.userPubKey = pubKey;

      // Check if user already exists
      const existingUser = await this.getUserInfo();

      if (!existingUser) {
        // Create new user record
        const newUser = {
          id: this.userPubKey,
          seed: this.userSeed,
          name: "User-" + Math.ceil(Math.random() * 10000),
          status: "Available",
          contacts: JSON.stringify([]),
          rooms: JSON.stringify([])
        };

        try {
          const dispatchData = dispatch('@userbase/set-metadata', newUser);
          await this.base.append(dispatchData);

          // Update local properties
          this.userName = newUser.name;
          this.userStatus = newUser.status;
          this.userRooms = [];
          this.userContacts = [];

          console.log('Created new user profile:', this.userPubKey);
        } catch (e) {
          console.error('Error creating user profile:', e);
        }
      } else {
        // Update local properties from stored values
        this.userPubKey = existingUser.id;
        this.userSeed = existingUser.seed;
        this.userName = existingUser.name;
        this.userStatus = existingUser.status;

        try {
          this.userRooms = existingUser.rooms ? JSON.parse(existingUser.rooms) : [];
          this.userContacts = existingUser.contacts ? JSON.parse(existingUser.contacts) : [];
        } catch (e) {
          console.error('Error parsing user data:', e);
          this.userRooms = [];
          this.userContacts = [];
        }

        console.log('Loaded existing user profile:', this.userPubKey);
      }

      return true;
    } catch (error) {
      console.error('Error in _initializeUser:', error);
      return false;
    }
  }

  // Method to get user data in a structured format
  // Method to get user data in a structured format
  async getUserData() {
    await this.ready();

    // Parse string arrays into actual arrays
    let roomsArray = [];
    try {
      if (this.userRooms) {
        if (typeof this.userRooms === 'string') {
          roomsArray = JSON.parse(this.userRooms);
        } else if (Array.isArray(this.userRooms)) {
          roomsArray = this.userRooms;
        }
      }
    } catch (e) {
      console.error('Error parsing rooms in getUserData:', e);
      roomsArray = [];
    }

    let contactsArray = [];
    try {
      if (this.userContacts) {
        if (typeof this.userContacts === 'string') {
          contactsArray = JSON.parse(this.userContacts);
        } else if (Array.isArray(this.userContacts)) {
          contactsArray = this.userContacts;
        }
      }
    } catch (e) {
      console.error('Error parsing contacts in getUserData:', e);
      contactsArray = [];
    }

    return {
      id: this.userPubKey,
      name: this.userName,
      status: this.userStatus,
      seed: this.userSeed,
      contacts: contactsArray,
      rooms: roomsArray
    };
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
    return new UserBasePairer(store, invite, opts);
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
          const inv = await this.base.view.findOne('@userbase/invite', {});
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
    const existing = await this.base.view.findOne('@userbase/invite', {});
    if (existing) {
      return z32.encode(existing.invite);
    }

    const { id, invite, publicKey, expires } = BlindPairing.createInvite(this.base.key);
    const record = { id, invite, publicKey, expires };
    await this.base.append(dispatch('@userbase/add-invite', record));
    return z32.encode(record.invite);
  }

  async addWriter(key) {
    await this.base.append(dispatch('@userbase/add-writer', { key: b4a.isBuffer(key) ? key : b4a.from(key) }));
    return true;
  }

  async removeWriter(key) {
    await this.base.append(dispatch('@userbase/remove-writer', { key: b4a.isBuffer(key) ? key : b4a.from(key) }));
  }



  /**
  * Updated method to update user profile in UserBase class
  */
  async updateUserProfile(profileData) {
    if (!this.base || !this.userPubKey) {
      return { success: false, error: 'User not initialized' };
    }

    try {
      await this.ready();

      // Get current user info
      const existingUser = await this.getUserInfo();
      if (!existingUser) {
        return { success: false, error: 'User profile not found' };
      }

      console.log('Updating user profile with:', profileData);

      // Prepare updated user data (keeping existing values for fields not in profileData)
      const updatedUser = {
        ...existingUser,
        name: profileData.name !== undefined ? profileData.name : existingUser.name,
        status: profileData.status !== undefined ? profileData.status : existingUser.status,
        seed: existingUser.seed  // Always preserve the seed
      };

      // Handle special fields that need to be JSON strings in the database
      if (profileData.rooms !== undefined) {
        try {
          // If rooms is already a string, verify it's valid JSON
          if (typeof profileData.rooms === 'string') {
            // Verify it's valid JSON that parses to an array
            const parsed = JSON.parse(profileData.rooms);
            if (!Array.isArray(parsed)) {
              console.error('rooms field is not an array after parsing:', parsed);
              updatedUser.rooms = '[]'; // Reset to empty array if invalid
            } else {
              updatedUser.rooms = profileData.rooms;
            }
          } else if (Array.isArray(profileData.rooms)) {
            // If it's already an array, stringify it
            updatedUser.rooms = JSON.stringify(profileData.rooms);
          } else {
            console.error('Invalid type for rooms:', typeof profileData.rooms);
            updatedUser.rooms = '[]'; // Default to empty array
          }
        } catch (err) {
          console.error('Error processing rooms data:', err);
          updatedUser.rooms = '[]';
        }
      }

      if (profileData.contacts !== undefined) {
        try {
          // If contacts is already a string, verify it's valid JSON
          if (typeof profileData.contacts === 'string') {
            // Verify it's valid JSON
            JSON.parse(profileData.contacts);
            updatedUser.contacts = profileData.contacts;
          } else if (Array.isArray(profileData.contacts)) {
            updatedUser.contacts = JSON.stringify(profileData.contacts);
          } else {
            console.error('Invalid type for contacts:', typeof profileData.contacts);
            updatedUser.contacts = '[]'; // Default to empty array
          }
        } catch (err) {
          console.error('Error processing contacts data:', err);
          updatedUser.contacts = '[]';
        }
      }

      console.log('Dispatching profile update with:', updatedUser);

      // Make sure all fields are defined and not null before dispatch
      Object.keys(updatedUser).forEach(key => {
        if (updatedUser[key] === undefined || updatedUser[key] === null) {
          if (key === 'contacts' || key === 'rooms') {
            updatedUser[key] = '[]';
          } else if (key === 'status') {
            updatedUser[key] = 'Available';
          } else if (key !== 'id' && key !== 'name' && key !== 'seed') {
            // Don't override critical fields, but provide defaults for others
            updatedUser[key] = '';
          }
        }
      });

      // Ensure required fields exist
      if (!updatedUser.id) {
        updatedUser.id = this.userPubKey;
      }

      if (!updatedUser.name) {
        updatedUser.name = "User-" + Math.ceil(Math.random() * 10000);
      }

      if (!updatedUser.status) {
        updatedUser.status = "Available";
      }

      if (!updatedUser.seed) {
        updatedUser.seed = this.userSeed || "";
      }

      // Dispatch the profile update with safe data
      try {
        const dispatchData = dispatch('@userbase/set-metadata', updatedUser);
        await this.base.append(dispatchData);
      } catch (dispatchErr) {
        console.error('Error dispatching profile update:', dispatchErr);
        return { success: false, error: dispatchErr.message || 'Failed to dispatch profile update' };
      }

      // Update local properties
      this.userName = updatedUser.name;
      this.userStatus = updatedUser.status;

      // Update local arrays from their string representation
      try {
        this.userRooms = updatedUser.rooms ? JSON.parse(updatedUser.rooms) : [];
        console.log('Updated userRooms to:', this.userRooms);
      } catch (e) {
        console.error('Error parsing rooms:', e);
        this.userRooms = [];
      }

      try {
        this.userContacts = updatedUser.contacts ? JSON.parse(updatedUser.contacts) : [];
      } catch (e) {
        console.error('Error parsing contacts:', e);
        this.userContacts = [];
      }

      console.log('Updated user profile:', this.userPubKey);
      return { success: true };
    } catch (error) {
      console.error('Error in updateUserProfile:', error);
      return { success: false, error: error.message || 'Failed to update profile' };
    }
  }


  async getUserInfo() {
    try {
      return await this.base.view.findOne('@userbase/metadata', {});
    } catch (e) {
      return null;
    }
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
                const result = await this.base.view.find('@userbase/messages', {});
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

  /**
  * Static method to join a room using an invite code
  */
  static async addDevice(store, inviteCode, opts = {}) {
    if (!store) throw new Error('Corestore is required');
    if (!inviteCode) throw new Error('Invite code is required');

    try {
      // Create pairing instance
      const pair = UserBase.pair(store, inviteCode, opts);

      // Wait for pairing to complete
      const room = await pair.finished();

      // Wait for room to be fully ready
      await room.ready();

      return room;
    } catch (err) {
      console.error('Error pairing device:', err);
      throw err;
    }
  }
}

// Helper function for error handling
function noop() { }

export default UserBase;
