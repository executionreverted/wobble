// /* global Bare, BareKit */

import RPC from 'bare-rpc'
import fs from 'bare-fs'
import Autopass from 'autopass'
import Corestore from 'corestore'
import bip39 from "bip39"
const { IPC } = BareKit

const path =
  Bare.argv[0] === 'android'
    ? '/data/data/to.holepunch.bare.expo/autopass-example'
    : './tmp/autopass-example/'


const genSeed = () => {
  const mnemonic = bip39.generateMnemonic()
  return [mnemonic]
}

const sendNewSeed = () => {
  const req = rpc.request('getNewSeed')
  req.send(JSON.stringify(genSeed()))
}

const rpc = new RPC(IPC, (req, error) => {
  // Handle two way communication here
  console.log(req)
  if (req.command === 'getNewSeed') {
    sendNewSeed()
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

