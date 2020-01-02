const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {promisify} = require('util');

const {get, isObject, isObjectLike, isPlainObject, isEmpty, escapeRegExp} = require('lodash');
const stableStringify = require('json-stable-stringify');
const request = require('request-promise-native');
const {RequestError} = require('request-promise-native/errors');


/**
 * @param ms {number}
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * @param filePath {string}
 * @returns {AsyncIterableIterator<string>}
 */
async function* walk(filePath) {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
        for (const file of await readdir(filePath)) {
            const subPath = path.join(filePath, file);
            yield* walk(subPath);
        }
    } else if (stats.isFile()) {
        yield filePath;
    }
}

function safeJSON(obj, invalidValue = null) {
    if (Array.isArray(obj)) {
        return obj.map(safeJSON);
    } else if (isObjectLike(obj)) {
        if (isPlainObject(obj)) {
            const ret = {};
            for (const [p, v] of Object.entries(obj)) {
                ret[p] = safeJSON(v);
            }
            return ret;
        } else {
            try {
                JSON.stringify(obj);
                return obj;
            } catch (e) {
                if (typeof invalidValue === 'function') {
                    return invalidValue(obj);
                } else {
                    return invalidValue;
                }
            }
        }
    } else {
        return obj;
    }
}

function clear(obj) {
    for (const property of Object.keys(obj)) {
        delete obj[property];
    }
    return obj;
}

function shrink(obj) {
    if (isPlainObject(obj)) {
        for (const [property, value] of Object.entries(obj)) {
            if (value === null || value === undefined) {
                delete obj[property];
            } else {
                shrink(value);
            }
        }
    }
    return obj;
}

function diff(old, new_) {
    const diff = {};
    shrink(old);
    shrink(new_);
    for (const [p, v] of Object.entries(new_)) {
        const oldV = old[p];
        if (deepEqual(oldV, v)) {
            continue;
        }
        diff[p] = v;
    }
    for (const p of Object.keys(old)) {
        if (new_[p] === undefined) {
            diff[p] = null;
        }
    }
    return diff;
}

function deepEqual(a, b) {
    if (a === b) return true;
    if (a === null && b === null) return true;
    if (a === undefined && b === undefined) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; ++i) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        return isEmpty(diff(a, b));
    }
    if (a instanceof Date && b instanceof Date && a.getTime() === b.getTime()) return true;
    if (isObjectLike(a) && typeof a.equals === 'function' && a.equals(b)) return true;
    return false;
}

function merge2Level(target, source = {}) {
    const ret = {...target};
    for (const [p, v] of Object.entries(source)) {
        ret[p] = {...ret[p], ...v};
    }
    return ret;
}

function flatten(obj, {delimiter = '.', prefix = ''} = {}) {
    if (!isPlainObject(obj)) {
        return obj;
    }
    const flat = {};

    function _flatten(prefix, obj) {
        for (const [p, v] of Object.entries(obj)) {
            const prop = `${prefix}${prefix ? delimiter : ''}${p}`;
            if (isPlainObject(v)) {
                _flatten(prop, v);
            } else {
                flat[prop] = v;
            }
        }
    }

    _flatten(prefix, obj);
    return flat;
}

function isThenable(obj) {
    return isObject(obj) && typeof obj.then === 'function' && obj.then.length === 2;
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max, maxInclusive = false) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + (maxInclusive ? 1 : 0))) + min;
}

function randomString(length, numberOnly = false) {
    let result = '';
    const characters = numberOnly ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function randomMacAddress() {
    return [
        0xf6, 0xf5, 0xdb,
        randomInt(0, 0x7f, true),
        randomInt(0, 0xff, true),
        randomInt(0, 0xff, true)
    ].map(v => `0${v.toString(16)}`.slice(-2)).join(':');
}

async function ensureThunk(value, ...args) {
    return typeof value === 'function' ? await value(...args) : value;
}

async function ensureThunkCall(value, this_, ...args) {
    return typeof value === 'function' ? await value.call(this_, ...args) : value;
}

function ensureThunkSync(value, ...args) {
    return typeof value === 'function' ? value(...args) : value;
}

function ensureThunkCallSync(value, this_, ...args) {
    return typeof value === 'function' ? value.call(this_, ...args) : value;
}

function dedup(fn, {key = (...args) => args, within = 0} = {}) {
    const states = {};
    if (!key) key = () => [];

    function purge(k) {
        const state = states[k];
        if (state && state.isResolved && state.createAt && state.createAt < Date.now() - within) {
            delete states[k];
        }
    }

    return async function (...args) {
        const k = stableStringify(key(...args));
        purge(k);
        const state = states[k] || {};
        states[k] = state;
        if (!state.createAt) {
            state.createAt = Date.now();
            state.promise = fn.apply(this, args);
        } else if (!state.promise) {
            throw new Error(`potential recursive call of a deduped async function ${fn.name}(${args.join(', ')})`);
        }
        const ret = await state.promise;
        state.isResolved = true;
        purge(k);
        return ret;
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

function retry(fn, retry = 0, {
    delay = 0, delayRandomize = 0, retryDelayFactor = 1, catch: catch_ = () => {
    }
} = {}) {
    let trial = 0;
    return async function (...args) {
        while (true) {
            if (trial >= retry) {
                return await fn.apply(this, args);
            } else {
                try {
                    return await fn.apply(this, args);
                } catch (e) {
                    await catch_(e);

                    const base = delay * Math.pow(retryDelayFactor, trial++);
                    const delayMin = base * (1 - delayRandomize);
                    const delayMax = base * (1 + delayRandomize);
                    delay = random(delayMin, delayMax);
                    if (delay > 0) {
                        await sleep(delay);
                    }
                }
            }
        }
    }
}

function requestWithTimeout(timeout, req) {
    req = req || request;
    return (...args) => {
        return Promise.race([
            req(...args),
            new Promise((resolve, reject) =>
                setTimeout(() => {
                    const e = new Error('ETIMEDOUT');
                    e.code = 'ETIMEDOUT';
                    e.connect = true;
                    reject(new RequestError(e));
                }, timeout))
        ]);
    }
}

function safeJSONStringify(obj, invalidValue = null) {
    return JSON.stringify(safeJSON(obj, invalidValue));
}


function stringify(...args) {
    return stringifyWith(args);
}

function stringifyWith(args, {delimiter = '', transform} = {}) {
    function _stringify(value) {
        if (transform) {
            value = transform(value);
        }
        if (value instanceof Error) {
            return errorToString(value);
        } else if (value instanceof Date) {
            return value.toLocaleString();
        } else if (typeof value === 'object' && ['url', 'headers', 'status', 'statusText'].every(p => typeof value[p] === 'function')) {
            return `${value.url()} -> [${value.status()}${value.statusText()}] ${_stringify(value.headers())}`;
        } else if (typeof value === 'object') {
            return safeJSONStringify(value, (v) => v.toString());
        } else if (value === undefined || value === null) {
            return '';
        } else {
            return value.toString();
        }
    }

    return args.map(_stringify).join(delimiter);
}

function errorToString(err) {
    let str = `${err.name ? `${err.name}: ` : ''}${err.code ? `[${err.code}] ` : ''}`;
    const graphqlErrs = get(err, ['networkError', 'result', 'errors'], []);
    if (graphqlErrs.length > 0) {
        str += `${err.message} - ${graphqlErrs.map(e => `[${e.extensions.code}] ${e.message}`).join(' - ')}`;
    } else {
        str += err.message;
        if (err.stack) {
            str += `${err.stack.slice(err.stack.indexOf('\n'))}\n`;
        }
    }
    return str;
}

function replaceAll(str, mapping) {
    const re = new RegExp(Object.keys(mapping).map(escapeRegExp).join('|'), 'g');
    return str.replace(re, (matched) => mapping[matched]);
}

function input(question = '') {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin, output: process.stdout
        });
        rl.question(question, (answer) => {
            resolve(answer);
            rl.close();
        });
    });
}


class BatchLoader {
    constructor(fn, options = {}) {
        this.fn = fn;
        this.options = options;
        this.options.maxSize = this.options.maxSize || Number.MAX_SAFE_INTEGER;
        this.options.maxWait = this.options.maxWait || 0;

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
                    resolve(results[i]);
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


class Cache {

    /**
     * @param {Object} [options]
     * @param {number} [options.ttl] - TTL in milliseconds
     * @param {number} [options.maxSize]
     */
    constructor(options = {}) {
        this.options = options;
        this.store = {};
        this.queue = [];

        this._expireTimer = undefined;
    }

    /**
     * @param {string} key
     * @param {*} value
     */
    put(key, value) {
        if (key in this.store) {
            this.store[key] = value;
            const index = this.queue.findIndex(e => e.key === key);
            const [entry] = this.queue.splice(index, 1);
            entry.value = value;
            entry.ts = Date.now();
            this.queue.push(entry);
            if (index === 0) {
                this._expire();
            }
        } else {
            if (this.queue.length >= this.options.maxSize) {
                const {key} = this.queue.shift();
                delete this.store[key];
                this._expire();
            }
            this.store[key] = value;
            this.queue.push({key, value, ts: Date.now()});
            if (this.queue.length === 1) {
                this._expire();
            }
        }
    }

    /**
     * @param {string} key
     * @return {*}
     */
    get(key) {
        return this.store[key];
    }

    _expire() {
        if (this.queue.length <= 0) return;
        const {ttl} = this.options;
        if (!ttl) return;
        if (this._expireTimer) {
            clearTimeout(this._expireTimer);
        }
        const [{ts}] = this.queue;
        this._expireTimer = setTimeout(() => {
            const {key} = this.queue.shift();
            delete this.store[key];
            this._expireTimer = undefined;
            this._expire();
        }, ts + ttl - Date.now());
    }

}


module.exports = {
    sleep,
    walk,
    safeJSON,
    safeJSONStringify,
    clear,
    shrink,
    diff,
    deepEqual,
    merge2Level,
    flatten,
    isThenable,
    random,
    randomInt,
    randomString,
    randomMacAddress,
    ensureThunk,
    ensureThunkCall,
    ensureThunkSync,
    ensureThunkCallSync,
    dedup,
    limit,
    retry,
    requestWithTimeout,
    stringify,
    stringifyWith,
    errorToString,
    replaceAll,
    input,
    BatchLoader,
    Cache,
};