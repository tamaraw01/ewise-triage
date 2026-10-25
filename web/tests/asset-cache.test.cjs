/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('cache only public reference assets, retain security headers', async () => {
  const source = fs.readFileSync('next.config.ts', 'utf8')
    .replace('import type { NextConfig } from "next";', '')
    .replace(': NextConfig', '').replace('export default nextConfig;', 'globalThis.config = nextConfig;');
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const rules = await context.config.headers();
  const cached = rules.filter(rule => rule.headers.some(h => h.key === 'Cache-Control'));
  assert.equal(cached.length, 2);
  assert.equal(cached[0].source, '/:asset(samples|map-photos|map-atlas)/:path*');
  assert.equal(cached[1].source, '/gallery/:path*');
  for (const rule of cached) {
    assert.ok(!rule.source.includes('api'));
    assert.ok(!rule.headers.find(h => h.key === 'Cache-Control').value.includes('immutable'));
  }
  assert.equal(rules.find(rule => rule.source === '/:path*').headers.length, 4);
});
