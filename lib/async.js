"use strict";

const isObject = require('lodash/isObject');
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

function dedup(fn, {key = (...args) => args, within = 0, queue = 0, debug} = {}) {
    const states = {};
    if (!key) key = () => [];
    if (debug) {
        if (typeof debug !== 'function') {
            debug = console.log.bind(console);
        }
    } else {
        debug = () => {};
    }
    
    const getKey = (args) => stableStringify(key(...args), {cycles: true});
    const deduped = async function (...args) {
        const k = getKey(args);
        let state = states[k];
        if (state) {
            if (!state.running) {
                throw new Error(`potential recursive call of a deduped async function ${fn.name}(${args.join(', ')})`);
            }
        } else {
            state = {queue: 0};
            states[k] = state;
        }
        const makePromise = (state) => {
            const {delayed} = state;
            state.running = delayed ? delayed.then(() => fn.apply(this, args)) : fn.apply(this, args);
            state.delayed = state.running.catch(() => {}).then(async () => {
                if (within > 0) await sleep(within);
                if (state.queue > 0) {
                    debug(`end of calling async function "${fn.name}" with key ${k}: queue = ${state.queue} - 1`);
                    state.queue--;
                } else {
                    debug(`end of calling async function "${fn.name}" with key ${k}: queue = ${state.queue}, deleted`);
                    delete states[k];
                }
            });
        };
        if (state.running) {
            if (state.queue < queue) {
                debug(`call async function "${fn.name}" with key ${k}: already running, queue = ${state.queue} + 1`);
                state.queue++;
                makePromise(state);
            } else {
                debug(`call async function "${fn.name}" with key ${k}: already running, queue = ${state.queue}`);
            }
        } else {
            debug(`call async function "${fn.name}" with key ${k}: new, queue = ${state.queue}`);
            makePromise(state);
        }
        return state.running;
    };
    
    deduped.state = (...args) => {
        const k = getKey(args);
        return states[k] || {queue: 0};
    };
    deduped.wait = async (...args) => {
        const k = getKey(args);
        const state = states[k] || {};
        return state.running && state.running.then(() => {}, () => {});
    };
    
    return deduped;
}

function limit(fn, limit) {
    const queue = [];
    let executing = 0, lastPromise = undefined;
    const next = () => {
        executing--;
        if (queue.length > 0) {
            queue.shift()();
        } else {
            lastPromise = undefined;
        }
    };
    const run = function ({resolve, resolveWait}, args) {
        executing++;
        const promise = fn.apply(this, args);
        if (resolveWait) resolveWait(async () => promise);
        if (resolve) resolve(promise);
        promise.then(next, next);
    };
    const limited = function (...args) {
        lastPromise = new Promise(resolve => {
            if (executing < limit) {
                run.call(this, {resolve}, args);
            } else {
                queue.push(run.bind(this, {resolve}, args));
            }
        });
        return lastPromise;
    };
    
    limited.concurrency = () => executing;
    limited.queue = () => queue.length;
    limited.wait = async () => lastPromise && lastPromise.then(() => {}, () => {});
    limited.waitForCall = function (...args) {
        return new Promise(resolveWait => {
            if (executing < limit) {
                run.call(this, {resolveWait}, args);
            } else {
                queue.push(run.bind(this, {resolveWait}, args));
            }
        });
    }
    
    return limited;
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
