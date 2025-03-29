// /* global Bare, BareKit */

import RPC from 'bare-rpc'
import fs from 'bare-fs'
import Autopass from 'autopass'
import Corestore from 'corestore'
import bip39 from "bip39"
import b4a from "b4a"
const { IPC } = BareKit

const path =
  Bare.argv[0] === 'android'
    ? '/data/data/to.holepunch.bare.expo/autopass-example'
    : './tmp/autopass-example/'


const genSeed = () => {
  const words = []
  for (let i = 0; i < 20; i++) {
    const mnem = bip39.generateMnemonic()
    words.push(mnem?.[0] || mnem)
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

fs.mkdirSync(path)
