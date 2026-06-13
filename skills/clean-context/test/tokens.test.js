import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens } from '../lib/tokens.js';

test('пустая строка = 0', () => assert.equal(estimateTokens(''), 0));
test('null безопасен', () => assert.equal(estimateTokens(null), 0));
test('латиница ~ символы/4', () => assert.equal(estimateTokens('abcd'), 1));
test('кириллица ~ символы/2.5', () => assert.equal(estimateTokens('привет'), 3));
