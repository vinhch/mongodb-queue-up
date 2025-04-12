// const sleepAsync = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const sleepAsync = (ms, state, errMsg) => new Promise((resolve, reject) => {
    setTimeout(() => {
        if (state === "reject") {
            errMsg = errMsg || `This sleepAsync promise has been timeout after ${ms}ms`;
            return reject(new Error(errMsg));
        } else {
            // fulfill
            return resolve();
        }
    }, ms);
});

const tryCatchWrapper = (func, defaultTimeout, action) => (...args1) => {
    // important note: consider to use bind to bound the correct function context when passing func
    const adjustedLength = Math.max(args1.length, 1),
        args = args1.slice(0, adjustedLength - 1),
        cb = args1[adjustedLength - 1];
    if (typeof func !== 'function') return;
    if (typeof cb !== 'function') return func(...args, cb);
    try {
        let hasReturned = false;
        let timer = setTimeout(function () {
            if (!hasReturned) {
                hasReturned = true;
                return cb(new Error(`tryCatchWrapper: Execution timeout by default with ${action} ${args[0]}`));
            }
        },
            (defaultTimeout || 0) + (60 * 1000));

        let newCb = function (...returnArgs) {
            clearTimeout(timer);
            if (!hasReturned) {
                hasReturned = true;
                return cb(...returnArgs);
            }
        };

        return func(...args, newCb);
    } catch (ex) {
        if (typeof cb === 'function') {
            return cb(ex);
        } else {
            return console.error(`tryCatchWrapper with ${action} ${args[0]} has an exception: `, ex);
        }
    }
};

const promiseTimeoutAsync = async (promise, time, errMsg) => {
    let timer = 0;
    let resolve = null;
    errMsg = errMsg || `${promise} has been timeout after ${time}ms`;

    const result = await Promise.race([
        promise,
        new Promise((_resolve, reject) => {
            resolve = _resolve;
            timer = setTimeout(() => {
                const err = new Error(errMsg);
                err.timeoutDetail = {
                    promise: promise,
                    wait: time
                }
                reject(err)
            }, time);
        })
    ]);

    if (timer) {
        try {
            clearTimeout(timer);
            timer = 0;
            resolve();
            resolve = null;
        }
        catch { }
    }
    return result;
}

module.exports = {
    sleepAsync
};