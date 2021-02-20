"use strict";

const isObject = require('lodash/isObject');
const isObjectLike = require('lodash/isObjectLike');
const isPlainObject = require('lodash/isPlainObject');
const isEqualWith = require('lodash/isEqualWith');
const mapValues = require('lodash/mapValues');


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

function shrink(obj, {inplace = true, predicate = (v) => v != null} = {}) {
    if (isPlainObject(obj)) {
        if (inplace) {
            for (const [property, value] of Object.entries(obj)) {
                shrink(value, {inplace, predicate});
                if (!predicate(value)) {
                    delete obj[property];
                }
            }
        } else {
            return Object.fromEntries(
                Object.entries(obj)
                    .map(([p, v]) => [p, shrink(v, {inplace, predicate})])
                    .filter(([, v]) => predicate(v))
            );
        }
    }
    return obj;
}

function diff(old, new_, {recursive = false} = {}) {
    if (isPlainObject(old) && isPlainObject(new_)) {
        const ret = {};
        for (const [p, v] of Object.entries(new_)) {
            if (p in old) {
                const oldV = old[p];
                if (isEqual(oldV, v)) {
                    continue;
                }
                if (recursive) {
                    ret[p] = diff(oldV, v);
                } else {
                    ret[p] = v;
                }
            } else {
                ret[p] = v;
            }
        }
        for (const p of Object.keys(old)) {
            if (!(p in new_)) {
                ret[p] = undefined;
            }
        }
        return ret;
    } else if (isEqual(old, new_)) {
        return null;
    } else {
        return new_;
    }
}

function* traverse(obj) {
    function* _traverse(obj, prefix) {
        if (isPlainObject(obj)) {
            for (const [p, v] of Object.entries(obj)) {
                if (isPlainObject(v)) {
                    yield* _traverse(v, [...prefix, p]);
                } else {
                    yield [[...prefix, p], v];
                }
            }
        }
    }
    
    yield* _traverse(obj, []);
}

function isEqual(a, b) {
    return isEqualWith(a, b, (x, y) => {
        if (isObjectLike(x) && typeof x.equals === 'function' && x.equals(y)) return true;
    });
}

function isMatch(obj, pattern, {predicate} = {}) {
    if (!predicate) {
        predicate = (ov, pv) => {
            if (pv === null) return ov == null;
            return isEqual(ov, pv);
        }
    }
    if (isPlainObject(obj) && isPlainObject(pattern)) {
        for (const [p, v] of Object.entries(pattern)) {
            if (!isMatch(obj[p], v)) return false;
        }
        return true;
    } else {
        return predicate(obj, pattern);
    }
}

function merge(a, b, {inplace = true, depth = Infinity} = {}) {
    if (isPlainObject(a) && isPlainObject(b) && depth >= 0) {
        const merged = inplace ? a : {...a};
        for (const [p, v] of Object.entries(b)) {
            merged[p] = merge(merged[p], v, {inplace, depth: depth - 1});
        }
        return merged;
    } else {
        return b;
    }
}

function flatten(obj, {delimiter = '.', prefix = ''} = {}) {
    if (!isPlainObject(obj)) {
        return obj;
    }
    const flat = {};
    for (const [path, v] of traverse(obj)) {
        const prop = [prefix, ...path].filter(p => p).join(delimiter);
        flat[prop] = v;
    }
    return flat;
}

function clone(obj, {depth = Infinity}) {
    if (!(depth >= 0)) {
        return obj;
    } else if (Array.isArray(obj)) {
        return obj.map(v => clone(v, {depth: depth - 1}));
    } else if (isPlainObject(obj)) {
        return mapValues(obj, v => clone(v, {depth: depth - 1}));
    } else {
        return obj;
    }
}

function freeze(obj, {depth = Infinity} = {}) {
    if (!(depth >= 0)) {
        return obj;
    } else if (Array.isArray(obj)) {
        Object.freeze(obj);
        obj.forEach(v => freeze(v, {depth: depth - 1}));
    } else if (isPlainObject(obj)) {
        Object.freeze(obj);
        for (const v of Object.values(obj)) {
            freeze(v, {depth: depth - 1});
        }
    }
    return obj;
}

function stablize(obj, {cmp, depth = Infinity}) {
    if (!(depth >= 0)) {
        return obj;
    } else if (Array.isArray(obj)) {
        return obj.map(o => stablize(o, {cmp, depth: depth - 1}));
    } else if (isPlainObject(obj)) {
        const keys = Object.keys(obj);
        keys.sort(cmp);
        const stable = {};
        for (const key of keys) {
            stable[key] = stablize(obj[key], {cmp, depth: depth - 1});
        }
        return stable;
    } else {
        return obj;
    }
}

function readOnly(obj, errType = Error) {
    return new Proxy(obj, {
        get(target, p) {
            let v = target[p];
            if (typeof v === 'function') v = v.bind(target);
            if (isObject(v)) {
                return readOnly(v);
            } else {
                return v;
            }
        },
        set() {
            throw new errType('this object is read only');
        },
    });
}

function biMapObject(obj) {
    const biMap = new Proxy({}, {
        set(target, p, value, receiver) {
            if (typeof value !== 'string') {
                throw new Error(`value must be a string in biMap object, got ${value}`);
            }
            const oldValue = Reflect.get(target, p, receiver);
            if (oldValue != null && oldValue !== value) {
                const oldValue = Reflect.get(target, p, receiver);
                Reflect.deleteProperty(target, oldValue);
            }
            const existingValue = Reflect.get(target, value, receiver);
            if (existingValue != null) {
                Reflect.deleteProperty(target, value);
                Reflect.deleteProperty(target, existingValue);
            }
            Reflect.set(target, value, p, receiver);
            return Reflect.set(target, p, value, receiver);
        },
        deleteProperty(target, p) {
            const value = Reflect.get(target, p);
            Reflect.deleteProperty(target, value);
            return Reflect.deleteProperty(target, p);
        },
    });
    if (obj) {
        for (const [p, v] of Object.entries(obj)) {
            biMap[p] = v;
        }
    }
    return biMap;
}


module.exports = {
    safeJSON,
    clear,
    shrink,
    diff,
    traverse,
    isEqual,
    isMatch,
    merge,
    flatten,
    clone,
    freeze,
    stablize,
    readOnly,
    biMapObject,
};
