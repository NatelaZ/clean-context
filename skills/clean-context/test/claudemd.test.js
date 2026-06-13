import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSections, findDuplicateSections, analyzeFile } from '../lib/claudemd.js';

test('splitSections: преамбула + секции', () => {
  const md = 'intro text here\n\n## A\naaa\n\n## B\nbbb bbb';
  const secs = splitSections(md);
  assert.equal(secs.length, 3);
  assert.equal(secs[0].heading, null);
  assert.ok(secs[0].text.includes('intro text'));
  assert.equal(secs[1].heading, 'A');
  assert.equal(secs[1].level, 2);
  assert.equal(secs[2].heading, 'B');
  assert.ok(secs[1].tokens > 0);
});

test('splitSections: файл, начинающийся с заголовка, без пустой преамбулы', () => {
  const secs = splitSections('# Title\nbody');
  assert.equal(secs.length, 1);
  assert.equal(secs[0].heading, 'Title');
  assert.equal(secs[0].level, 1);
});

test('splitSections: пустой ввод -> []', () => {
  assert.deepEqual(splitSections(''), []);
});

test('analyzeFile: total = сумма, top отсортирован по убыванию', () => {
  const a = analyzeFile('/p/CLAUDE.md', '## Small\nx\n\n## Big\n' + 'word '.repeat(50));
  assert.equal(a.name, '/p/CLAUDE.md');
  assert.ok(a.total > 0);
  assert.equal(a.top[0].heading, 'Big');
});

test('findDuplicateSections: общая секция в 2 файлах', () => {
  const shared = '## Карта проекта\n' + 'одинаковый длинный текст секции для дедупликации '.repeat(3);
  const f1 = { name: 'a', sections: splitSections(shared + '\n\n## Уник1\n' + 'x'.repeat(60)) };
  const f2 = { name: 'b', sections: splitSections(shared + '\n\n## Уник2\n' + 'y'.repeat(60)) };
  const dups = findDuplicateSections([f1, f2]);
  assert.equal(dups.length, 1);
  assert.equal(dups[0].heading, 'Карта проекта');
  assert.deepEqual(dups[0].files.sort(), ['a', 'b']);
  assert.equal(dups[0].copies, 2);
  assert.ok(dups[0].wastedTokens > 0);
});

test('findDuplicateSections: крошечные секции игнорируются', () => {
  const f1 = { name: 'a', sections: splitSections('## H\nshort') };
  const f2 = { name: 'b', sections: splitSections('## H\nshort') };
  assert.deepEqual(findDuplicateSections([f1, f2]), []);
});
