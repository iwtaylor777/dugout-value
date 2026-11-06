import assert from 'node:assert/strict';
import test from 'node:test';
import { readGmSaveUrl, createGmShareUrl } from '../lib/gm-share-url.mjs';

test('large completed market saves stay out of the HTTP request URL', () => {
  const save = 'market-ledger_'.repeat(5000);
  const shared = new URL(createGmShareUrl('https://www.dugoutvalue.com/tools/gm?s=old#gm-results', save));
  assert.equal(shared.pathname + shared.search, '/tools/gm');
  assert.equal(readGmSaveUrl(shared.href), save);
});

test('old GM query links still load and new fragment saves take priority', () => {
  assert.equal(readGmSaveUrl('https://example.com/tools/gm?s=legacy#gm-market'), 'legacy');
  assert.equal(readGmSaveUrl('https://example.com/tools/gm?s=legacy#s=current'), 'current');
  assert.equal(readGmSaveUrl('https://example.com/tools/gm#gm-market'), null);
});
