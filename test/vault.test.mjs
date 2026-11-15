import test from 'node:test';
import assert from 'node:assert/strict';
import { resetState } from './helpers.mjs';
import { state } from '../src/core/store.js';
import { deriveKey, seal, open, randomSalt, toB64, genPassword, passwordBits } from '../src/services/vault/crypto.js';
import * as session from '../src/services/vault/session.js';

const FAST = 1000;   // low iteration count only so unit tests run fast; the app uses 600,000

test('seal / open round trip, wrong password and tampering', async () => {
  const salt = randomSalt(), key = await deriveKey('correct horse', salt, FAST);
  const { iv, data } = await seal(key, [{ id: '1', secret: 'S3cr3t' }]);
  const env = { v: 1, kdf: 'PBKDF2-SHA256', iter: FAST, salt: toB64(salt), iv, data };
  assert.deepEqual((await open(env, 'correct horse')).items, [{ id: '1', secret: 'S3cr3t' }]);
  assert.equal(await open(env, 'wrong password'), null);
  const bytes = Buffer.from(data, 'base64'); bytes[3] ^= 1;
  assert.equal(await open({ ...env, data: bytes.toString('base64') }, 'correct horse'), null);
  assert.ok(!JSON.stringify(env).includes('S3cr3t'));                    // ciphertext only
  assert.notEqual((await seal(key, [])).iv, (await seal(key, [])).iv);    // fresh IV every time
});

test('genPassword honours length and character sets', () => {
  const p = genPassword(24, { lower: true, upper: true, digits: true, symbols: false });
  assert.equal(p.length, 24);
  assert.match(p, /[a-z]/); assert.match(p, /[A-Z]/); assert.match(p, /[0-9]/); assert.doesNotMatch(p, /[^a-zA-Z0-9]/);
  assert.equal(genPassword(10, { lower: false, upper: false, digits: false, symbols: false }), '');
  assert.notEqual(genPassword(20, { lower: true }), genPassword(20, { lower: true }));
});

test('password strength grows with length and variety', () => {
  assert.ok(passwordBits('abc') < passwordBits('abcdefghijkl'));
  assert.ok(passwordBits('abcdefghijkl') < passwordBits('Abcdefghij1!'));
  assert.equal(passwordBits(''), 0);
});

test('session: create, add, lock, unlock, change password, erase', async () => {
  resetState();
  // use the real KDF settings through the public API but only one derivation per step
  await session.create('master-password-1');
  assert.ok(session.isUnlocked()); assert.ok(session.exists());
  await session.upsert(null, { kind: 'login', title: 'GitHub', username: 'octo', secret: 'S3cr3t-Pa55!', url: '', notes: '' });
  const id = session.getItems()[0].id;
  assert.ok(!JSON.stringify(state.vault).includes('S3cr3t'), 'stored vault must not contain plain text');

  session.lock();
  assert.equal(session.isUnlocked(), false); assert.equal(session.getItems(), null);
  assert.equal(await session.unlock('wrong'), false);
  assert.equal(session.failedAttempts(), 1); assert.ok(session.unlockDelayMs() > 0);
  assert.equal(await session.unlock('master-password-1'), true);
  assert.equal(session.failedAttempts(), 0);
  assert.equal(session.getItems()[0].secret, 'S3cr3t-Pa55!');

  await session.upsert(id, { secret: 'changed' });
  assert.equal(session.getItems()[0].secret, 'changed');
  await session.changePassword('another-password-2');
  session.lock();
  assert.equal(await session.unlock('master-password-1'), false);
  assert.equal(await session.unlock('another-password-2'), true);
  await session.remove(id);
  assert.equal(session.getItems().length, 0);

  session.erase();
  assert.equal(session.exists(), false); assert.equal(state.vault, null);
});
