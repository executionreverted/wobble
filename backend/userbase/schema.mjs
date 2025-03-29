

import Hyperschema from 'hyperschema'
import HyperdbBuilder from 'hyperdb/builder'
import Hyperdispatch from 'hyperdispatch'

const userbase = Hyperschema.from('./spec/schema')
const template = userbase.namespace('userbase')

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
  },
  {
    name: 'status',
    type: 'string',
    required: true
  },
  {
    name: 'seed',
    type: 'string',
    required: true
  }, {
    name: 'contacts',
    type: 'string',
    required: false
  },
  {
    name: 'rooms',
    type: 'string',
    required: false
  },
  ]
});



Hyperschema.toDisk(userbase)

const dbTemplate = HyperdbBuilder.from('./spec/schema', './spec/db')
const collections = dbTemplate.namespace('userbase')

// Register collections for database
collections.collections.register({
  name: 'writer',
  schema: '@userbase/writer',
  key: ['key']
})

collections.collections.register({
  name: 'invite',
  schema: '@userbase/invite',
  key: ['id']
})

collections.collections.register({
  name: 'metadata',
  schema: '@userbase/metadata',
  key: ['id']
})


HyperdbBuilder.toDisk(dbTemplate)

// Setup command dispatching
const hyperdispatch = Hyperdispatch.from('./spec/schema', './spec/hyperdispatch')
const namespace = hyperdispatch.namespace('userbase')

// Register command handlers
namespace.register({
  name: 'remove-writer',
  requestType: '@userbase/writer'
})

namespace.register({
  name: 'add-writer',
  requestType: '@userbase/writer'
})

namespace.register({
  name: 'add-invite',
  requestType: '@userbase/invite'
})

namespace.register({
  name: 'set-metadata',
  requestType: '@userbase/metadata'
})

Hyperdispatch.toDisk(hyperdispatch)

