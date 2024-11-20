let sleepAsync = (ms, state, errMsg) => new Promise((resolve, reject) => {
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
module.exports = {
    sleepAsync
};