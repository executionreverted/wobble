// /* global Bare, BareKit */

import RPC from 'bare-rpc'
import fs from 'bare-fs'
import Corestore from 'corestore'
import bip39 from "bip39"
import b4a from "b4a"
const { IPC } = BareKit
import UserBase from './userbase/userbase.mjs'
const path =
  Bare.argv[0] === 'android'
    ? '/data/data/to.holepunch.bare.expo/autopass-example'
    : './tmp/autopass-example/'

const userBasePath = path + 'userbase/'
const roomBasePath = path + 'roombase/'

let userBase;
let roomBases;

const genSeed = () => {
  const mnem = bip39.generateMnemonic()
  return mnem.split(' ')
}

const sendSeed = () => {
  const seed = genSeed()
  const req = rpc.request('seedGenerated')
  req.send(JSON.stringify(seed))
}

const rpc = new RPC(IPC, (req, error) => {
  console.log('Received RPC request:', req.command)
  if (req.command === 'generateSeed') {
    sendSeed()
  }


  if (req.command === 'confirmSeed') {
    createNewAccount()
  }

})

// For a clean start
if (fs.existsSync(path)) {
  fs.rmSync(path, {
    recursive: true,
    force: true
  })
}

const createNewAccount = async (seed) => {
  if (hasAccount()) {
    return { exists: true }
  }

  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(userBasePath)) {
      fs.mkdirSync(userBasePath, { recursive: true })
    }

    // Initialize corestore
    const store = new Corestore(userBasePath)
    await store.ready()

    // Create userbase
    userBase = new UserBase(store, { userSeed: seed })
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
