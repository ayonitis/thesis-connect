// Actual application helpers, evaluated offline. No Auth/SQL/network execution.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/lib/auth/auth-feedback.ts'), 'utf8');
const unit = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: unit, exports: unit.exports });
const { validateRegistrationPassword: password, authErrorMessage: message } = unit.exports;
for (const value of ['Abcdefgh1!', 'long-password', 'abcdefghij?', '123456789[', '123456789]']) {
  test('registration accepts length and punctuation: ' + value.length, () => assert.equal(password(value), null));
}
test('short passwords give specific feedback', () => assert.match(password('Short!'), /at least 10/));
test('long alphanumeric passwords require punctuation', () => assert.match(password('LongPassword123'), /punctuation/));
test('whitespace and emoji alone are not punctuation', () => {
  for (const value of ['abcdefghij ', 'abcdefghij💡']) assert.match(password(value), /punctuation/);
});
for (const [code, expected] of [
  ['user_already_exists', /already exists/], ['email_exists', /reset/], ['email_not_confirmed', /verify/],
  ['weak_password', /10 characters/], ['invalid_credentials', /incorrect/], ['signup_disabled', /unavailable/],
  ['over_request_rate_limit', /wait/], ['over_email_send_rate_limit', /wait/], ['otp_expired', /expired/],
]) test('safe Auth feedback for ' + code, () => assert.match(message({ code }, 'signup'), expected));
test('429 rate limits need no raw message parsing', () => assert.match(message({ status: 429 }, 'signin'), /wait/));
test('unknown errors never echo upstream information', () => {
  const secret = 'SYNTHETIC_INTERNAL_DETAIL_NOT_FOR_UI';
  for (const action of ['signup', 'signin', 'resend', 'password']) {
    assert.ok(!message({ code: secret, message: secret, stack: secret }, action).includes(secret));
    assert.equal(typeof message(null, action), 'string');
  }
});
test('signup keeps privacy-preserving duplicate response and explicit confirmation guidance', () => {
  const page = fs.readFileSync(path.join(root, 'src/app/sign-up/page.tsx'), 'utf8');
  assert.match(page, /validateRegistrationPassword\(password\)/);
  assert.match(page, /authErrorMessage\(signUpError, "signup"\)/);
  assert.match(page, /If you already have an account/);
  assert.doesNotMatch(page, /identities\.length|signUpError\.message/);
  assert.match(page, /data\.session && !await clearRejectedBracSession/);
});
test('verification query is not verification proof and hydration starts consistently', () => {
  const page = fs.readFileSync(path.join(root, 'src/app/verify-email/page.tsx'), 'utf8');
  assert.doesNotMatch(page, /useMemo|Email verified successfully/);
  assert.match(page, /setParams/);
  assert.match(page, /Sign in to check your verified account access/);
  assert.match(page, /validateBracEmail\(email, true\)/);
});
