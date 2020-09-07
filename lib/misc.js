const {sleep} = require('./async');


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

function retry(fn, retry = 0, {
    delay = 0, delayRandomize = 0, retryDelayFactor = 1,
    catch: catch_ = () => {}
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

function timeout(fn, timeout, {error = () => new Error('ETIMEDOUT')} = {}) {
    return async function (...args) {
        return Promise.race([
            fn(...args),
            new Promise(((resolve, reject) => 
                setTimeout(() => reject(error()), timeout)))
        ]);
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
    ensureThunk,
    ensureThunkCall,
    ensureThunkSync,
    ensureThunkCallSync,
    retry,
    timeout,
    Cache,
};
