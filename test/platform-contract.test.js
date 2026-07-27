/*
 * Drift guards for the things that must stay in sync but that no single file
 * owns: the two identity implementations behind the auth facade, and the OAuth
 * scope list that exists in both scopes.js and manifest.json.
 *
 * These also pin down that both identity modules are importable off-platform —
 * i.e. side-effect free at module scope. The facade imports both statically
 * (service workers reject dynamic import), so a module that touched `chrome`
 * or `document` while loading would break the platform it isn't for.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as chromeIdentity from '../src/auth/chromeIdentity.js';
import * as webIdentity from '../src/auth/webIdentity.js';
import * as facade from '../src/auth/googleAuth.js';
import { SCOPES } from '../src/auth/scopes.js';

const keys = (mod) => Object.keys(mod).sort();

test('both identity implementations expose the same surface', () => {
  assert.deepEqual(keys(chromeIdentity), keys(webIdentity));
});

test('the facade re-exports everything the implementations provide', () => {
  const exposed = new Set(keys(facade));
  for (const name of keys(chromeIdentity)) {
    assert.ok(exposed.has(name), `facade is missing ${name}`);
  }
});

test('under Node the facade falls back to the web implementation', () => {
  // No chrome.identity here, which is the same signal the hosted page gives.
  assert.equal(facade.platform, 'web');
});

test('scopes.js and manifest.json request exactly the same scopes', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual([...manifest.oauth2.scopes].sort(), [...SCOPES].sort());
});
