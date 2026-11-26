// Regression test for the PIN lockout / sign-out counter in src/services/appLock.ts.
// Run: node mobile/tests/appLockPin.test.mjs   (Node 22.6+; no extra packages).
// It loads the real appLock.ts with the three native modules replaced by in-memory fakes.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/services/appLock.ts'), 'utf8')
  .replace(/import AsyncStorage[^\n]*\n/, 'const AsyncStorage = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };\n')
  .replace(/import \* as SecureStore[^\n]*\n/, 'const mem = {}; const SecureStore = { getItemAsync: async (k) => mem[k] ?? null, setItemAsync: async (k, v) => { mem[k] = v; }, deleteItemAsync: async (k) => { delete mem[k]; } };\n')
  .replace(/import \* as LocalAuthentication[^\n]*\n/, 'const LocalAuthentication = {};\n');
const file = join(mkdtempSync(join(tmpdir(), 'applock-')), 'appLock.mts');
writeFileSync(file, src);
const m = await import(pathToFileURL(file).href);

let t = Date.now();
Date.now = () => t;
const wait = () => { t += 4000 * 1000; }; // past any lockout

await m.setPin('1234');
const due = [];
for (let i = 0; i < 10; i++) { assert.equal(await m.verifyPin('0000'), false); due.push(await m.pinSignOutDue()); wait(); }
assert.deepEqual(due, [false, false, false, false, false, false, false, false, false, true], 'sign-out due only at the 10th wrong PIN, not reset by lockout expiry');

await m.resetPinFailState();
assert.equal(await m.verifyPin('1234'), true);
assert.equal(await m.pinSignOutDue(), false);

for (let i = 0; i < 9; i++) { await m.verifyPin('0'); wait(); }
assert.equal(await m.verifyPin('1234'), true, 'correct PIN works at 9 wrong');
assert.equal(await m.pinSignOutDue(), false, 'correct PIN clears the counter');

await m.verifyPin('0'); // 1 wrong, then lockout window: attempts during lockout are rejected and not counted
for (let i = 0; i < 4; i++) await m.verifyPin('0');
assert.ok((await m.getPinLockoutSeconds()) > 0, '5 wrong PINs start a lockout');
assert.equal(await m.verifyPin('1234'), false, 'correct PIN rejected while locked out');
console.log('appLockPin: all checks passed');
