const crypto = require('crypto');
const EventEmitter = require('events').EventEmitter;
const callbackify = require('util').callbackify;

// some helper functions
function id() {
    return crypto.randomBytes(16).toString('hex');
}

function now() {
    return new Date();
}

function nowPlusSecs(secs) {
    return (new Date(Date.now() + secs * 1000));
}

function externalMessageRepresentation(msg) {
    return {
        // convert '_id' to an 'id' string
        id      : '' + msg._id,
        ack     : msg.ack,
        payload : msg.payload,
        tries   : msg.tries,
    };
}

module.exports = function(db, name, opts) {
    return new Queue(db, name, opts);
}

// the Queue object itself
function Queue(db, name, opts) {
    if (!db) {
        throw new Error("mongodb-queue-up: provide a mongodb.MongoClient.db");
    }
    if (db instanceof EventEmitter) {
        throw new Error("mongodb-queue-up: provide a mongodb.MongoClient.db from mongodb@4 or higher");
    }
    if (!name) {
        throw new Error("mongodb-queue-up: provide a queue name");
    }
    opts = opts || {};
    this.db = db;
    this.name = name;
    this.col = db.collection(name);
    this.visibility = opts.visibility || 30;
    this.delay = opts.delay || 0;
    this.ttl = opts.ttl || null;

    if (opts.deadQueue) {
        this.deadQueue = opts.deadQueue;
        this.maxRetries = opts.maxRetries || 5;
    }
    let self = this;
    this._ops = {
        findSortToArray: function(query, sort) {
            return self.col.find(query).sort(sort).toArray();
        }
    };
}

Queue.prototype.createIndexesAsync = async function() {
    let self = this;
    let promises = [
        self.col.createIndex({ deleted : 1, visible : 1 }),
        self.col.createIndex({ ack : 1 }, { unique : true, sparse : true })
    ]
    if (self.ttl) {
        promises.push(self.col.createIndex({ deleted : 1 }, { expireAfterSeconds: self.ttl, background: true }));
    }
    let results = await Promise.all(promises);
    return results[0];
}

Queue.prototype.addAsync = async function(payload, opts) {
    let self = this;
    opts = opts || {};
    let delay = opts.delay || self.delay;
    let visible = delay ? (delay instanceof Date ? delay : nowPlusSecs(delay)) : now();
    let msgs = []
    if (payload instanceof Array) {
        if (payload.length === 0) {
            throw new Error('Queue.add(): Array payload length must be greater than 0');
        }
        payload.forEach(function(payload) {
            msgs.push({
                visible  : visible,
                payload  : payload,
            })
        });
    } else {
        msgs.push({
            visible  : visible,
            payload  : payload,
        });
    }
    let results = await self.col.insertMany(msgs);
    if (payload instanceof Array) return ('' + results.insertedIds);
    return ('' + results.insertedIds[0]);
}

Queue.prototype.getAsync = async function(opts) {
    let self = this;
    opts = opts || {};
    let visibility = opts.visibility || self.visibility
    let query = {
        deleted : null,
        visible : { $lte : now() },
    }
    let sort = {
        visible : 1
    }
    let update = {
        $inc : { tries : 1 },
        $set : {
            ack     : id(),
            visible : nowPlusSecs(visibility),
        }
    }
    let result = await self.col.findOneAndUpdate(query, update, {
        sort: sort,
        returnDocument : 'after',
        includeResultMetadata: true
    });
    let msg = result.value;
    if (!msg) return null;
    // convert to an external representation
    msg = externalMessageRepresentation(msg);
    // if we have a deadQueue, then check the tries, else don't
    if (self.deadQueue && msg.tries > self.maxRetries) {
        // So:
        // 1) add this message to the deadQueue
        // 2) ack this message from the regular queue
        // 3) call ourself to return a new message (if exists)
        await self.deadQueue.addAsync(msg);
        await self.ackAsync(msg.ack);
        return self.getAsync(opts);
    }
    return msg;
}

Queue.prototype.pingAsync = async function(ack, opts) {
    let self = this;
    opts = opts || {};
    let visibility = opts.visibility || self.visibility;
    let query = {
        ack     : ack,
        visible : { $gt : now() },
        deleted : null,
    }
    let update = {
        $set : {
            visible : nowPlusSecs(visibility)
        }
    }
    let msg = await self.col.findOneAndUpdate(query, update, {
        returnDocument : 'after',
        includeResultMetadata: true
    });
    if (!msg.value) {
        throw new Error("Queue.ping(): Unidentified ack  : " + ack);
    }
    return ('' + msg.value._id);
}

Queue.prototype.ackAsync = async function(ack) {
    let self = this
    let query = {
        ack     : ack,
        visible : { $gt : now() },
        deleted : null,
    }
    let update = {
        $set : {
            deleted : now(),
        }
    }
    let msg = await self.col.findOneAndUpdate(query, update, {
        returnDocument : 'after',
        includeResultMetadata: true
    });
    if (!msg.value) {
        throw new Error("Queue.ack(): Unidentified ack : " + ack);
    }
    return ('' + msg.value._id);
}

Queue.prototype.cleanAsync = async function() {
    let self = this;
    let query = {
        deleted : { $ne : null },
    }
    await self.col.deleteMany(query);
}

Queue.prototype.totalAsync = async function() {
    let self = this;
    return await self.col.countDocuments();
}

Queue.prototype.sizeAsync = async function() {
    let self = this
    let query = {
        deleted : null,
        visible : { $lte : now() },
    }
    return await self.col.countDocuments(query)
}

Queue.prototype.listWaitingAsync = async function() {
    let self = this
    let query = {
        deleted : null,
        visible : { $lte : now() },
    }
    let sort = {
        visible : 1
    }
    return (await self._ops.findSortToArray(query, sort))
        .map(externalMessageRepresentation);
}

Queue.prototype.inFlightAsync = async function() {
    let self = this;
    let query = {
        ack     : { $exists : true },
        visible : { $gt : now() },
        deleted : null,
    }
    return await self.col.countDocuments(query);
}

Queue.prototype.listInFlightAsync = async function() {
    let self = this;
    let query = {
        ack     : { $exists : true },
        visible : { $gt : now() },
        deleted : null,
    }
    let sort = {
        visible : 1
    }
    return (await self._ops.findSortToArray(query, sort))
        .map(externalMessageRepresentation);
}

Queue.prototype.incompleteAsync = async function() {
    let self = this;
    let query = {
        ack     : { $exists : true },
        deleted : null,
    }
    return await self.col.countDocuments(query);
}

Queue.prototype.listIncompleteAsync = async function() {
    let self = this;
    let query = {
        ack     : { $exists : true },
        deleted : null,
    }
    let sort = {
        visible : 1
    }
    return (await self._ops.findSortToArray(query, sort))
        .map(externalMessageRepresentation);
}

Queue.prototype.doneAsync = async function() {
    let self = this;
    let query = {
        deleted : { $ne : null },
    }
    return await self.col.countDocuments(query);
}

Queue.prototype.killAsync = async function(msg) {
    let self = this;
    if (!self.deadQueue) return;
    // 1) add this message to the deadQueue
    // 2) ack this message from the regular queue
    await self.deadQueue.addAsync(msg);
    await self.ackAsync(msg.ack);
}

// automatically build the old callback style functions
const fnNameAsyncArr = Object.getOwnPropertyNames(Queue.prototype)
    .filter(x => x.endsWith('Async'));
for (let nameAsync of fnNameAsyncArr) {
    let name = nameAsync.slice(0, -5);
    Object.defineProperty(Queue.prototype, name, {
        value: callbackify(function(...args) {
            let self = this;
            return self[nameAsync](...args);
        })
    });
}
