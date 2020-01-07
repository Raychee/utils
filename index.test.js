const {
    sleep, walk,
    safeJSON, safeJSONStringify, clear, shrink, diff, deepEqual, merge2Level, flatten, readOnly,
    isThenable, random, randomInt, randomString, randomMacAddress,
    ensureThunk, ensureThunkCall, ensureThunkSync, ensureThunkCallSync,
    dedup, limit, retry, requestWithTimeout,
    stringify, stringifyWith, errorToString, replaceAll, input,
    BatchLoader, Cache,
} = require('./index');


describe('test', () => {

    test('readOnly', () => {

        const obj = readOnly({a: 1, b: {c: 2, d: [3, 4]}, e: function () {return this.a;}});
        expect(obj.a).toBe(1);
        expect(() => obj.a = 3).toThrow('this object is read only');
        expect(obj.b.c).toBe(2);
        expect(() => obj.b.d = 5).toThrow('this object is read only');
        expect(obj.e()).toBe(1);
        expect(() => obj.e.name = 'newName').toThrow('this object is read only');

    });

});