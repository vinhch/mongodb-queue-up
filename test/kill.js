var flow = require('async')
var test = require('tape')

var setup = require('./setup.js')
var mongoDbQueue = require('../')

setup(function(client, db) {

    test('kill: first test', function(t) {
        var queue = mongoDbQueue(db, 'queue', { visibility : 3, deadQueue : 'dead-queue' })
        t.ok(queue, 'Queue created ok')
        t.end()
    });

    test('kill: two messages, with first going over 2 tries then kill it', function(t) {
        t.plan(18)

        var deadQueue = mongoDbQueue(db, 'dead-queue-2')
        var queue = mongoDbQueue(db, 'queue-2', { visibility : 1, deadQueue : deadQueue, maxRetries : 3 })
        var origId, origId2

        flow.series(
            [
                function(next) {
                    queue.add('Hello, World!', function(err, id) {
                        t.ok(!err, 'There is no error when adding a message.')
                        t.ok(id, 'Received an id for this message')
                        origId = id
                        next()
                    })
                },
                function(next) {
                    queue.add('Part II', {delay: 6}, function(err, id) {
                        t.ok(!err, 'There is no error when adding another message.')
                        t.ok(id, 'Received an id for this message')
                        origId2 = id
                        next()
                    })
                },
                function(next) {
                    queue.get(function(err, thisMsg) {
                        msg = thisMsg
                        t.equal(thisMsg.id, origId, 'We return the first message on first go')
                        setTimeout(function() {
                            t.pass('First expiration')
                            next()
                        }, 2 * 1000)
                    })
                },
                function(next) {
                    queue.get(function(err, thisMsg) {
                        t.equal(thisMsg.id, origId, 'We return the first message on second go and kill it')
                        queue.kill(thisMsg, (err1) => {
                            t.ok(!err1, 'There was no error killing message')
                            setTimeout(function() {
                                t.pass('Second expiration')
                                next()
                            }, 2 * 1000)
                        })
                    })
                },
                function(next) {
                    // This is the 3th time, so we SHOULD have moved it to the dead queue
                    // pior to it being returned.
                    setTimeout(function() {
                        queue.get(function(err, msg) {
                            t.ok(!err, 'No error when getting the 2nd message')
                            t.equal(msg.id, origId2, 'Got the ID of the 2nd message')
                            t.equal(msg.payload, 'Part II', 'Got the same payload as the 2nd message')
                            next()
                        })
                    }, 2 * 1000)
                },
                function(next) {
                    deadQueue.get(function(err, msg) {
                        t.ok(!err, 'No error when getting from the deadQueue')
                        t.ok(msg.id, 'Got a message id from the deadQueue')
                        t.equal(msg.payload.id, origId, 'Got the same message id as the original message')
                        t.equal(msg.payload.payload, 'Hello, World!', 'Got the same as the original message')
                        t.equal(msg.payload.tries, 2, 'Got the tries as 2 because of the kill')
                        next()
                    })
                },
            ],
            function(err) {
                t.ok(!err, 'No error during single round-trip test')
                t.end()
            }
        )
    })

    test('client.close()', function(t) {
        t.pass('client.close()')
        client.close()
        t.end()
    })

})
