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
        fn = dedup(async () => {
            await sleep(10);
            return i++;
        });
        ps = [fn(), fn()];
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
        
        console.log('#############test');
        
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
        console.log('sleep');
        await sleep(9);
        console.log('awake');
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
        await expect(fn.wait()).resolves.toBeUndefined();
        
    });
    
    test('limit', async () => {
        let concurrency, maxConcurrency, fn, ps, vs, t;
        
        concurrency = 0; maxConcurrency = 0;
        fn = limit(async (x) => {
            concurrency++;
            if (maxConcurrency < concurrency) maxConcurrency = concurrency;
            await sleep(10);
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
    });

    test('readOnly', () => {

        const obj = readOnly({
            a: 1, b: {c: 2, d: [3, 4]}, e: function () {
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

});
