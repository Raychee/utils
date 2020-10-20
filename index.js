const {
    sleep,
    isThenable,
    dedup,
    limit,
    BatchLoader,
    Runnable,
} = require('./lib/async');

const {
    safeJSON,
    clear,
    shrink,
    diff,
    traverse,
    isEqual,
    isMatch,
    merge,
    flatten,
    readOnly,
} = require('./lib/object');

const {
    safeJSONStringify,
    stringify,
    stringifyWith,
    errorToString,
    replaceAll,
} = require('./lib/string');

const {
    random,
    randomInt,
    randomString,
    randomMacAddress,
    unionRanges,
    intersectRanges,
} = require('./lib/math');

const {
    ensureThunk,
    ensureThunkCall,
    ensureThunkSync,
    ensureThunkCallSync,
    retry,
    timeout,
    Cache,
} = require('./lib/misc');


module.exports = {
    sleep,
    isThenable,
    dedup,
    limit,
    BatchLoader,
    Runnable,

    safeJSON,
    clear,
    shrink,
    diff,
    traverse,
    isEqual,
    isMatch,
    merge,
    flatten,
    readOnly,

    safeJSONStringify,
    stringify,
    stringifyWith,
    errorToString,
    replaceAll,

    random,
    randomInt,
    randomString,
    randomMacAddress,
    unionRanges,
    intersectRanges,
    
    ensureThunk,
    ensureThunkCall,
    ensureThunkSync,
    ensureThunkCallSync,
    retry,
    timeout,
    Cache,
};
