"use strict";


const {isPlainObject, isEmpty} = require('lodash');

const {
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
    clone,
    freeze,
    stablize,
    readOnly,
    biMapObject,

    safeJSONStringify,
    stableJSONStringify,
    stringify,
    stringifyWith,
    errorToString,
    replaceAll,
    capitalize,
    truncate,
    format,

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
} = require('.');


describe('test', () => {

    test('shrink', () => {
        let o = {a: 1, b: {c: null, d: undefined, e: [null, 1], f: {g: 3, h: undefined}}, i: {j: null}};
        expect(shrink(o, {inplace: false})).toStrictEqual(
            {a: 1, b: {e: [null, 1], f: {g: 3}}, i: {}}
        );
        expect(o).toStrictEqual(
            {a: 1, b: {c: null, d: undefined, e: [null, 1], f: {g: 3, h: undefined}}, i: {j: null}}
        );
        expect(shrink(o, {inplace: true})).toStrictEqual(
            {a: 1, b: {e: [null, 1], f: {g: 3}}, i: {}}
        );
        expect(o).toStrictEqual(
            {a: 1, b: {e: [null, 1], f: {g: 3}}, i: {}}
        );

        o = {a: 1, b: {c: null, d: undefined, e: [null, 1], f: {g: 3, h: undefined}}, i: {j: null}};
        expect(shrink(o, {predicate: v => v === 1})).toStrictEqual({a: 1});
        
        expect(shrink({a: {b: {}}}, {inplace: true, predicate: (v) => !(isPlainObject(v) && isEmpty(v))})).toStrictEqual({});
        expect(shrink({a: {b: {}}}, {inplace: false, predicate: (v) => !(isPlainObject(v) && isEmpty(v))})).toStrictEqual({});
        
    });

    test('diff', () => {
        let d = diff(
            {a: 1, b: 2, c: {d: 3, e: [4, 5], f: 6, g: {x: 7}}},
            {a: 1, b: 3, c: {d: 4, e: [5], f: 6, g: {x: 7}}},
        );
        expect(d).toStrictEqual({b: 3, c: {d: 4, e: [5], f: 6, g: {x: 7}}});

        d = diff(
            {a: 1, b: 2, c: {d: 3, e: [4, 5], f: 6, g: {x: 7}}},
            {a: 1, b: 3, c: {d: 4, e: [5], f: 6, g: {x: 7}}},
            {recursive: true}
        );
        expect(d).toStrictEqual({b: 3, c: {d: 4, e: [5]}});
    });

    test('traverse', () => {
        let o = {a: 1, b: 2, c: {d: '3', e: [4, 5], f: new Date(0)}};
        const traversed = [...traverse(o)];
        expect(traversed).toStrictEqual([
            [['a'], 1],
            [['b'], 2],
            [['c', 'd'], '3'],
            [['c', 'e'], [4, 5]],
            [['c', 'f'], new Date(0)],
        ]);
    });

    test('isMatch', () => {
        expect(isMatch(
            {a: 1, b: 2, c: {d: '3', e: [4, 5], f: new Date(0)}},
            {a: 1, c: {e: [4, 5], f: new Date(0)}},
        )).toBe(true);
        expect(isMatch(
            {a: 1, b: 2, c: {d: '3', e: [4, 5], f: new Date(0)}},
            {a: 100, c: {e: [4, 5], f: new Date(0)}},
        )).toBe(false);
        expect(isMatch(
            {a: 1, b: 2, c: {d: '3', e: [4, 5], f: new Date(0)}},
            {c: {e: [4, 6]}},
        )).toBe(false);
        expect(isMatch(
            {a: 1, b: 2, c: {d: '3', e: [4, 5], f: new Date(0)}},
            {c: {f: new Date(1)}},
        )).toBe(false);
        expect(isMatch(
            {a: 1, b: 2, c: {d: '3', e: [4, 5], f: new Date(0)}},
            {a: 1, c: {e: [4, 5], f: new Date(0), x: null}, y: null},
        )).toBe(true);
    });

    test('merge', () => {
        let a = {a: 1, b: 2, c: {d: '3', e: [4], f: new Date(0), g: {h: '10'}}};
        let b = {a: 2, g: 9, c: {e: [4, 5], f: new Date(1), g: {i: '11'}}};
        
        expect(merge(a, b, {inplace: false, depth: 0})).toStrictEqual(
            {a: 2, b: 2, g: 9, c: {e: [4, 5], f: new Date(1), g: {i: '11'}}}
        );
        expect(merge(a, b, {inplace: false, depth: 1})).toStrictEqual(
            {a: 2, b: 2, g: 9, c: {d: '3', e: [4, 5], f: new Date(1), g: {i: '11'}}}
        );
        expect(merge(a, b, {inplace: false, depth: 2})).toStrictEqual(
            {a: 2, b: 2, g: 9, c: {d: '3', e: [4, 5], f: new Date(1), g: {h: '10', i: '11'}}}
        );
        expect(a).toStrictEqual({a: 1, b: 2, c: {d: '3', e: [4], f: new Date(0), g: {h: '10'}}});


        a = {a: 1, b: 2, c: {d: '3', e: [4], f: new Date(0), g: {h: '10'}}};
        expect(merge(a, b, {inplace: true, depth: 0})).toStrictEqual(
            {a: 2, b: 2, g: 9, c: {e: [4, 5], f: new Date(1), g: {i: '11'}}}
        );
        expect(a).toStrictEqual({a: 2, b: 2, g: 9, c: {e: [4, 5], f: new Date(1), g: {i: '11'}}});
        
        a = {a: 1, b: 2, c: {d: '3', e: [4], f: new Date(0), g: {h: '10'}}};
        expect(merge(a, b, {inplace: true, depth: 1})).toStrictEqual(
            {a: 2, b: 2, g: 9, c: {d: '3', e: [4, 5], f: new Date(1), g: {i: '11'}}}
        );
        expect(a).toStrictEqual({a: 2, b: 2, g: 9, c: {d: '3', e: [4, 5], f: new Date(1), g: {i: '11'}}});

        a = {a: 1, b: 2, c: {d: '3', e: [4], f: new Date(0), g: {h: '10'}}};
        expect(merge(a, b, {inplace: true, depth: 2})).toStrictEqual(
            {a: 2, b: 2, g: 9, c: {d: '3', e: [4, 5], f: new Date(1), g: {h: '10', i: '11'}}}
        );
        expect(a).toStrictEqual({a: 2, b: 2, g: 9, c: {d: '3', e: [4, 5], f: new Date(1), g: {h: '10', i: '11'}}});
    });
    
    test('flatten', () => {
        let o = {a: 1, b: 2, c: {d: '3', e: [4, 5], f: new Date(0)}};
        expect(flatten(o)).toStrictEqual({
            'a': 1,
            'b': 2,
            'c.d': '3',
            'c.e': [4, 5],
            'c.f': new Date(0)
        });
    });

    test('dedup', async () => {

        let concurrency, maxConcurrency, v1, v2, v3, ps, vs, fn, i, j, t;
        
        i = 0;
        let this_ = {x: 0};
        fn = dedup(async function () {
            await sleep(10);
            this.x++;
            return i++;
        });
        ps = [fn.call(this_), fn.call(this_)];
        await sleep(1);
        expect(fn.state()).toMatchObject({queue: 0});
        expect(fn.state().running).toBeDefined();
        await expect(fn.wait()).resolves.toBeUndefined();
        t = Date.now();
        [v1, v2] = await Promise.all(ps);
        expect(Date.now()).toBeLessThanOrEqual(t + 5);
        expect(v1).toBe(0);
        expect(v2).toBe(0);
        expect(i).toBe(1);
        expect(this_.x).toBe(1);
        expect(fn.state()).toStrictEqual({queue: 0});

        fn = dedup(async (i) => {
            await sleep(0);
            return i;
        });
        [v1, v2] = await Promise.all([fn(1), fn(2)]);
        expect(v1).toBe(1);
        expect(v2).toBe(2);
        expect(fn.state()).toStrictEqual({queue: 0});

        fn = dedup(async (i) => {
            await sleep(0);
            return i;
        }, {key: null});
        [v1, v2] = await Promise.all([fn(1), fn(2)]);
        expect(v1).toBe(1);
        expect(v2).toBe(1);
        expect(fn.state()).toStrictEqual({queue: 0});

        i = 0;
        fn = dedup(async () => {
            await sleep(0);
            return i++;
        }, {within: 100});
        v1 = await fn();
        expect(v1).toBe(0);
        expect(i).toBe(1);
        await sleep(10);
        v1 = await fn();
        expect(v1).toBe(0);
        expect(i).toBe(1);
        await sleep(200);
        v1 = await fn();
        expect(v1).toBe(1);
        expect(i).toBe(2);
        await sleep(200);
        expect(fn.state()).toStrictEqual({queue: 0});

        i = 0;
        fn = dedup(async () => {
            await sleep(0);
            throw new Error((i++).toString());
        });
        await expect(fn()).rejects.toThrow('0');
        await expect(fn()).rejects.toThrow('1');
        expect(fn.state()).toStrictEqual({queue: 0});

        fn = dedup(async (i) => {
            await sleep(0);
            return i + 1;
        }, {key: (i) => i % 2});
        [v1, v2, v3] = await Promise.all([fn(0), fn(1), fn(2)]);
        expect(v1).toBe(1);
        expect(v2).toBe(2);
        expect(v3).toBe(1);
        expect(fn.state()).toStrictEqual({queue: 0});
        
        i = 0; j = 0; concurrency = 0; maxConcurrency = 0;
        fn = dedup(async (x) => {
            await sleep(0);
            if (x === 'i') {
                return i++;
            } else if (x === 'j') {
                concurrency++;
                if (maxConcurrency < concurrency) maxConcurrency = concurrency;
                await sleep(10);
                concurrency--;
                return j++;
            }
        }, {queue: 1});
        ps = [fn('i'), fn('i'), fn('i'), fn('j'), fn('j'), fn('j'), fn('j')];
        await sleep(9);
        expect(fn.state('i')).toStrictEqual({queue: 0});
        expect(fn.state('i').running).toBeUndefined();
        expect(fn.state('j')).toMatchObject({queue: 1});
        expect(fn.state('j').running).toBeDefined();
        await expect(fn.wait('j')).resolves.toBeUndefined();
        t = Date.now();
        vs = await Promise.all(ps);
        expect(Date.now()).toBeLessThanOrEqual(t + 5);
        expect(vs[0]).toBe(0);
        expect(vs[1]).toBe(1);
        expect(vs[2]).toBe(1);
        expect(vs[3]).toBe(0);
        expect(vs[4]).toBe(1);
        expect(vs[5]).toBe(1);
        expect(vs[6]).toBe(1);
        expect(maxConcurrency).toBe(1);
        expect(fn.state('j')).toStrictEqual({queue: 0});
        await expect(fn('j')).resolves.toBe(2);
        await expect(fn('j')).resolves.toBe(3);
        await expect(fn.wait()).resolves.toBeUndefined();
        
        ps = []; 
        j = 0;
        for (let i = 0; i < 10000; i++) {
            ps.push(fn('j'));
        }
        await expect(ps[0]).resolves.toBe(0);
        await expect(ps[1]).resolves.toBe(1);
        await expect(ps[2]).resolves.toBe(1);
        expect(j).toBe(2);
        ps = [];
        for (let i = 0; i < 10000; i++) {
            ps.push(fn('j'));
        }
        await expect(ps[0]).resolves.toBe(2);
        await expect(ps[1]).resolves.toBe(3);
        await expect(ps[2]).resolves.toBe(3);
        expect(j).toBe(4);
        
        fn = dedup(async () => {
            await sleep(0);
            throw new Error('dedup fn error');
        });
        expect(fn()).rejects.toThrow('dedup fn error');

        i = 0; j = 0; concurrency = 0; maxConcurrency = 0;
        fn = dedup(async (i) => {
            concurrency++;
            if (maxConcurrency < concurrency) maxConcurrency = concurrency;
            await sleep(10);
            concurrency--;
            return i;
        }, {within: 100, queue: 1, key: null, debug: true});
        ps = [fn(1), fn(2), fn(3), fn(4)];
        t = Date.now();
        await expect(ps[0]).resolves.toBe(1);
        expect(Date.now()).toBeLessThanOrEqual(t + 20);
        t = Date.now();
        await expect(ps[1]).resolves.toBe(2);
        expect(Date.now()).toBeGreaterThanOrEqual(t + 100);
        expect(Date.now()).toBeLessThanOrEqual(t + 120);
        t = Date.now();
        await expect(ps[2]).resolves.toBe(2);
        expect(Date.now()).toBeLessThanOrEqual(t + 5);
        t = Date.now();
        await expect(ps[3]).resolves.toBe(2);
        expect(Date.now()).toBeLessThanOrEqual(t + 5);
        
    });
    
    test('limit', async () => {
        let concurrency, maxConcurrency, fn, ps, vs, t;
        
        concurrency = 0; maxConcurrency = 0;
        fn = limit(async (x) => {
            concurrency++;
            if (maxConcurrency < concurrency) maxConcurrency = concurrency;
            await sleep(100);
            concurrency--;
            return x + 1;
        }, 2);
        ps = [fn(0), fn(1), fn(2), fn(3)];
        await sleep(0);
        expect(fn.concurrency()).toBe(2);
        expect(fn.queue()).toBe(2);
        await expect(fn.wait()).resolves.toBeUndefined();
        t = Date.now();
        vs = await Promise.all(ps);
        expect(Date.now()).toBeLessThanOrEqual(t + 5);
        expect(vs[0]).toBe(1);
        expect(vs[1]).toBe(2);
        expect(vs[2]).toBe(3);
        expect(vs[3]).toBe(4);
        expect(maxConcurrency).toBe(2);
        
        ps = [];
        t = Date.now();
        ps.push(await fn.waitForCall(4));
        expect(Date.now()).toBeLessThanOrEqual(t + 5);
        t = Date.now();
        ps.push(await fn.waitForCall(5));
        expect(Date.now()).toBeLessThanOrEqual(t + 5);
        t = Date.now();
        ps.push(await fn.waitForCall(6));
        expect(Date.now()).toBeGreaterThan(t + 80);
        t = Date.now();
        expect(await ps[0]()).toBe(5);
        expect(Date.now()).toBeLessThanOrEqual(t + 5);
        t = Date.now();
        expect(await ps[1]()).toBe(6);
        expect(Date.now()).toBeLessThanOrEqual(t + 5);
        t = Date.now();
        expect(await ps[2]()).toBe(7);
        expect(Date.now()).toBeGreaterThan(t + 80);
    });

    test('freeze', () => {

        const obj = freeze({
            a: 1, b: {c: 2, d: [3, 4, 'abc', {f: 5}]}, e: function () {
                return this.a;
            }
        });
        expect(obj.a).toBe(1);
        expect(() => obj.a = 3).toThrow(TypeError);
        expect(obj.b.c).toBe(2);
        expect(() => obj.b.d.push(5)).toThrow(TypeError);
        expect(() => obj.b.d = 5).toThrow(TypeError);
        expect(() => obj.b.d[3].f = 6).toThrow(TypeError);
        expect(obj.e()).toBe(1);

    });

    test('readOnly', () => {

        const obj = readOnly({
            a: 1, b: {c: 2, d: [3, 4, 'abc']}, e: function () {
                return this.a;
            }
        });
        expect(obj.a).toBe(1);
        expect(() => obj.a = 3).toThrow('this object is read only');
        expect(obj.b.c).toBe(2);
        expect(() => obj.b.d = 5).toThrow('this object is read only');
        expect(obj.e()).toBe(1);
        expect(() => obj.e.name = 'newName').toThrow('this object is read only');

    });
    
    test('biMapObject', () => {
        
        const obj = biMapObject({a: 'b', c: 'd'});
        expect(obj).toStrictEqual({a: 'b', b: 'a', c: 'd', d: 'c'});
        expect(() => obj.x = 1).toThrow('value must be a string in biMap object, got 1');
        obj.x = 'y';
        expect(obj).toStrictEqual({a: 'b', b: 'a', c: 'd', d: 'c', x: 'y', y: 'x'});
        obj.p = 'y';
        expect(obj).toStrictEqual({a: 'b', b: 'a', c: 'd', d: 'c', p: 'y', y: 'p'});
        obj.a = 'c';
        expect(obj).toStrictEqual({a: 'c', c: 'a', p: 'y', y: 'p'});
        delete obj.c;
        expect(obj).toStrictEqual({p: 'y', y: 'p'});
    });
    
    test('stableStringify', () => {
        expect(stableJSONStringify({c: 1, b: {arr: ['a', 'c', {x: null, d: 3, y: undefined}]}}))
            .toBe('{"b":{"arr":["a","c",{"d":3,"x":null}]},"c":1}');
        const circular = {a: 1};
        circular.cir = circular;
        expect(() => stableJSONStringify(circular)).toThrow(TypeError);
        expect(stableJSONStringify(circular, {circularValue: 'circular'}))
            .toBe('{"a":1,"cir":"circular"}')
        expect(stableJSONStringify(
            {f: () => 'haha', a: 1},
            {transform: (v) => typeof v === 'function' ? v.toString() : v}
        )).toBe('{"a":1,"f":"() => \'haha\'"}');
    });
    
    test('truncate', () => {
        
        expect(truncate('abcdefghi', {maxLength: 4, pos: 'start'})).toBe('...');
        expect(truncate('abcdefghi', {maxLength: 5, pos: 'start'})).toBe('... i');
        expect(truncate('abcdefghi', {maxLength: 6, pos: 'start'})).toBe('... hi');
        expect(truncate('abcdefghi', {maxLength: 5, pos: 'middle'})).toBe('...');
        expect(truncate('abcdefghi', {maxLength: 6, pos: 'middle'})).toBe('a ...');
        expect(truncate('abcdefghi', {maxLength: 7, pos: 'middle'})).toBe('a ... i');
        expect(truncate('abcdefghi', {maxLength: 8, pos: 'middle'})).toBe('ab ... i');
        expect(truncate('abcdefghi', {maxLength: 4, pos: 'end'})).toBe('...');
        expect(truncate('abcdefghi', {maxLength: 5, pos: 'end'})).toBe('a ...');
        expect(truncate('abcdefghi', {maxLength: 7, pos: 'end'})).toBe('abc ...');
        expect(truncate('abcd', {maxLength: 3, ellipsis: '....', pos: 'start'})).toBe('abcd');
        
    });
    
    test('format', () => {
        expect(format('${a} and ${b}', {a: 1, b: '2'})).toBe('1 and 2');
        expect(() => format('${a} and ${c}', {a: 1, b: '2'})).toThrow(ReferenceError);
        expect(format('a and b', {a: 1, b: '2'})).toBe('a and b');
        expect(format('${a.x} and ${b[1]}', {a: {x: 'x'}, b: ['0', '1']})).toBe('x and 1');
        expect(format('${a.x}', {a: {x: 5}})).toBe('5');
        expect(format('${a.x}', {a: {x: 5}}, {keepOriginalValueForSingleExpr: true})).toBe(5);
        expect(format('${a.x}', {a: {y: 5}}, {defaultPropertyValue: 0})).toBe('0');
        expect(format('${a.x}', {a: {y: 5}}, 
            {defaultPropertyValue: 0, keepOriginalValueForSingleExpr: true})).toBe(0);
        expect(() => format('${a.x}', {a: {y: 5}}, {throwErrorForMissingProperty: true})).toThrow(ReferenceError);
        expect(() => format('${b[2]}', {b: [1]}, {throwErrorForMissingProperty: true})).toThrow(ReferenceError);
        expect(() => format('${b[0].x}', {b: [{y: 5}]}, {throwErrorForMissingProperty: true})).toThrow(ReferenceError);
        expect(format('value is ${b[0].x}', {b: [{y: 5}]})).toBe('value is undefined');
        expect(() => format('value is ${b[1].y}', {b: [{y: 5}]})).toThrow(TypeError);
        expect(format('${ a.x } + 5 is ${a.x + 5}', {a: {x: 5}})).toBe('5 + 5 is 10');
    });

    test('BatchLoader', async () => {
        let count = 0;
        let b = new BatchLoader(async (values) => {
            count++;
            return values.map(v => v + 1);
        }, {maxSize: 3, maxWait: 0});
        let r = await Promise.all([b.load(1), b.load(2), b.load(3), b.load(4)]);
        expect(count).toBe(2);
        expect(r).toStrictEqual([2, 3, 4, 5]);

        let concurrency = 0, maxConcurrency = 0;
        b = new BatchLoader(async () => {
            concurrency++;
            if (maxConcurrency < concurrency) {
                maxConcurrency = concurrency;
            }
            await sleep(0);
            concurrency--;
        }, {maxSize: 1, maxConcurrency: 2});
        await Promise.all([b.load(), b.load(), b.load(), b.load()]);
        expect(maxConcurrency).toBe(2);

    });

    test('Runnable', async () => {

        let p = undefined, v = undefined;
        let r = new Runnable(
            async ({options, signal}) => {
                await sleep(100);
                p = options;
                v = await signal;
                p = 1;
            });
        await r.start({x: 1});
        expect(p).toBeUndefined();
        expect(v).toBeUndefined();
        await r.waitForReady();
        expect(p).toStrictEqual({x: 1});
        expect(v).toBeUndefined();
        await r.stop({y: 2});
        expect(p).toStrictEqual({x: 1});
        expect(v).toBeUndefined();
        await r.waitForStop();
        expect(p).toBe(1);
        expect(v).toStrictEqual({y: 2});

        p = undefined;
        v = undefined;
        r = new class extends Runnable {
            async run({options}) {
                p = options;
                v = 1;
            }
        }();
        await r.start({waitForStop: true, x: 1});
        expect(p).toStrictEqual({x: 1});
        expect(v).toBe(1);

        p = undefined;
        v = undefined;
        r = new class extends Runnable {
            async run({options, signal}) {
                p = options;
                throw new Error('error before ready');
            }
        }();
        await r.start({x: 1});
        expect(r.waitForReady()).rejects.toThrow('error before ready');
        expect(p).toStrictEqual({x: 1});
        expect(r.waitForStop()).rejects.toThrow('error before ready');

        p = undefined;
        v = undefined;
        r = new class extends Runnable {
            async run({options, signal}) {
                p = options;
                v = await signal;
                throw new Error('error after ready');
            }
        }();
        await r.start({x: 1});
        await r.waitForReady();
        expect(p).toStrictEqual({x: 1});
        expect(v).toBeUndefined();
        await r.stop({y: 2});
        let throws = false;
        try {
            await r.waitForStop();
        } catch (e) {
            expect(e.message).toBe('error after ready');
            throws = true;
        }
        if (!throws) throw new Error('r.waitForStop didn\'t throw an error');
        expect(p).toStrictEqual({x: 1});
        expect(v).toStrictEqual({y: 2});
    });

    test('unionRanges', () => {
        expect(unionRanges([{gte: 1, lte: 3}, {gte: 2, lte: 5}]))
            .toStrictEqual([{gte: 1, lte: 5}]);
        expect(unionRanges({gte: 1, lte: 3}, {gte: 2, lte: 5}))
            .toStrictEqual([{gte: 1, lte: 5}]);
        expect(unionRanges([{gte: 1, lte: 3}, {gt: 3, lt: 5}]))
            .toStrictEqual([{gte: 1, lt: 5}]);
        expect(unionRanges([{gte: 1, lt: 3}, {gt: 3, lt: 5}]))
            .toStrictEqual([{gte: 1, lt: 3}, {gt: 3, lt: 5}]);
        expect(unionRanges([{lt: 3}, {gt: 2}, {gte: 9, lt: 10}]))
            .toStrictEqual([{}]);
        expect(unionRanges([{lt: 3}, {lte: 3}, {lt: 1}]))
            .toStrictEqual([{lte: 3}]);
        expect(unionRanges([{}, {lte: 3}, {lt: 1}]))
            .toStrictEqual([{}]);
        expect(unionRanges([]))
            .toStrictEqual([]);
    });
    
    test('intersectRanges', () => {
        expect(intersectRanges([{gte: 1, lte: 3}], [{gt: 2, lte: 5}]))
            .toStrictEqual([{gt: 2, lte: 3}]);
        expect(intersectRanges({gte: 1, lte: 3}, {gt: 2, lte: 5}))
            .toStrictEqual([{gt: 2, lte: 3}]);
        expect(intersectRanges([{gte: 1, lt: 3}, {gt: 3}], [{gt: 2, lte: 5}]))
            .toStrictEqual([{gt: 2, lt: 3}, {gt: 3, lte: 5}]);
        expect(intersectRanges([{lt: 3}, {gt: 5}], [{gt: 2, lte: 5}]))
            .toStrictEqual([{gt: 2, lt: 3}]);
        expect(intersectRanges([{}], [{gt: 2, lte: 5}, {gt: 6}]))
            .toStrictEqual([{gt: 2, lte: 5}, {gt: 6}]);
        expect(intersectRanges([], [{gt: 2, lte: 5}, {gt: 6}]))
            .toStrictEqual([]);
        expect(intersectRanges({gt: 2}, {lt: 1}))
            .toStrictEqual([]);
    });
});
