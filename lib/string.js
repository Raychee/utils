const {get, escapeRegExp} = require('lodash');
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

function capitalize(str) {
    return `${str[0].toUpperCase()}${str.slice(1)}`;
}

function interpolate(template, variables, {defaultValue} = {}) {
    const args = {};
    for (const match of template.matchAll(/\$\{(.+?)\}/g)) {
        const name = match[1];
        if (name in variables) {
            args[name] = variables[name];
        } else {
            args[name] = defaultValue;
        }
    }
    const entries = Object.entries(args);
    const keys = entries.map(([k]) => k);
    const values = entries.map(([, v]) => v);
    return new Function(...keys, `return \`${template}\`;`)(...values);
}


module.exports = {
    safeJSONStringify,
    stringify,
    stringifyWith,
    errorToString,
    replaceAll,
    capitalize,
    interpolate,
};
