# Клинер контекста `/clean-context` — план реализации (MVP)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Скилл `/clean-context`, который обходит конфигурацию Claude Code, оценивает стартовую плату за контекст, сверяет с реальной статистикой использования и обратимо отключает лишнее.

**Architecture:** Zero-dependency Node.js-пакет (ESM). Чистые библиотечные функции (`lib/`) с инъекцией путей для тестируемости, тонкие CLI-обёртки (`bin/`), и `SKILL.md`, по которому Claude оркестрирует «аудит → показ отчёта → подтверждение → применение». Исходник живёт в папке проекта, симлинкуется в `~/.claude/skills/clean-context`.

**Tech Stack:** Node.js v26 (ESM, `node --test`, `node:assert/strict`), без внешних npm-зависимостей.

**Project root (все пути ниже — относительно него):** `/Users/natela/Documents/My_agents/Клининг контекста/`
**Source package:** `clean-context/`

---

## Модель данных (единый контракт для всех задач)

Каждый элемент инвентаря — объект `Item`:

```js
{
  category: 'skill' | 'agent' | 'mcp' | 'plugin' | 'claudemd' | 'hook',
  name: string,            // 'getcourse-landing', 'arhitektor', 'pencil', ...
  status: 'active' | 'disabled',
  path: string,            // абсолютный путь к файлу/папке элемента
  descText: string,        // текст, по которому считаем токены (имя+описание, или весь CLAUDE.md)
  // добавляется этапом cost:
  estTokens: number,
  // добавляется этапом usage:
  usageCount: number | null,
  lastUsedAt: number | null,   // epoch ms
  daysSinceUse: number | null,
}
```

`recommend()` возвращает: `{ toDisable: Item[], wrongDirection: Item[], manualReview: Item[], keep: Item[] }`.

---

## Структура файлов

```
clean-context/
  SKILL.md                 # инструкции для Claude (короткое описание — низкая стартовая плата)
  package.json             # {"type":"module"}, скрипт test
  .gitignore               # .state/
  lib/
    paths.js               # defaultConfig() — все пути в одном месте
    tokens.js              # estimateTokens(str)
    frontmatter.js         # parseFrontmatter(text) -> {name, description, body}
    scan.js                # scanSkills/scanAgents/scanMcp/scanPlugins/scanClaudeMd/scanHooks/scanInventory
    cost.js                # addCosts(items), totalsByCategory(items)
    usage.js               # loadUsage(path), addUsage(items, usage, now)
    recommend.js           # recommend(items, opts)
    report.js              # renderReport(result, items) -> string
    apply.js               # applyDisable(selections, config, logPath) -> ops[]
    restore.js             # restoreAll(logPath, config) -> ops[]
  bin/
    audit.js               # CLI: конвейер -> печать отчёта + .state/last-audit.json
    apply.js               # CLI: отключить выбранные имена
    restore.js             # CLI: откатить последний прогон
  test/                    # *.test.js на каждый модуль lib
  scripts/
    install.sh             # симлинк в ~/.claude/skills/clean-context
  .state/                  # runtime (gitignored): last-audit.json, operations.log.jsonl
```

---

## Task 0: Каркас пакета

**Files:**
- Create: `clean-context/package.json`
- Create: `clean-context/.gitignore`
- Create: `clean-context/lib/paths.js`

- [ ] **Step 1: Инициализировать git в корне проекта (для коммитов)**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста" && git init -q && echo ok
```
Expected: `ok`

- [ ] **Step 2: Создать `clean-context/package.json`**

```json
{
  "name": "clean-context",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 3: Создать `clean-context/.gitignore`**

```
.state/
```

- [ ] **Step 4: Создать `clean-context/lib/paths.js`**

```js
import os from 'node:os';
import path from 'node:path';

export function defaultConfig(home = os.homedir()) {
  const claude = path.join(home, '.claude');
  return {
    home,
    claudeDir: claude,
    skillsDir: path.join(claude, 'skills'),
    skillsDisabledDir: path.join(claude, 'skills-disabled'),
    agentsDir: path.join(claude, 'agents'),
    agentsDisabledDir: path.join(claude, 'agents-disabled'),
    mcpDisabledDir: path.join(claude, 'mcp-disabled'),
    settingsPath: path.join(claude, 'settings.json'),
    claudeJsonPath: path.join(home, '.claude.json'),
    staleDays: 30,
  };
}
```

- [ ] **Step 5: Проверить, что тест-раннер стартует (пустой прогон)**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test 2>&1 | tail -3
```
Expected: вывод вида `tests 0` / `pass 0` без ошибок парсинга.

- [ ] **Step 6: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/package.json clean-context/.gitignore clean-context/lib/paths.js docs/
git commit -m "chore: scaffold clean-context package"
```

---

## Task 1: Оценка токенов `tokens.js`

**Files:**
- Create: `clean-context/lib/tokens.js`
- Test: `clean-context/test/tokens.test.js`

- [ ] **Step 1: Написать падающий тест**

`clean-context/test/tokens.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens } from '../lib/tokens.js';

test('пустая строка = 0', () => assert.equal(estimateTokens(''), 0));
test('null безопасен', () => assert.equal(estimateTokens(null), 0));
test('латиница ~ символы/4', () => assert.equal(estimateTokens('abcd'), 1));
test('кириллица ~ символы/2.5', () => assert.equal(estimateTokens('привет'), 3));
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/tokens.test.js 2>&1 | tail -5
```
Expected: FAIL — `Cannot find module '../lib/tokens.js'`.

- [ ] **Step 3: Реализовать**

`clean-context/lib/tokens.js`:
```js
// Грубая оценка стартовой платы в токенах с поправкой на язык.
// Кириллица токенизируется плотнее латиницы, поэтому делители разные.
export function estimateTokens(text) {
  if (!text) return 0;
  const cyrillic = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const rest = text.length - cyrillic;
  return Math.ceil(cyrillic / 2.5 + rest / 4);
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/tokens.test.js 2>&1 | tail -5
```
Expected: PASS — `pass 4`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/lib/tokens.js clean-context/test/tokens.test.js
git commit -m "feat: token estimator"
```

---

## Task 2: Парсер frontmatter `frontmatter.js`

**Files:**
- Create: `clean-context/lib/frontmatter.js`
- Test: `clean-context/test/frontmatter.test.js`

- [ ] **Step 1: Написать падающий тест**

`clean-context/test/frontmatter.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../lib/frontmatter.js';

test('парсит name и description', () => {
  const r = parseFrontmatter('---\nname: foo\ndescription: Bar baz\n---\nBody here');
  assert.equal(r.name, 'foo');
  assert.equal(r.description, 'Bar baz');
  assert.equal(r.body.trim(), 'Body here');
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
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/frontmatter.test.js 2>&1 | tail -5
```
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

`clean-context/lib/frontmatter.js`:
```js
// Достаёт name/description из YAML-frontmatter. Описания в SKILL.md и агентах —
// однострочные, поэтому без полноценного YAML-парсера (zero-dep).
export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { name: null, description: null, body: text };
  const fm = m[1];
  const get = (key) => {
    const r = fm.match(new RegExp('^' + key + ':\\s*(.*)$', 'm'));
    return r ? r[1].trim().replace(/^["']|["']$/g, '') : null;
  };
  return { name: get('name'), description: get('description'), body: text.slice(m[0].length) };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/frontmatter.test.js 2>&1 | tail -5
```
Expected: PASS — `pass 3`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/lib/frontmatter.js clean-context/test/frontmatter.test.js
git commit -m "feat: frontmatter parser"
```

---

## Task 3: Сканер скилов и агентов `scan.js` (часть 1)

**Files:**
- Create: `clean-context/lib/scan.js`
- Test: `clean-context/test/scan.test.js`

- [ ] **Step 1: Написать падающий тест**

`clean-context/test/scan.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanSkills, scanAgents } from '../lib/scan.js';

function tmpRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-scan-')); }
function writeSkill(base, name, desc) {
  const d = path.join(base, name);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'SKILL.md'), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`);
}
function writeAgent(base, name, desc) {
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, name + '.md'), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`);
}

test('scanSkills: активные и отключённые', () => {
  const root = tmpRoot();
  const config = { skillsDir: path.join(root, 'skills'), skillsDisabledDir: path.join(root, 'skills-disabled') };
  writeSkill(config.skillsDir, 'alpha', 'Alpha does things');
  writeSkill(config.skillsDisabledDir, 'beta', 'Beta is off');
  const items = scanSkills(config);
  const byName = Object.fromEntries(items.map(i => [i.name, i]));
  assert.equal(byName.alpha.status, 'active');
  assert.equal(byName.alpha.category, 'skill');
  assert.equal(byName.beta.status, 'disabled');
  assert.ok(byName.alpha.descText.includes('Alpha does things'));
});

test('scanAgents: активные и отключённые', () => {
  const root = tmpRoot();
  const config = { agentsDir: path.join(root, 'agents'), agentsDisabledDir: path.join(root, 'agents-disabled') };
  writeAgent(config.agentsDir, 'arhitektor', 'Designs stuff');
  const items = scanAgents(config);
  assert.equal(items.length, 1);
  assert.equal(items[0].category, 'agent');
  assert.equal(items[0].status, 'active');
  assert.equal(items[0].name, 'arhitektor');
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/scan.test.js 2>&1 | tail -5
```
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать первую часть `scan.js`**

`clean-context/lib/scan.js`:
```js
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.js';

function readSkillDir(dir, status, items) {
  if (!dir || !fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const skillMd = path.join(dir, name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;
    const fm = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
    items.push({
      category: 'skill',
      name: fm.name || name,
      status,
      path: path.join(dir, name),
      descText: [fm.name || name, fm.description || ''].join('\n'),
    });
  }
}

export function scanSkills(config) {
  const items = [];
  readSkillDir(config.skillsDir, 'active', items);
  readSkillDir(config.skillsDisabledDir, 'disabled', items);
  return items;
}

export function scanAgents(config) {
  const items = [];
  for (const [dir, status] of [[config.agentsDir, 'active'], [config.agentsDisabledDir, 'disabled']]) {
    if (!dir || !fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const p = path.join(dir, file);
      const fm = parseFrontmatter(fs.readFileSync(p, 'utf8'));
      const name = fm.name || file.replace(/\.md$/, '');
      items.push({ category: 'agent', name, status, path: p, descText: [name, fm.description || ''].join('\n') });
    }
  }
  return items;
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/scan.test.js 2>&1 | tail -5
```
Expected: PASS — `pass 2`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/lib/scan.js clean-context/test/scan.test.js
git commit -m "feat: scan skills and agents"
```

---

## Task 4: Сканер MCP, плагинов, CLAUDE.md, hooks `scan.js` (часть 2)

**Files:**
- Modify: `clean-context/lib/scan.js`
- Modify: `clean-context/test/scan.test.js`

- [ ] **Step 1: Дописать падающие тесты**

Добавить в конец `clean-context/test/scan.test.js`:
```js
import { scanMcp, scanPlugins, scanClaudeMd, scanInventory } from '../lib/scan.js';

test('scanMcp: глобальные активные + отключённые из mcp-disabled', () => {
  const root = tmpRoot();
  const claudeJsonPath = path.join(root, '.claude.json');
  fs.writeFileSync(claudeJsonPath, JSON.stringify({ mcpServers: { pencil: { command: 'x' } }, projects: {} }));
  const mcpDisabledDir = path.join(root, 'mcp-disabled');
  fs.mkdirSync(mcpDisabledDir, { recursive: true });
  fs.writeFileSync(path.join(mcpDisabledDir, 'heygen.json'), '{}');
  fs.writeFileSync(path.join(mcpDisabledDir, 'claude.json.bak'), '{}'); // должен игнорироваться
  const items = scanMcp({ claudeJsonPath, mcpDisabledDir });
  const byName = Object.fromEntries(items.map(i => [i.name, i]));
  assert.equal(byName.pencil.status, 'active');
  assert.equal(byName.heygen.status, 'disabled');
  assert.equal(byName['claude.json'], undefined);
});

test('scanPlugins: из enabledPlugins', () => {
  const root = tmpRoot();
  const settingsPath = path.join(root, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({ enabledPlugins: { 'a@m': true, 'b@m': false } }));
  const items = scanPlugins({ settingsPath });
  const byName = Object.fromEntries(items.map(i => [i.name, i]));
  assert.equal(byName['a@m'].status, 'active');
  assert.equal(byName['b@m'].status, 'disabled');
});

test('scanClaudeMd: глобальный CLAUDE.md', () => {
  const root = tmpRoot();
  const claudeDir = path.join(root, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), 'правила проекта');
  const claudeJsonPath = path.join(root, '.claude.json');
  fs.writeFileSync(claudeJsonPath, JSON.stringify({ projects: {} }));
  const items = scanClaudeMd({ claudeDir, claudeJsonPath });
  assert.equal(items.length, 1);
  assert.equal(items[0].category, 'claudemd');
  assert.ok(items[0].descText.includes('правила проекта'));
});

test('scanInventory: объединяет категории без падения на пустых путях', () => {
  const root = tmpRoot();
  const items = scanInventory({
    skillsDir: path.join(root, 'nope-skills'),
    claudeDir: path.join(root, '.claude'),
    claudeJsonPath: path.join(root, 'missing.json'),
    settingsPath: path.join(root, 'missing-settings.json'),
  });
  assert.ok(Array.isArray(items));
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/scan.test.js 2>&1 | tail -8
```
Expected: FAIL — `scanMcp`/`scanPlugins`/`scanClaudeMd`/`scanInventory` не экспортированы.

- [ ] **Step 3: Дописать `scan.js`**

Добавить в `clean-context/lib/scan.js`:
```js
export function scanMcp(config) {
  const items = [];
  let data = {};
  try { data = JSON.parse(fs.readFileSync(config.claudeJsonPath, 'utf8')); } catch {}
  const addServers = (servers, scope) => {
    for (const [name, cfg] of Object.entries(servers || {})) {
      items.push({ category: 'mcp', name, status: 'active', scope, path: config.claudeJsonPath, descText: JSON.stringify(cfg) });
    }
  };
  addServers(data.mcpServers, 'global');
  for (const [proj, pcfg] of Object.entries(data.projects || {})) addServers(pcfg.mcpServers, proj);
  if (config.mcpDisabledDir && fs.existsSync(config.mcpDisabledDir)) {
    for (const file of fs.readdirSync(config.mcpDisabledDir)) {
      if (!file.endsWith('.json') || file.endsWith('.bak.json') || file.includes('.bak')) continue;
      items.push({ category: 'mcp', name: file.replace(/\.json$/, ''), status: 'disabled', path: path.join(config.mcpDisabledDir, file), descText: '' });
    }
  }
  return items;
}

export function scanPlugins(config) {
  const items = [];
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(config.settingsPath, 'utf8')); } catch {}
  for (const [name, enabled] of Object.entries(settings.enabledPlugins || {})) {
    items.push({ category: 'plugin', name, status: enabled ? 'active' : 'disabled', path: config.settingsPath, descText: '' });
  }
  return items;
}

export function scanClaudeMd(config) {
  const items = [];
  const candidates = new Set();
  if (config.claudeDir) candidates.add(path.join(config.claudeDir, 'CLAUDE.md'));
  try {
    const data = JSON.parse(fs.readFileSync(config.claudeJsonPath, 'utf8'));
    for (const proj of Object.keys(data.projects || {})) candidates.add(path.join(proj, 'CLAUDE.md'));
  } catch {}
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    items.push({ category: 'claudemd', name: p, status: 'active', path: p, descText: fs.readFileSync(p, 'utf8') });
  }
  return items;
}

export function scanHooks(config) {
  const items = [];
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(config.settingsPath, 'utf8')); } catch {}
  for (const [event, arr] of Object.entries(settings.hooks || {})) {
    items.push({ category: 'hook', name: event, status: 'active', path: config.settingsPath, descText: JSON.stringify(arr) });
  }
  return items;
}

export function scanInventory(config) {
  return [
    ...scanSkills(config),
    ...scanAgents(config),
    ...scanMcp(config),
    ...scanPlugins(config),
    ...scanClaudeMd(config),
    ...scanHooks(config),
  ];
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/scan.test.js 2>&1 | tail -6
```
Expected: PASS — `pass 6`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/lib/scan.js clean-context/test/scan.test.js
git commit -m "feat: scan mcp, plugins, claude.md, hooks"
```

---

## Task 5: Оценщик стоимости `cost.js`

**Files:**
- Create: `clean-context/lib/cost.js`
- Test: `clean-context/test/cost.test.js`

- [ ] **Step 1: Написать падающий тест**

`clean-context/test/cost.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCosts, totalsByCategory } from '../lib/cost.js';

test('addCosts проставляет estTokens', () => {
  const out = addCosts([{ category: 'skill', descText: 'abcd' }]);
  assert.equal(out[0].estTokens, 1);
});
test('totalsByCategory суммирует по категориям', () => {
  const t = totalsByCategory([
    { category: 'skill', estTokens: 5 },
    { category: 'skill', estTokens: 5 },
    { category: 'agent', estTokens: 3 },
  ]);
  assert.equal(t.skill, 10);
  assert.equal(t.agent, 3);
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/cost.test.js 2>&1 | tail -5
```
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

`clean-context/lib/cost.js`:
```js
import { estimateTokens } from './tokens.js';

export function addCosts(items) {
  return items.map((it) => ({ ...it, estTokens: estimateTokens(it.descText || '') }));
}

export function totalsByCategory(items) {
  const totals = {};
  for (const it of items) totals[it.category] = (totals[it.category] || 0) + (it.estTokens || 0);
  return totals;
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/cost.test.js 2>&1 | tail -5
```
Expected: PASS — `pass 2`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/lib/cost.js clean-context/test/cost.test.js
git commit -m "feat: cost estimator"
```

---

## Task 6: Сверка с использованием `usage.js`

**Files:**
- Create: `clean-context/lib/usage.js`
- Test: `clean-context/test/usage.test.js`

- [ ] **Step 1: Написать падающий тест**

`clean-context/test/usage.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addUsage } from '../lib/usage.js';

const NOW = 1781346971761;
const DAY = 86400000;

test('джойнит usage скила по точному имени', () => {
  const usage = { skillUsage: { foo: { usageCount: 3, lastUsedAt: NOW - 5 * DAY } }, pluginUsage: {} };
  const [it] = addUsage([{ category: 'skill', name: 'foo' }], usage, NOW);
  assert.equal(it.usageCount, 3);
  assert.equal(it.daysSinceUse, 5);
});

test('джойнит plugin-скил по суффиксу name', () => {
  const usage = { skillUsage: { 'superpowers:brainstorming': { usageCount: 75, lastUsedAt: NOW } }, pluginUsage: {} };
  const [it] = addUsage([{ category: 'skill', name: 'brainstorming' }], usage, NOW);
  assert.equal(it.usageCount, 75);
});

test('неизвестный скил -> usageCount null', () => {
  const [it] = addUsage([{ category: 'skill', name: 'zzz' }], { skillUsage: {}, pluginUsage: {} }, NOW);
  assert.equal(it.usageCount, null);
  assert.equal(it.daysSinceUse, null);
});

test('плагин берёт usage из pluginUsage', () => {
  const usage = { skillUsage: {}, pluginUsage: { 'ralph-loop@m': { usageCount: 880, lastUsedAt: NOW } } };
  const [it] = addUsage([{ category: 'plugin', name: 'ralph-loop@m' }], usage, NOW);
  assert.equal(it.usageCount, 880);
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/usage.test.js 2>&1 | tail -5
```
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

`clean-context/lib/usage.js`:
```js
import fs from 'node:fs';

export function loadUsage(claudeJsonPath) {
  try {
    const d = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    return { skillUsage: d.skillUsage || {}, pluginUsage: d.pluginUsage || {} };
  } catch {
    return { skillUsage: {}, pluginUsage: {} };
  }
}

// Локальные скилы лежат под голым именем, плагинные — под 'plugin:skill'.
function matchSuffix(map, name) {
  for (const k of Object.keys(map)) if (k.endsWith(':' + name)) return map[k];
  return null;
}

export function addUsage(items, usage, now) {
  const DAY = 86400000;
  return items.map((it) => {
    let rec = null;
    if (it.category === 'skill') rec = usage.skillUsage[it.name] || matchSuffix(usage.skillUsage, it.name);
    else if (it.category === 'plugin') rec = usage.pluginUsage[it.name];
    const usageCount = rec ? (rec.usageCount ?? 0) : null;
    const lastUsedAt = rec ? (rec.lastUsedAt ?? null) : null;
    const daysSinceUse = lastUsedAt ? Math.floor((now - lastUsedAt) / DAY) : null;
    return { ...it, usageCount, lastUsedAt, daysSinceUse };
  });
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/usage.test.js 2>&1 | tail -5
```
Expected: PASS — `pass 4`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/lib/usage.js clean-context/test/usage.test.js
git commit -m "feat: usage join"
```

---

## Task 7: Движок рекомендаций `recommend.js`

**Files:**
- Create: `clean-context/lib/recommend.js`
- Test: `clean-context/test/recommend.test.js`

- [ ] **Step 1: Написать падающий тест**

`clean-context/test/recommend.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../lib/recommend.js';

const skill = (o) => ({ category: 'skill', status: 'active', estTokens: 10, usageCount: 5, daysSinceUse: 1, name: 'x', ...o });

test('помечает ни разу не использованный активный скил', () => {
  const r = recommend([skill({ usageCount: 0, daysSinceUse: null })]);
  assert.equal(r.toDisable.length, 1);
  assert.equal(r.toDisable[0].auto, true);
  assert.match(r.toDisable[0].reason, /ни разу/);
});
test('помечает устаревший скил (> staleDays)', () => {
  const r = recommend([skill({ usageCount: 2, daysSinceUse: 40 })], { staleDays: 30 });
  assert.equal(r.toDisable.length, 1);
});
test('оставляет свежий скил', () => {
  const r = recommend([skill({ usageCount: 2, daysSinceUse: 3 })]);
  assert.equal(r.toDisable.length, 0);
  assert.equal(r.keep.length, 1);
});
test('скил без статистики не трогаем', () => {
  const r = recommend([skill({ usageCount: null, daysSinceUse: null })]);
  assert.equal(r.toDisable.length, 0);
  assert.equal(r.keep.length, 1);
});
test('wrong-direction: выключен, но активно использован', () => {
  const r = recommend([skill({ status: 'disabled', usageCount: 880, daysSinceUse: 1 })]);
  assert.equal(r.wrongDirection.length, 1);
});
test('агент идёт в manualReview, не в toDisable', () => {
  const r = recommend([{ category: 'agent', status: 'active', name: 'a', estTokens: 50, usageCount: null, daysSinceUse: null }]);
  assert.equal(r.toDisable.length, 0);
  assert.equal(r.manualReview.length, 1);
});
test('toDisable отсортирован по estTokens по убыванию', () => {
  const r = recommend([
    skill({ name: 'a', usageCount: 0, daysSinceUse: null, estTokens: 5 }),
    skill({ name: 'b', usageCount: 0, daysSinceUse: null, estTokens: 50 }),
  ]);
  assert.equal(r.toDisable[0].name, 'b');
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/recommend.test.js 2>&1 | tail -5
```
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

`clean-context/lib/recommend.js`:
```js
// Классифицирует инвентарь. Авто-отключение разрешено только скилам и MCP
// (низкий риск, обратимо). Плагины — рекомендация. Агенты — только manualReview
// (нет прямой статистики использования).
export function recommend(items, opts = {}) {
  const staleDays = opts.staleDays ?? 30;
  const toDisable = [];
  const wrongDirection = [];
  const manualReview = [];
  const keep = [];

  for (const it of items) {
    const canAuto = it.category === 'skill' || it.category === 'mcp';
    const hasUsageData = it.category === 'skill' || it.category === 'plugin';

    if (it.status === 'active' && hasUsageData && it.usageCount !== null) {
      const unused = it.usageCount === 0 || (it.daysSinceUse !== null && it.daysSinceUse > staleDays);
      if (unused) {
        toDisable.push({
          ...it,
          auto: canAuto,
          reason: it.usageCount === 0 ? 'ни разу не использован' : `не использован ${it.daysSinceUse} дн.`,
        });
        continue;
      }
    }

    if (it.status === 'disabled' && it.usageCount && it.usageCount > 20) {
      wrongDirection.push({ ...it, reason: `выключен, но использован ${it.usageCount} раз` });
      continue;
    }

    if (it.category === 'agent' && it.status === 'active') {
      manualReview.push(it);
      continue;
    }

    keep.push(it);
  }

  toDisable.sort((a, b) => (b.estTokens || 0) - (a.estTokens || 0));
  manualReview.sort((a, b) => (b.estTokens || 0) - (a.estTokens || 0));
  return { toDisable, wrongDirection, manualReview, keep };
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/recommend.test.js 2>&1 | tail -5
```
Expected: PASS — `pass 7`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/lib/recommend.js clean-context/test/recommend.test.js
git commit -m "feat: recommendation engine"
```

---

## Task 8: Рендер отчёта `report.js`

**Files:**
- Create: `clean-context/lib/report.js`
- Test: `clean-context/test/report.test.js`

- [ ] **Step 1: Написать падающий тест**

`clean-context/test/report.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../lib/report.js';

test('рендерит ключевые секции', () => {
  const items = [{ category: 'skill', name: 'x', estTokens: 10 }];
  const result = {
    toDisable: [{ category: 'skill', name: 'x', estTokens: 10, auto: true, reason: 'ни разу не использован' }],
    wrongDirection: [],
    manualReview: [],
    keep: [],
  };
  const out = renderReport(result, items);
  assert.match(out, /Стартовая плата/);
  assert.match(out, /Рекомендую отключить/);
  assert.match(out, /skill\/x/);
});

test('пустой toDisable -> дружелюбная строка', () => {
  const out = renderReport({ toDisable: [], wrongDirection: [], manualReview: [], keep: [] }, []);
  assert.match(out, /нечего/);
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/report.test.js 2>&1 | tail -5
```
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

`clean-context/lib/report.js`:
```js
import { totalsByCategory } from './cost.js';

export function renderReport(result, items) {
  const lines = [];
  const total = items.reduce((s, i) => s + (i.estTokens || 0), 0);
  const totals = totalsByCategory(items);

  lines.push('# Клинер контекста — отчёт');
  lines.push('');
  lines.push(`Стартовая плата (оценка): ~${total} токенов`);
  lines.push('Разбивка по категориям:');
  for (const [cat, t] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    lines.push(`  - ${cat}: ~${t}`);
  }
  lines.push('');

  const reclaim = result.toDisable.reduce((s, i) => s + (i.estTokens || 0), 0);
  lines.push(`## Рекомендую отключить (вернём ~${reclaim} токенов)`);
  if (result.toDisable.length === 0) lines.push('  — нечего, всё используется. 👍');
  for (const it of result.toDisable) {
    lines.push(`  - [${it.auto ? 'авто' : 'спрос'}] ${it.category}/${it.name} — ~${it.estTokens} ток. (${it.reason})`);
  }
  lines.push('');

  if (result.wrongDirection.length) {
    lines.push('## ⚠️ Возможно отключено нужное');
    for (const it of result.wrongDirection) lines.push(`  - ${it.category}/${it.name} — ${it.reason}`);
    lines.push('');
  }

  if (result.manualReview.length) {
    lines.push('## Агенты — решить вручную (нет статистики использования)');
    for (const it of result.manualReview) lines.push(`  - ${it.name} — ~${it.estTokens} ток.`);
    lines.push('');
  }

  lines.push('## Гигиена контекста');
  lines.push('  - Одна сессия = одна задача; /clear между задачами (история — главный пожиратель).');
  lines.push('  - Тяжёлое чтение — через субагентов: у них свой контекст.');
  lines.push('  - Короткие описания скилов/агентов; CLAUDE.md — только необходимое.');
  lines.push('  - MCP включать точечно.');
  return lines.join('\n');
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/report.test.js 2>&1 | tail -5
```
Expected: PASS — `pass 2`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/lib/report.js clean-context/test/report.test.js
git commit -m "feat: report renderer"
```

---

## Task 9: Применение и откат `apply.js` + `restore.js`

**Files:**
- Create: `clean-context/lib/apply.js`
- Create: `clean-context/lib/restore.js`
- Test: `clean-context/test/apply.test.js`

- [ ] **Step 1: Написать падающий тест**

`clean-context/test/apply.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyDisable } from '../lib/apply.js';
import { restoreAll } from '../lib/restore.js';

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-apply-'));
  const config = {
    skillsDir: path.join(root, 'skills'),
    skillsDisabledDir: path.join(root, 'skills-disabled'),
    agentsDir: path.join(root, 'agents'),
    agentsDisabledDir: path.join(root, 'agents-disabled'),
    settingsPath: path.join(root, 'settings.json'),
  };
  fs.mkdirSync(path.join(config.skillsDir, 'alpha'), { recursive: true });
  fs.writeFileSync(path.join(config.skillsDir, 'alpha', 'SKILL.md'), 'x');
  fs.writeFileSync(config.settingsPath, JSON.stringify({ enabledPlugins: { 'p@m': true } }, null, 2));
  return { root, config, log: path.join(root, 'ops.jsonl') };
}

test('переносит скил в disabled и откатывает обратно', () => {
  const { config, log } = setup();
  const sel = [{ category: 'skill', name: 'alpha', path: path.join(config.skillsDir, 'alpha') }];
  applyDisable(sel, config, log);
  assert.ok(!fs.existsSync(path.join(config.skillsDir, 'alpha')));
  assert.ok(fs.existsSync(path.join(config.skillsDisabledDir, 'alpha')));
  restoreAll(log, config);
  assert.ok(fs.existsSync(path.join(config.skillsDir, 'alpha')));
  assert.ok(!fs.existsSync(path.join(config.skillsDisabledDir, 'alpha')));
});

test('переключает плагин в false и откатывает', () => {
  const { config, log } = setup();
  applyDisable([{ category: 'plugin', name: 'p@m', path: config.settingsPath }], config, log);
  let s = JSON.parse(fs.readFileSync(config.settingsPath, 'utf8'));
  assert.equal(s.enabledPlugins['p@m'], false);
  restoreAll(log, config);
  s = JSON.parse(fs.readFileSync(config.settingsPath, 'utf8'));
  assert.equal(s.enabledPlugins['p@m'], true);
});

test('лог очищается после restoreAll', () => {
  const { config, log } = setup();
  applyDisable([{ category: 'skill', name: 'alpha', path: path.join(config.skillsDir, 'alpha') }], config, log);
  restoreAll(log, config);
  assert.equal(fs.readFileSync(log, 'utf8').trim(), '');
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/apply.test.js 2>&1 | tail -5
```
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Реализовать `apply.js`**

`clean-context/lib/apply.js`:
```js
import fs from 'node:fs';
import path from 'node:path';

function backup(file) {
  const bak = file + '.bak';
  if (fs.existsSync(file)) fs.copyFileSync(file, bak);
  return bak;
}

function appendLog(logPath, ops) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  for (const op of ops) fs.appendFileSync(logPath, JSON.stringify(op) + '\n');
}

function moveFile(sel, destDir, stamp) {
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(sel.path));
  fs.renameSync(sel.path, dest);
  return { type: 'move', category: sel.category, name: sel.name, from: sel.path, to: dest, at: stamp };
}

function togglePlugin(sel, config, enabled, stamp) {
  const file = config.settingsPath;
  const bak = backup(file);
  const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  settings.enabledPlugins = settings.enabledPlugins || {};
  const prev = settings.enabledPlugins[sel.name];
  settings.enabledPlugins[sel.name] = enabled;
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return { type: 'plugin-toggle', name: sel.name, from: prev, to: enabled, file, backup: bak, at: stamp };
}

function moveMcpOut(sel, config, stamp) {
  const file = config.claudeJsonPath;
  const bak = backup(file);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cfg = (data.mcpServers || {})[sel.name];
  fs.mkdirSync(config.mcpDisabledDir, { recursive: true });
  const dest = path.join(config.mcpDisabledDir, sel.name + '.json');
  fs.writeFileSync(dest, JSON.stringify({ [sel.name]: cfg }, null, 2) + '\n');
  delete data.mcpServers[sel.name];
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return { type: 'mcp-move', name: sel.name, to: dest, file, backup: bak, at: stamp };
}

export function applyDisable(selections, config, logPath) {
  const stamp = Date.now();
  const ops = [];
  for (const sel of selections) {
    if (sel.category === 'skill') ops.push(moveFile(sel, config.skillsDisabledDir, stamp));
    else if (sel.category === 'agent') ops.push(moveFile(sel, config.agentsDisabledDir, stamp));
    else if (sel.category === 'plugin') ops.push(togglePlugin(sel, config, false, stamp));
    else if (sel.category === 'mcp') ops.push(moveMcpOut(sel, config, stamp));
  }
  appendLog(logPath, ops);
  return ops;
}
```

- [ ] **Step 4: Реализовать `restore.js`**

`clean-context/lib/restore.js`:
```js
import fs from 'node:fs';
import path from 'node:path';

export function restoreAll(logPath, config) {
  if (!fs.existsSync(logPath)) return [];
  const ops = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).reverse();
  const done = [];
  for (const op of ops) {
    if (op.type === 'move') {
      fs.mkdirSync(path.dirname(op.from), { recursive: true });
      fs.renameSync(op.to, op.from);
    } else if (op.type === 'plugin-toggle') {
      const s = JSON.parse(fs.readFileSync(op.file, 'utf8'));
      s.enabledPlugins = s.enabledPlugins || {};
      if (op.from === undefined) delete s.enabledPlugins[op.name];
      else s.enabledPlugins[op.name] = op.from;
      fs.writeFileSync(op.file, JSON.stringify(s, null, 2) + '\n');
    } else if (op.type === 'mcp-move') {
      const data = JSON.parse(fs.readFileSync(op.file, 'utf8'));
      const restored = JSON.parse(fs.readFileSync(op.to, 'utf8'));
      data.mcpServers = data.mcpServers || {};
      Object.assign(data.mcpServers, restored);
      fs.writeFileSync(op.file, JSON.stringify(data, null, 2) + '\n');
      fs.rmSync(op.to);
    }
    done.push(op);
  }
  fs.writeFileSync(logPath, '');
  return done;
}
```

- [ ] **Step 5: Запустить — убедиться, что проходит**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test test/apply.test.js 2>&1 | tail -5
```
Expected: PASS — `pass 3`.

- [ ] **Step 6: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/lib/apply.js clean-context/lib/restore.js clean-context/test/apply.test.js
git commit -m "feat: reversible apply and restore"
```

---

## Task 10: CLI-обёртки `bin/audit.js`, `bin/apply.js`, `bin/restore.js`

**Files:**
- Create: `clean-context/bin/audit.js`
- Create: `clean-context/bin/apply.js`
- Create: `clean-context/bin/restore.js`

- [ ] **Step 1: Создать `bin/audit.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../lib/paths.js';
import { scanInventory } from '../lib/scan.js';
import { addCosts } from '../lib/cost.js';
import { loadUsage, addUsage } from '../lib/usage.js';
import { recommend } from '../lib/recommend.js';
import { renderReport } from '../lib/report.js';

const config = defaultConfig();
const now = Date.now();
let items = scanInventory(config);
items = addCosts(items);
items = addUsage(items, loadUsage(config.claudeJsonPath), now);
const result = recommend(items, { staleDays: config.staleDays });

const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = path.join(skillRoot, '.state');
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(path.join(stateDir, 'last-audit.json'), JSON.stringify({ now, items, result }, null, 2));

console.log(renderReport(result, items));
```

- [ ] **Step 2: Создать `bin/apply.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../lib/paths.js';
import { applyDisable } from '../lib/apply.js';

const config = defaultConfig();
const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stateDir = path.join(skillRoot, '.state');
const audit = JSON.parse(fs.readFileSync(path.join(stateDir, 'last-audit.json'), 'utf8'));

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Укажи имена для отключения: node bin/apply.js <name> [<name> ...]');
  process.exit(1);
}
const pool = [...audit.result.toDisable, ...audit.result.manualReview];
const selections = names
  .map((n) => pool.find((it) => it.name === n))
  .filter(Boolean)
  .map((it) => ({ category: it.category, name: it.name, path: it.path }));

const missing = names.filter((n) => !pool.some((it) => it.name === n));
if (missing.length) console.error('Не найдены в последнем аудите:', missing.join(', '));

const ops = applyDisable(selections, config, path.join(stateDir, 'operations.log.jsonl'));
console.log(`Отключено: ${ops.length}`);
for (const op of ops) console.log('  -', op.name, '|', op.type, '->', op.to || op.file);
```

- [ ] **Step 3: Создать `bin/restore.js`**

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig } from '../lib/paths.js';
import { restoreAll } from '../lib/restore.js';

const config = defaultConfig();
const skillRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const log = path.join(skillRoot, '.state', 'operations.log.jsonl');
const done = restoreAll(log, config);
console.log(`Восстановлено операций: ${done.length}`);
for (const op of done) console.log('  -', op.name, '|', op.type);
```

- [ ] **Step 4: Дымовой прогон аудита на реальном `~/.claude`**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node bin/audit.js 2>&1 | head -40
```
Expected: печатается отчёт с «Стартовая плата», разбивкой по категориям и секцией «Рекомендую отключить»; в `.state/last-audit.json` появляется файл. (Ничего не меняется — аудит только читает.)

- [ ] **Step 5: Проверить, что состояние записано**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node -e "const a=require('node:fs').readFileSync('.state/last-audit.json','utf8');const d=JSON.parse(a);console.log('items:',d.items.length,'toDisable:',d.result.toDisable.length,'manualReview:',d.result.manualReview.length)"
```
Expected: печатает ненулевое число items и числа рекомендаций.

- [ ] **Step 6: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/bin/
git commit -m "feat: CLI wrappers for audit, apply, restore"
```

---

## Task 11: Скилл `SKILL.md` и установка

**Files:**
- Create: `clean-context/SKILL.md`
- Create: `clean-context/scripts/install.sh`

- [ ] **Step 1: Создать `SKILL.md`**

```markdown
---
name: clean-context
description: Аудит и уборка стартовой платы за контекст Claude Code. Использовать при запросах «почисти контекст», «что жрёт контекст», «clean-context», «какие скилы/MCP/агенты лишние». Делает полный обход конфигурации, сверяет с реальной статистикой использования и обратимо отключает неиспользуемое.
---

# Клинер контекста

Скилл аудита и обратимой уборки того, что грузится в контекст на старте сессии:
скилы, агенты, MCP-серверы, плагины, CLAUDE.md, hooks.

## Когда использовать
Запросы вида «почисти контекст», «что жрёт контекст», «покажи лишнее», «clean-context».

## Как действовать

1. **Аудит.** Запусти:
   `node "$HOME/.claude/skills/clean-context/bin/audit.js"`
   Покажи пользователю отчёт целиком. Он только читает, ничего не меняет.

2. **Обсуждение.** Из секции «Рекомендую отключить» предложи пользователю, что
   отключить. Пометка `[авто]` — низкий риск (скил/MCP, обратимо), `[спрос]` —
   спрашивай отдельно. Агенты из «решить вручную» — только по явному выбору
   пользователя. Никогда не отключай ничего без подтверждения.

3. **Применение.** На выбранные имена запусти:
   `node "$HOME/.claude/skills/clean-context/bin/apply.js" <имя1> <имя2> ...`
   Имена берутся из последнего аудита. Операции обратимы (перенос, не удаление),
   пишутся в лог.

4. **Откат.** Если нужно вернуть всё, что отключено в последнем прогоне:
   `node "$HOME/.claude/skills/clean-context/bin/restore.js"`

5. **Напомни:** изменения вступают в силу с новой сессии Claude Code (стартовая
   плата фиксируется при запуске).

## Важно
- Только перемещение в `*-disabled`, никогда не удаление.
- Перед правкой `settings.json`/`.claude.json` создаётся `.bak`.
- Служебные файлы Claude Code (`.last-cleanup` и т.п.) не трогаются.
```

- [ ] **Step 2: Создать `scripts/install.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.claude/skills/clean-context"
if [ -L "$DEST" ] || [ -e "$DEST" ]; then rm -rf "$DEST"; fi
ln -s "$SRC" "$DEST"
echo "Симлинк создан: $DEST -> $SRC"
```

- [ ] **Step 3: Установить скилл**

Run:
```bash
chmod +x "/Users/natela/Documents/My_agents/Клининг контекста/clean-context/scripts/install.sh" && "/Users/natela/Documents/My_agents/Клининг контекста/clean-context/scripts/install.sh"
```
Expected: `Симлинк создан: ...`

- [ ] **Step 4: Проверить, что скилл виден и запускается по установленному пути**

Run:
```bash
test -f "$HOME/.claude/skills/clean-context/SKILL.md" && node "$HOME/.claude/skills/clean-context/bin/audit.js" 2>&1 | head -5
```
Expected: первые строки отчёта («# Клинер контекста — отчёт», «Стартовая плата...»).

- [ ] **Step 5: Прогнать весь тест-сьют целиком**

Run:
```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста/clean-context" && node --test 2>&1 | tail -6
```
Expected: все тесты зелёные (`fail 0`).

- [ ] **Step 6: Commit**

```bash
cd "/Users/natela/Documents/My_agents/Клининг контекста"
git add clean-context/SKILL.md clean-context/scripts/install.sh
git commit -m "feat: SKILL.md and install script"
```

---

## Финальная проверка (E2E «вживую», без авто-применения)

- [ ] **Step 1: Полный конвейер на реальной конфигурации, dry-run**

Run:
```bash
node "$HOME/.claude/skills/clean-context/bin/audit.js"
```
Expected: осмысленный отчёт; ручная сверка глазами — реально неиспользуемые
скилы (например, давно не вызывавшиеся) попадают в «Рекомендую отключить»,
активно используемые — нет; `firecrawl-*` уже в disabled и не предлагаются к
отключению; виден флаг «возможно отключено нужное» для `ralph-loop`, если он
проходит порог.

- [ ] **Step 2: (опционально, по желанию пользователя) проверить цикл apply→restore на одном безопасном скиле**

Это делается только с явного согласия пользователя на конкретном имени из отчёта,
после чего сразу `restore.js` возвращает всё назад.

---

## Заметки по реализации (ограничения MVP, осознанные)

- **Стоимость плагинов** в MVP не раскладывается на токены их вложенных скилов —
  плагины ранжируются по статистике использования (они «рекомендация», не
  авто-отключение). Точную токенную стоимость плагинов вынести в план этапа 2.
- **Стоимость MCP** оценивается грубо (по длине конфига сервера), т.к. реальный
  размер схем инструментов виден только при подключении. В этом окружении MCP
  отложенные (deferred), поэтому фактическая плата ещё ниже.
- **Запись `.claude.json`/`settings.json`** переформатирует файл в 2-пробельный
  JSON. Семантика сохраняется, перед записью создаётся `.bak`. Учтено осознанно.
- **Планировщик-будильник (компонент 7 спеки)** — отдельный план этапа 2:
  обёртка, гоняющая `audit.js` по расписанию и шлющая уведомление через
  существующий `claude-notifier`, только если `toDisable` непуст.

---

## Self-review (выполнено при написании плана)

- **Покрытие спеки:** Сканер инвентаря (Task 3–4), Оценщик стоимости (Task 5),
  Сверка с использованием (Task 6), Движок рекомендаций (Task 7), Отчёт (Task 8),
  Применение+обратимость (Task 9), CLI+скилл (Task 10–11). Гигиена контекста —
  в `report.js` (Task 8). Планировщик (компонент 7) осознанно вынесен в этап 2.
- **Плейсхолдеры:** нет — во всех шагах реальный код и команды.
- **Согласованность типов:** единая модель `Item`; имена функций совпадают между
  задачами (`scanSkills/scanAgents/scanMcp/scanPlugins/scanClaudeMd/scanHooks/
  scanInventory`, `addCosts/totalsByCategory`, `loadUsage/addUsage`, `recommend`,
  `renderReport`, `applyDisable`, `restoreAll`, `defaultConfig`).
