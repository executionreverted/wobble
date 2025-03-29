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


let userCorestore;
let userBase;
let roomBases = {};
let roomCorestores = {}


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

})

// For a clean start
// if (fs.existsSync(path)) {
//   fs.rmSync(path, {
//     recursive: true,
//     force: true
//   })
// }

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



const teardown = () => {
  userBase?.close?.()
  userCorestore?.close()
  Object.entries().forEach((v) => v?.close?.())
}
