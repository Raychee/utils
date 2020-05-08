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
    deepEqual,
    merge2Level,
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
    
    test('diff', () => {
        let d = diff(
            {a: 1, b: 2, c: {d: 3, e: [4, 5], f: 6}},
            {a: 1, b: 3, c: {d: 4, e: [5], f: 6}},
        );
        expect(d).toStrictEqual({b: 3, c: {d: 4, e: [5], f: 6}});

        d = diff(
            {a: 1, b: 2, c: {d: 3, e: [4, 5], f: 6}},
            {a: 1, b: 3, c: {d: 4, e: [5], f: 6}},
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

        let i = 0;
        let fn = dedup(async () => {
            await sleep(0);
            return i++;
        });
        let [v1, v2] = await Promise.all([fn(), fn()]);
        expect(v1).toBe(0);
        expect(v2).toBe(0);
        expect(i).toBe(1);

        fn = dedup(async (i) => {
            await sleep(0);
            return i;
        });
        [v1, v2] = await Promise.all([fn(1), fn(2)]);
        expect(v1).toBe(1);
        expect(v2).toBe(2);

        fn = dedup(async (i) => {
            await sleep(0);
            return i;
        }, {key: null});
        [v1, v2] = await Promise.all([fn(1), fn(2)]);
        expect(v1).toBe(1);
        expect(v2).toBe(1);

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

        i = 0;
        fn = dedup(async () => {
            await sleep(0);
            throw new Error((i++).toString());
        });
        await expect(fn()).rejects.toThrow('0');
        await expect(fn()).rejects.toThrow('1');

        fn = dedup(async (i) => {
            await sleep(0);
            return i + 1;
        }, {key: (i) => i % 2});
        [v1, v2, v3] = await Promise.all([fn(0), fn(1), fn(2)]);
        expect(v1).toBe(1);
        expect(v2).toBe(2);
        expect(v3).toBe(1);
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
