const mongodb = require(`mongodb${process.argv[2]}`)

const url = 'mongodb://127.0.0.1:27017/'
const dbName = 'mongodb-queue-up'

const collections = [
  'default',
  'delay',
  'multi',
  'visibility',
  'clean',
  'ping',
  'stats1',
  'stats2',
  'indexes',
  'ttl',
  'queue',
  'dead-queue',
  'queue-2',
  'dead-queue-2',
]

module.exports = function(callback) {
  const client = new mongodb.MongoClient(url)

  client.connect().then(() => {
    const db = client.db(dbName)

    // empty out some collections to make sure there are no messages
    let done = 0
    collections.forEach((col) => {
      db.collection(col).deleteMany().then(() => {
        done += 1
        if ( done === collections.length ) {
          callback(client, db)
        }
      })
    })
  })

}
