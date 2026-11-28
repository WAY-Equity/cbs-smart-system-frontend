import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { safeReturnTo } from '../src/auth-config.ts';
const require = createRequire(import.meta.url);
const post = require('../auth0/post-login.cjs').onExecutePostLogin;
const pre = require('../auth0/pre-registration.cjs').onExecutePreUserRegistration;
const emails = ['kusaka@cbs-f.com','ju@wayequity.co','nakai@cbs-f.com','y-tomokata@cbs-hd.club','nakahara@wayequity.co','nakahara@soramanagement.co','horie@wayequity.co','chen@wayequity.co'];
async function denied(run: Function, email: string | undefined, verified = true, strategy = 'email', client = 'hJYhsluI7zSN0JvevTtUODyMvInFN036') {
  let rejected = false;
  await run({client:{client_id:client},connection:{strategy},user:{email,email_verified:verified}}, {access:{deny(){rejected=true;}}});
  return rejected;
}
test('all eight invited addresses can enroll and sign in, case-insensitively', async () => {
  for (const email of emails) {
    assert.equal(await denied(pre, email.toUpperCase(), false), false);
    assert.equal(await denied(post, email.toUpperCase()), false);
  }
});
test('outsiders, missing emails and other connections are rejected', async () => {
  for (const run of [pre,post]) {
    for (const email of ['outsider@example.com', 'kusaka@cbs-f.com.attacker.test', '', undefined]) assert.equal(await denied(run,email),true);
    assert.equal(await denied(run,emails[0],true,'google-oauth2'),true);
  }
  assert.equal(await denied(post,emails[0],false),true);
});
test('CBS guards do not change other applications',async () => {
  for (const run of [pre,post]) assert.equal(await denied(run,'outsider@example.com',false,'google-oauth2','other-client'),false);
});
test('callback restores local routes and invite fragments, blocks external redirects', () => {
  const origin='https://d3kk6kbbp4x94g.cloudfront.net';
  assert.equal(safeReturnTo('/?page=upload&error=access_denied&state=old&iss=issuer#invite=example',origin),'/?page=upload#invite=example');
  assert.equal(safeReturnTo('/?page=upload#invite=example',origin),'/?page=upload#invite=example');
  for (const target of ['https://evil.example/','//evil.example/','javascript:alert(1)',undefined,{}]) assert.equal(safeReturnTo(target,origin),'/');
});
