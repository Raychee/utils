const {isObject} = require('lodash');
const stableStringify = require('fast-json-stable-stringify');


/**
 * @param ms {number}
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isThenable(obj) {
    return isObject(obj) && typeof obj.then === 'function' && obj.then.length === 2;
}

function dedup(fn, {key = (...args) => args, within = 0} = {}) {
    const states = {};
    if (!key) key = () => [];

    function purge() {
        const now = Date.now();
        const expiredKeys = Object.keys(states).filter(k => {
            const state = states[k];
            return state.isResolved && state.expireAt <= now;
        });
        for (const k of expiredKeys) {
            delete states[k];
        }
    }

    return async function (...args) {
        const k = stableStringify(key(...args), {cycles: true});
        purge();
        const state = states[k] || {};
        states[k] = state;
        if (!state.expireAt) {
            state.expireAt = Date.now() + within;
            state.promise = fn.apply(this, args);
        } else if (!state.promise) {
            throw new Error(`potential recursive call of a deduped async function ${fn.name}(${args.join(', ')})`);
        }
        try {
            return await state.promise;
        } finally {
            state.isResolved = true;
        }
    };
}

function limit(fn, limit) {
    const queue = [];
    let executing = 0;
    const next = () => {
        executing--;
        if (queue.length > 0) {
            queue.shift()();
        }
    };
    const run = function (fn, resolve, args) {
        executing++;
        const promise = fn.apply(this, args);
        resolve(promise);
        promise.then(next, next);
    };
    return function (...args) {
        return new Promise(resolve => {
            if (executing < limit) {
                run.call(this, fn, resolve, args);
            } else {
                queue.push(run.bind(this, fn, resolve, args));
            }
        });
    };
}


class BatchLoader {
    constructor(fn, options = {}) {
        this.options = options;
        this.options.maxSize = this.options.maxSize || Number.MAX_SAFE_INTEGER;
        this.options.maxWait = this.options.maxWait || 0;
        this.options.maxConcurrency = this.options.maxConcurrency || Number.MAX_SAFE_INTEGER;

        this.fn = limit(fn, this.options.maxConcurrency);
        this.queue = [];
        this.timeout = undefined;
    }

    load(key) {
        return new Promise((resolve, reject) => {
            this.queue.push({key, resolve, reject});
            if (this.queue.length >= this.options.maxSize) {
                if (this.timeout !== undefined) {
                    clearTimeout(this.timeout);
                    this.timeout = undefined;
                }
                this._exec().catch(e => console.error(`This should never happen in BatchLoader: ${e}`));
            } else if (this.timeout === undefined) {
                this.timeout = setTimeout(
                    () =>
                        this._exec().catch(e => console.error(`This should never happen in BatchLoader: ${e}`)),
                    this.options.maxWait
                );
            }
        });
    }

    async _exec() {
        const queue = this.queue;
        this.queue = [];
        this.timeout = undefined;
        const keys = queue.map(q => q.key);
        try {
            const results = await this.fn(keys);
            for (let i = 0; i < queue.length; i++) {
                const {resolve} = queue[i];
                if (resolve) {
                    resolve(results && results[i]);
                }
            }
        } catch (e) {
            for (let i = 0; i < queue.length; i++) {
                const {reject} = queue[i] || {};
                if (reject) {
                    reject(e);
                }
            }
        }
    }
}


class Runnable {

    /**
     * @callback Then
     * @param {function} onFulfilled
     * @param {function} onRejected
     * @return {Promise<*>}
     */
    /**
     * @typedef {object} Thenable
     * @property {Then} Thenable.then
     */
    /**
     * @callback RunFn
     * @param {object} input
     * @param {object} input.options
     * @param {Thenable} input.signal
     */
    /**
     * @param {RunFn} [fn]
     */
    constructor(fn) {
        this.fn = fn;
        this.ready = undefined;
        this.running = undefined;
        this.stopping = undefined;
        this.returned = undefined;
        this.error = undefined;
    }

    async start(options = {}) {
        const {waitForReady = false, waitForStop = false, ...opts} = options;
        if (!this.running) {
            this.error = undefined;
            this.ready = new Promise((resolve) => {
                const stopping = new Promise(resolve => this.stopping = resolve);
                const signal = {
                    then: (onRes, onRej) => {
                        resolve();
                        return stopping.then(onRes, onRej);
                    }
                };
                this.running = this.run({options: opts, signal})
                    .then(
                        (ret) => {this.returned = ret;},
                        (error) => {this.error = error;}
                    )
                    .finally(() => {
                        resolve();
                        this.ready = undefined;
                        this.running = undefined;
                        this.stopping = undefined;
                    });
            });
        }
        if (waitForReady) {
            await this.waitForReady();
        }
        if (waitForStop) {
            return this.waitForStop();
        }
    }

    async waitForReady() {
        if (this.ready) {
            await this.ready;
        }
        if (this.error) {
            throw this.error;
        }
        return this.returned;
    }

    async waitForStop() {
        await this.waitForReady();
        if (this.running) {
            await this.running;
        }
        if (this.error) {
            throw this.error;
        }
        return this.returned;
    }

    async stop(options = {}) {
        const {waitForStop = false, ...opts} = options;
        if (this.stopping) {
            this.stopping(opts);
        }
        if (waitForStop) {
            return this.waitForStop();
        }
    }

    async run(arg) {
        if (this.fn) {
            return this.fn(arg);
        }
    }

}



module.exports = {
    sleep,
    isThenable,
    dedup,
    limit,
    BatchLoader,
    Runnable,
};
