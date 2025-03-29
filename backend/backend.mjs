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

})

// For a clean start
if (fs.existsSync(path)) {
  fs.rmSync(path, {
    recursive: true,
    force: true
  })
}



const createNewAccount = async (seed) => {
  if (hasAccount()) return;
  fs.mkdirSync(userBasePath)
  userBase = new UserBase(new Corestore(userBasePath), { userSeed: seed })
  await userBase.ready()
}

const hasAccount = () => {
  return fs.existsSync(userBasePath)
}
