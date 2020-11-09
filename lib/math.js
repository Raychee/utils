const {isEmpty} = require('lodash');


const DIGITS = '0123456789';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';


function random(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max, {maxInclusive = false} = {}) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + (maxInclusive ? 1 : 0))) + min;
}

function randomString(length, {numberOnly = false, alphabetOnly = false} = {}) {
    let result = '';
    let characters;
    if (numberOnly) {
        characters = DIGITS;
    } else if (alphabetOnly) {
        characters = ALPHABET;
    } else {
        characters = DIGITS + ALPHABET;
    }
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

function extractRangeValue(range, keyInclusive, keyExclusive) {
    let value, inclusive = false;
    if (range[keyInclusive] == null) {
        if (range[keyExclusive] == null) {
            value = undefined;
        } else {
            value = range[keyExclusive];
            inclusive = false;
        }
    } else {
        if (range[keyExclusive] == null) {
            value = range[keyInclusive];
            inclusive = true;
        } else {
            throw new Error(`invalid range: ${JSON.stringify(range)}`);
        }
    }
    return [value, inclusive];
}

function unionRanges(...ranges) {
    const merged = ranges.flatMap(r => Array.isArray(r) ? r : [r]);
    let merging = true;
    while (merging) {
        merging = false;
        for (let i = merged.length - 1; i > 0; i--) {
            const a = merged[i];
            for (let j = i - 1; j >= 0; j--) {
                const b = merged[j];
                if (!(
                    (a.lte != null && b.gte != null && a.lte < b.gte) || 
                    (a.lt != null && b.gte != null && a.lt < b.gte) || 
                    (a.lte != null && b.gt != null && a.lte < b.gt) || 
                    (a.lt != null && b.gt != null && a.lt <= b.gt) ||
                    (a.gte != null && b.lte != null && a.gte > b.lte) ||
                    (a.gt != null && b.lte != null && a.gt > b.lte) ||
                    (a.gte != null && b.lt != null && a.gte > b.lt) ||
                    (a.gt != null && b.lt != null && a.gt >= b.lt)
                )) {
                    const new_ = {};
                    const [agt, agte] = extractRangeValue(a, 'gte', 'gt');
                    const [alt, alte] = extractRangeValue(a, 'lte', 'lt');
                    const [bgt, bgte] = extractRangeValue(b, 'gte', 'gt');
                    const [blt, blte] = extractRangeValue(b, 'lte', 'lt');
                    if (agt != null && bgt != null) {
                        if (agt < bgt) {
                            new_[agte ? 'gte' : 'gt'] = agt;
                        } else if (agt > bgt) {
                            new_[bgte ? 'gte' : 'gt'] = bgt;
                        } else {
                            new_[agte || bgte ? 'gte' : 'gt'] = agt;
                        }
                    }
                    if (alt != null && blt != null) {
                        if (alt > blt) {
                            new_[alte ? 'lte' : 'lt'] = alt;
                        } else if (alt < blt) {
                            new_[blte ? 'lte' : 'lt'] = blt;
                        } else {
                            new_[alte || blte ? 'lte' : 'lt'] = alt;
                        }
                    }
                    merging = true;
                    merged.splice(i, 1);
                    merged.splice(j, 1);
                    if (isEmpty(new_)) {
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
    if (!Array.isArray(ranges1)) ranges1 = [ranges1];
    if (!Array.isArray(ranges2)) ranges2 = [ranges2];
    for (const a of ranges1) {
        for (const b of ranges2) {
            const new_ = {};
            const [agt, agte] = extractRangeValue(a, 'gte', 'gt');
            const [alt, alte] = extractRangeValue(a, 'lte', 'lt');
            const [bgt, bgte] = extractRangeValue(b, 'gte', 'gt');
            const [blt, blte] = extractRangeValue(b, 'lte', 'lt');
            if (agt == null) {
                if (bgt != null) {
                    new_[bgte ? 'gte' : 'gt'] = bgt;
                }
            } else {
                if (bgt != null) {
                    if (agt > bgt) {
                        new_[agte ? 'gte' : 'gt'] = agt;
                    } else if (agt < bgt) {
                        new_[bgte ? 'gte' : 'gt'] = bgt;
                    } else {
                        new_[agte && bgte ? 'gte' : 'gt'] = agt;
                    }
                } else {
                    new_[agte ? 'gte' : 'gt'] = agt;
                }
            }
            if (alt == null) {
                if (blt != null) {
                    new_[blte ? 'lte' : 'lt'] = blt;
                }
            } else {
                if (blt != null) {
                    if (alt < blt) {
                        new_[alte ? 'lte' : 'lt'] = alt;
                    } else if (alt > blt) {
                        new_[blte ? 'lte' : 'lt'] = blt;
                    } else {
                        new_[alte && blte ? 'lte' : 'lt'] = alt;
                    }
                } else {
                    new_[alte ? 'lte' : 'lt'] = alt;
                }
            }
            if (
                new_.gte != null && new_.lte != null && new_.gte > new_.lte ||
                new_.gte != null && new_.lt != null && new_.gte >= new_.lt ||
                new_.gt != null && new_.lte != null && new_.gt >= new_.lte ||
                new_.gt != null && new_.lt != null && new_.gt >= new_.lt
            ) {
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
