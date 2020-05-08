const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const readline = require('readline');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * @param filePath {string}
 * @returns {AsyncIterableIterator<string>}
 */
async function* walk(filePath) {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
        for (const file of await readdir(filePath)) {
            const subPath = path.join(filePath, file);
            yield* walk(subPath);
        }
    } else if (stats.isFile()) {
        yield filePath;
    }
}

function input(question = '') {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin, output: process.stdout
        });
        rl.question(question, (answer) => {
            resolve(answer);
            rl.close();
        });
    });
}

module.exports = {
    walk,
    input,
}
