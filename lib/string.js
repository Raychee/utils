"use strict";

const get = require('lodash/get');
const isPlainObject = require('lodash/isPlainObject');
const mapValues = require('lodash/mapValues');
const escapeRegExp = require('lodash/escapeRegExp');
const {safeJSON, freeze} = require('./object');


function safeJSONStringify(obj, invalidValue = null) {
    return JSON.stringify(safeJSON(obj, invalidValue));
}

function stableJSONStringify(value, {cmp, circularValue, transform} = {}) {
    const compareFn = cmp && (function (cmp) {
        return function (node) {
            return function (a, b) {
                return cmp({key: a, value: node[a]}, {key: b, value: node[b]});
            };
        };
    })(cmp);
    const seen = [];
    
    function stringify(node) {
        if (transform) {
            node = transform(node);
        }
        if (node && node.toJSON && typeof node.toJSON === 'function') {
            node = node.toJSON();
        }
        if (node === undefined) return;
        if (node === null) return 'null';
        if (typeof node === 'number') return isFinite(node) ? '' + node : 'null';
        if (typeof node !== 'object') return JSON.stringify(node);
        let i, out;
        if (Array.isArray(node)) {
            out = '[';
            for (i = 0; i < node.length; i++) {
                if (i) out += ',';
                out += stringify(node[i]) || 'null';
            }
            return out + ']';
        }
        if (seen.includes(node)) {
            if (circularValue) return JSON.stringify(circularValue);
            throw new TypeError('Converting circular structure to JSON');
        }
        const seenIndex = seen.push(node) - 1;
        const keys = Object.keys(node).sort(compareFn && compareFn(node));
        out = '{';
        for (i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = stringify(node[key]);
            if (!value) continue;
            if (out !== '{') out += ',';
            out += JSON.stringify(key) + ':' + value;
        }
        seen.splice(seenIndex, 1);
        return out + '}';
    }
    
    return stringify(value);
}


function stringify(...args) {
    return stringifyWith(args);
}

function stringifyWith(args, {delimiter = '', transform} = {}) {
    function _stringify(value) {
        if (transform) {
            value = transform(value);
        }
        if (value === undefined || value === null) {
            return '';
        } else if (value instanceof Error) {
            return errorToString(value);
        } else if (value instanceof Date) {
            return value.toLocaleString();
        } else if (typeof value === 'object' && ['url', 'headers', 'status', 'statusText'].every(p => typeof value[p] === 'function')) {
            return `${value.url()} -> [${value.status()}${value.statusText()}] ${_stringify(value.headers())}`;
        } else if (typeof value === 'object') {
            return safeJSONStringify(value, (v) => v.toString());
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

function truncate(str, {maxLength = Infinity, ellipsis = '...', pos = 'middle'} = {}) {
    if (str.length <= maxLength) {
        return str;
    }
    if (pos === 'start') {
        const ellipsisLength = ellipsis.length + 1;
        if (ellipsisLength >= maxLength) return ellipsis.length < str.length ? ellipsis : str;
        return `${ellipsis} ${str.slice(ellipsisLength - maxLength)}`;
    } else if (pos === 'middle') {
        const ellipsisLength = ellipsis.length + 2;
        if (ellipsisLength >= maxLength) return ellipsis.length < str.length ? ellipsis : str;
        const firstHalfLength = Math.ceil((maxLength - ellipsisLength) / 2);
        const lastHalfLength = maxLength - firstHalfLength - ellipsisLength;
        const lastHalf = lastHalfLength <= 0 ? '' : ' ' + str.slice(-lastHalfLength);
        return `${str.slice(0, firstHalfLength)} ${ellipsis}${lastHalf}`;
    } else if (pos === 'end') {
        const ellipsisLength = ellipsis.length + 1;
        if (ellipsisLength >= maxLength) return ellipsis.length < str.length ? ellipsis : str;
        return `${str.slice(0, maxLength - ellipsisLength)} ${ellipsis}`;
    } else {
        throw new Error(`unknown "pos" for truncate(): ${pos}`);
    }
}

function format(
    template, env, 
    {
        throwErrorForMissingProperty = false, 
        defaultPropertyValue = undefined,
        keepOriginalValueForSingleExpr = false,
    } = {}
) {
    function evaluateValue(expr, env) {
        const entries = Object.entries(env);
        const keys = entries.map(([k]) => k);
        const values = entries.map(([, v]) => v);
        const fn = new Function(...keys, `return ${expr};`);
        return fn.apply({}, values);
    }
    function makeDefaultValueObject(env) {
        if (Array.isArray(env)) {
            const arr = env.map(makeDefaultValueObject);
            return wrapDefaultValueObject(arr);
        } else if (isPlainObject(env)) {
            const obj = mapValues(env, makeDefaultValueObject);
            return wrapDefaultValueObject(obj);
        } else {
            return env;
        }
    }
    function wrapDefaultValueObject(obj) {
        return new Proxy(obj, {
            get(target, p, receiver) {
                if (typeof p === 'string' && !(p in target)) {
                    if (throwErrorForMissingProperty) {
                        throw new ReferenceError(`${p} is not defined`);
                    } else if (defaultPropertyValue !== undefined) {
                        return defaultPropertyValue;
                    }
                }
                return Reflect.get(target, p, receiver);
            }
        });
    }
    
    env = freeze(makeDefaultValueObject(env));
    if (keepOriginalValueForSingleExpr && template.startsWith('${') && template.endsWith('}')) {
        const pureExpr = template.slice(2, -1);
        if (!pureExpr.includes('${') && !pureExpr.includes('}')) {
            return evaluateValue(pureExpr, env);
        }
    }
    return template.replace(/\$\{(.+?)\}/g, (_, expr) => evaluateValue(expr, env));
}


module.exports = {
    safeJSONStringify,
    stableJSONStringify,
    stringify,
    stringifyWith,
    errorToString,
    replaceAll,
    capitalize,
    truncate,
    format,
};
