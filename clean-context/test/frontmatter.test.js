import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../lib/frontmatter.js';

test('парсит name и description', () => {
  const r = parseFrontmatter('---\nname: foo\ndescription: Bar baz\n---\nBody here');
  assert.equal(r.name, 'foo');
  assert.equal(r.description, 'Bar baz');
  assert.equal(r.body, 'Body here');
});
test('без frontmatter -> null', () => {
  const r = parseFrontmatter('just text');
  assert.equal(r.name, null);
  assert.equal(r.description, null);
});
test('снимает кавычки', () => {
  const r = parseFrontmatter('---\nname: "foo"\ndescription: \'bar\'\n---\n');
  assert.equal(r.name, 'foo');
  assert.equal(r.description, 'bar');
});
test('falsy вход безопасен', () => {
  const r = parseFrontmatter(undefined);
  assert.equal(r.name, null);
  assert.equal(r.description, null);
  assert.equal(r.body, '');
});
