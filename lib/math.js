function random(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max, maxInclusive = false) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + (maxInclusive ? 1 : 0))) + min;
}

function randomString(length, numberOnly = false) {
    let result = '';
    const characters = numberOnly ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function randomMacAddress() {
    return [
        0xf6, 0xf5, 0xdb,
        randomInt(0, 0x7f, true),
        randomInt(0, 0xff, true),
        randomInt(0, 0xff, true)
    ].map(v => `0${v.toString(16)}`.slice(-2)).join(':');
}

function unionRanges(ranges) {
    const merged = [...ranges];
    let merging = true;
    while (merging) {
        merging = false;
        for (let i = merged.length - 1; i > 0; i--) {
            const a = merged[i];
            for (let j = i - 1; j >= 0; j--) {
                const b = merged[j];
                if (
                    (a[1] == null || b[0] == null || a[1] >= b[0]) &&
                    (b[1] == null || a[0] == null || b[1] >= a[0])
                ) {
                    const new_ = [
                        a[0] == null ? a[0] : b[0] == null ? b[0] : Math.min(a[0], b[0]),
                        a[1] == null ? a[1] : b[1] == null ? b[1] : Math.max(a[1], b[1]),
                    ];
                    merging = true;
                    merged.splice(i, 1);
                    merged.splice(j, 1);
                    if (new_[0] == null && new_[1] == null) {
                        return [new_];
                    }
                    merged.push(new_);
                    break;
                }
            }
            if (merging) break;
        }
    }
    return merged;
}

function intersectRanges(ranges1, ranges2) {
    const merged = [];
    for (const a of ranges1) {
        for (const b of ranges2) {
            const new_ = [
                a[0] == null ? b[0] : b[0] == null ? a[0] : Math.max(a[0], b[0]),
                a[1] == null ? b[1] : b[1] == null ? a[1] : Math.min(a[1], b[1]),
            ];
            if (new_[0] != null && new_[1] !== null && new_[0] > new_[1]) {
                continue;
            }
            merged.push(new_);
        }
    }
    return merged;
}


module.exports = {
    random,
    randomInt,
    randomString,
    randomMacAddress,
    unionRanges,
    intersectRanges,
};
