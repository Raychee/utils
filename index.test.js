const {
    sleep, walk,
    safeJSON, safeJSONStringify, clear, shrink, diff, deepEqual, merge2Level, flatten, readOnly,
    isThenable, random, randomInt, randomString, randomMacAddress,
    ensureThunk, ensureThunkCall, ensureThunkSync, ensureThunkCallSync,
    dedup, limit, retry, requestWithTimeout,
    stringify, stringifyWith, errorToString, replaceAll, input,
    BatchLoader, Cache, Runnable
} = require('./index');


describe('test', () => {

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