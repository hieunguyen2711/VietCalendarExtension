import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authErrorKey } from '../src/auth/googleAuth.js';

// A client-id mismatch is a packaging fault: the running extension's ID does
// not match the ID the OAuth client was registered against. Reporting it as a
// blocked account sends the user off adding test users that were never the
// problem, so these strings must not fall through to authErrorBlocked.
test('Google phrasing of a client-id mismatch is classified as such', () => {
  assert.equal(
    authErrorKey(
      "OAuth2 request failed: Service responded with error: 'bad client id: 1062072614362-abc.apps.googleusercontent.com'",
    ),
    'authErrorClientId',
  );
});

test('Chrome phrasing of a client-id mismatch is classified as such', () => {
  assert.equal(authErrorKey('Invalid client id.'), 'authErrorClientId');
});

// The web equivalent: the page's origin isn't on the OAuth client's allow-list.
// Same root cause as a wrong extension ID, so it must land on the same advice.
test('GIS phrasing of an unregistered origin is classified as a client problem', () => {
  assert.equal(authErrorKey('invalid_client'), 'authErrorClientId');
  assert.equal(authErrorKey('no registered origin'), 'authErrorClientId');
});

test('a signed-out Chrome profile is called out separately', () => {
  assert.equal(authErrorKey('The user is not signed in.'), 'authErrorNoChromeAccount');
});

test('anything else falls back to the blocked-account advice', () => {
  assert.equal(authErrorKey('The user did not approve access.'), 'authErrorBlocked');
  assert.equal(authErrorKey(''), 'authErrorBlocked');
  assert.equal(authErrorKey(undefined), 'authErrorBlocked');
});
