const {isObject, isObjectLike, isPlainObject, isEqualWith} = require('lodash');


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

function shrink(obj, {inplace = true} = {}) {
    if (isPlainObject(obj)) {
        if (inplace) {
            for (const [property, value] of Object.entries(obj)) {
                if (value == null) {
                    delete obj[property];
                } else {
                    shrink(value, {inplace});
                }
            }
        } else {
            return Object.fromEntries(
                Object.entries(obj)
                    .filter(([, v]) => v != null)
                    .map(([p, v]) => [p, shrink(v, {inplace})])
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
                if (deepEqual(oldV, v)) {
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
    } else if (deepEqual(old, new_)) {
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
                    for (const r of _traverse(v, [...prefix, p])) {
                        yield r;
                    }
                } else {
                    yield [[...prefix, p], v];
                }
            }
        }
    }
    for (const r of _traverse(obj, [])) {
        yield r;
    } 
}

function deepEqual(a, b) {
    return isEqualWith(a, b, (x, y) => {
        if (isObjectLike(x) && typeof x.equals === 'function' && x.equals(y)) return true;
    });
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
    for (const [path, v] of traverse(obj)) {
        const prop = [prefix, ...path].filter(p => p).join(delimiter);
        flat[prop] = v;
    }
    return flat;
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


module.exports = {
    safeJSON,
    clear,
    shrink,
    diff,
    traverse,
    deepEqual,
    merge2Level,
    flatten,
    readOnly,
};
