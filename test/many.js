const flow = require('async');
const test = require('tape');

const setup = require('./setup.js');
const mongoDbQueue = require('../');

const total = 250;

setup(function(client, db) {

    test('many: add ' + total + ' messages, get ' + total + ' back', function(t) {
        var queue = mongoDbQueue(db, 'many')
        var msgs = []
        var msgsToQueue = []

        flow.series(
            [
                function(next) {
                    var i
                    for(i=0; i<total; i++) {
                        msgsToQueue.push('no=' + i)
                    }
                    queue.add(msgsToQueue, function(err) {
                        if (err) return t.fail('Failed adding a message')
                        t.pass('All ' + total + ' messages sent to MongoDB')
                        next()
                    })
                },
                function(next) {
                    function getOne() {
                        queue.get(function(err, msg) {
                            if (err || !msg) return t.fail('Failed getting a message')
                            msgs.push(msg)
                            if (msgs.length === total) {
                                t.pass('Received all ' + total + ' messages')
                                next()
                            }
                            else {
                                getOne()
                            }
                        })
                    }
                    getOne()
                },
                function(next) {
                    var acked = 0
                    msgs.forEach(function(msg) {
                        queue.ack(msg.ack, function(err) {
                            if (err) return t.fail('Failed acking a message')
                            acked++
                            if (acked === total) {
                                t.pass('Acked all ' + total + ' messages')
                                next()
                            }
                        })
                    })
                },
            ],
            function(err) {
                if (err) t.fail(err)
                t.pass('Finished test ok')
                t.end()
            }
        )
    })

    test('many: add no messages, receive err in callback', function(t) {
        var queue = mongoDbQueue(db, 'many')
        var messages = []
        queue.add([], function(err) {
            if (!err) t.fail('Error was not received')
            t.pass('Finished test ok')
            t.end()
        });
    })

    test('many: get N async', async function(t) {
        let queue = mongoDbQueue(db, 'many');

        let msgsToQueue = []
        for(let i=0; i<total; i++) {
            msgsToQueue.push('no=' + i)
        }

        let ids = await queue.addAsync(msgsToQueue);
        t.equal(ids.length, 250, `Added ${total} items to queue`);

        let msgArr = await queue.getNAsync(10);
        t.equal(msgArr.length, 10, `getNAsync received 10 items from queue`);

        msgArr.length = 0;
        let msgIterable = queue.getGenerator(10);
        for await(const i of msgIterable) msgArr.push(i);
        t.equal(msgArr.length, 10, `getGenerator received 10 items from queue`);

        let results = await Promise.all([
            queue.getNAsync(100),
            queue.getNAsync(100)
        ]);
        t.equal(results.length, 2, `Executed 2 get queue action at the same time is ok`);
        t.equal(results[0].length, 100, `1st get queue action return 100 items`);
        t.equal(results[1].length, 100, `2nd get queue action return 100 items`);
        t.true(results[0].length === new Set(results[0].map(x=>x.id)).size, `1st get queue action doesn't have duplicates`);
        t.true(results[1].length === new Set(results[1].map(x=>x.id)).size, `2nd get queue action doesn't have duplicates`);
        let joinArr = [].concat(results[0]).concat(results[1]);
        t.true(joinArr.length === 200 && joinArr.length === new Set(joinArr.map(x=>x.id)).size, `both get queue action doesn't have duplicates`);

        let leftOverArr = await queue.getNAsync(100);
        t.equal(leftOverArr.length, 30, `getNAsync 100 but received last 30 items from queue`);

        t.end();
    })

    test('client.close()', function(t) {
        t.pass('client.close()')
        client.close()
        t.end()
    })

})
