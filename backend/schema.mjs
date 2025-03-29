
import Hyperschema from 'hyperschema'
import HyperdbBuilder from 'hyperdb/builder'
import Hyperdispatch from 'hyperdispatch'

const roombase = Hyperschema.from('./spec/schema')
const template = roombase.namespace('roombase')

// Base schemas for writer management
template.register({
  name: 'writer',
  compact: false,
  fields: [{
    name: 'key',
    type: 'buffer',
    required: true
  }]
})

template.register({
  name: 'invite',
  compact: false,
  fields: [{
    name: 'id',
    type: 'buffer',
    required: true
  }, {
    name: 'invite',
    type: 'buffer',
    required: true
  }, {
    name: 'publicKey',
    type: 'buffer',
    required: true
  }, {
    name: 'expires',
    type: 'int',
    required: true
  }]
})

template.register({
  name: 'metadata',
  compact: false,
  fields: [{
    name: 'id',
    type: 'string',
    required: true
  }, {
    name: 'name',
    type: 'string',
    required: true
  }, {
    name: 'createdAt',
    type: 'int',
    required: true
  }, {
    name: 'messageCount',
    type: 'int',
    required: false
  },]
});


// Message schema - matches application's message structure exactly
template.register({
  name: 'messages',
  compact: false,
  fields: [{
    name: 'id',
    type: 'string',
    required: true
  }, {
    name: 'content',
    type: 'string',
    required: true
  }, {
    name: 'sender',
    type: 'string',
    required: true
  }, {
    name: 'timestamp',
    type: 'int',
    required: true
  }, {
    name: 'system',
    type: 'bool',
    required: false
  }, {
    name: 'received',
    type: 'bool',
    required: false
  }, {
    name: 'hasAttachments',
    type: 'bool',
    required: false
  }, {
    name: 'attachments',
    type: 'string', // split with ,
    required: false
  }]
})


Hyperschema.toDisk(roombase)

const dbTemplate = HyperdbBuilder.from('./spec/schema', './spec/db')
const collections = dbTemplate.namespace('roombase')

// Register collections for database
collections.collections.register({
  name: 'writer',
  schema: '@roombase/writer',
  key: ['key']
})

collections.collections.register({
  name: 'invite',
  schema: '@roombase/invite',
  key: ['id']
})

collections.collections.register({
  name: 'metadata',
  schema: '@roombase/metadata',
  key: ['id']
})

collections.collections.register({
  name: 'messages',
  schema: '@roombase/messages',
  key: ['id']
})



HyperdbBuilder.toDisk(dbTemplate)

// Setup command dispatching
const hyperdispatch = Hyperdispatch.from('./spec/schema', './spec/hyperdispatch')
const namespace = hyperdispatch.namespace('roombase')

// Register command handlers
namespace.register({
  name: 'remove-writer',
  requestType: '@roombase/writer'
})

namespace.register({
  name: 'add-writer',
  requestType: '@roombase/writer'
})

namespace.register({
  name: 'add-invite',
  requestType: '@roombase/invite'
})

namespace.register({
  name: 'send-message',
  requestType: '@roombase/messages'
})

namespace.register({
  name: 'delete-message',
  requestType: '@roombase/messages'
})

namespace.register({
  name: 'set-metadata',
  requestType: '@roombase/metadata'
})


Hyperdispatch.toDisk(hyperdispatch)

