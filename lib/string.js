const {escapeRegExp} = require('lodash');
const {safeJSON} = require('./object');


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


module.exports = {
    safeJSONStringify,
    stringify,
    stringifyWith,
    errorToString,
    replaceAll,
};