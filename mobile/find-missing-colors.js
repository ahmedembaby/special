#!/usr/bin/env node
'use strict';
/**
 * find-missing-colors.js
 *
 * Finds every `Colors` reference that has no real binding in its module.
 * That is the sole cause of:
 *   ReferenceError: Property 'Colors' doesn't exist   (Hermes / iOS)
 *
 * Usage:  node find-missing-colors.js [projectRoot]
 */
const fs = require('fs');
const path = require('path');

const TARGET = 'Colors';
const ROOT = path.resolve(process.argv[2] || process.cwd());
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.expo', 'ios', 'android', 'assets',
  'dist', 'build', 'web-build', '.idea', '.vscode', 'coverage',
]);
const SRC_EXT = new Set(['.js', '.jsx', '.ts', '.tsx']);
const RESOLVE_EXT = ['.js', '.jsx', '.ts', '.tsx', '.json'];

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(p, out);
    } else if (SRC_EXT.has(path.extname(e.name))) {
      out.push(p);
    }
  }
  return out;
}

function resolveRelative(fromFile, spec) {
  if (!spec.startsWith('.')) return { kind: 'bare' };      // package import
  const base = path.resolve(path.dirname(fromFile), spec);
  const cands = [base];
  for (const ext of RESOLVE_EXT) cands.push(base + ext);
  for (const ext of RESOLVE_EXT) cands.push(path.join(base, 'index' + ext));
  for (const c of cands) {
    try { if (fs.statSync(c).isFile()) return { kind: 'ok', path: c }; } catch {}
  }
  return { kind: 'unresolved', tried: cands };
}

/** Blank out comments and string-literal bodies so `Colors` inside text never matches. */
function codeOnly(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = null;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (state === 'line') {
      if (c === '\n') { state = null; out += '\n'; } else out += ' ';
      i++; continue;
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { out += '  '; i += 2; state = null; }
      else { out += (c === '\n' ? '\n' : ' '); i++; }
      continue;
    }
    if (state === '"' || state === '\'' || state === '`') {
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (c === state) { state = null; out += c; i++; continue; }
      out += (c === '\n' ? '\n' : ' '); i++; continue;
    }
    if (c === '/' && d === '/') { state = 'line'; out += '  '; i += 2; continue; }
    if (c === '/' && d === '*') { state = 'block'; out += '  '; i += 2; continue; }
    if (c === '\'' || c === '"' || c === '`') { state = c; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

function parseImports(raw) {
  const list = [];
  const re = /\bimport\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(raw))) {
    list.push({ clause: m[1].trim(), spec: m[2], raw: m[0] });
  }
  const reReq = /(?:const|let|var)\s+([\s\S]*?)=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = reReq.exec(raw))) {
    list.push({ clause: m[1].trim(), spec: m[2], raw: m[0], req: true });
  }
  return list;
}

/** Does `imports` bind the local identifier `Colors`? */
function bindingFromImports(imports) {
  const bound = [];
  const notes = [];
  for (const imp of imports) {
    const clause = imp.clause;
    if (imp.req) {
      // const { Colors } = require('x')   |   const Colors = require('x').Colors
      if (new RegExp(`\\{[^}]*\\b${TARGET}\\b[^}]*\\}`).test(clause) && !new RegExp(`\\b${TARGET}\\s*:`).test(clause)) {
        bound.push(imp);
      } else if (new RegExp(`^${TARGET}$`).test(clause.replace(/\s/g, '')) || new RegExp(`\\.${TARGET}$`).test(clause.replace(/\s/g, ''))) {
        bound.push(imp);
      }
      continue;
    }
    const typeOnly = /^\s*type\s/.test(clause);
    const ns = new RegExp(`^\\*\\s+as\\s+(\\w+)$`).exec(clause.replace(/^[^,]*,\s*/, ''));
    const defaultOnly = new RegExp(`^${TARGET}$`).test(clause.replace(/\s/g, ''));
    // named: { Colors } or { type Colors } or { Colors as C }
    const named = clause.match(/\{([\s\S]*)\}/);
    let namedBinds = false;
    if (named) {
      for (const part of named[1].split(',')) {
        const seg = part.trim();
        if (!seg) continue;
        const pType = /^type\s+/.test(seg);
        const asMatch = seg.match(/^(\w+)\s+as\s+(\w+)$/);
        if (asMatch) {
          if (asMatch[1] === TARGET && asMatch[2] === TARGET) namedBinds = true;
          if (asMatch[1] === TARGET && asMatch[2] !== TARGET) notes.push({ kind: 'renamed', imp, to: asMatch[2] });
        } else if (seg === TARGET) {
          if (pType || typeOnly) notes.push({ kind: 'type-only', imp });
          else namedBinds = true;
        }
      }
    }
    if (namedBinds) bound.push(imp);
    else if (defaultOnly) { bound.push(imp); notes.push({ kind: 'default-import', imp }); }
    else if (ns) notes.push({ kind: 'namespace', imp, ns: ns[1] });
  }
  return { bound, notes };
}

/** Blank import / re-export / require statements: they declare or forward names, they do not use them. */
function blankStatements(code) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return code
    .replace(/\bimport\s+[\s\S]*?\bfrom\s*['"][^'"]*['"]/g, blank)
    .replace(/\bimport\s*['"][^'"]*['"]/g, blank)
    .replace(/\bexport\s*\{[\s\S]*?\}\s*from\s*['"][^'"]*['"]/g, blank)
    .replace(/\bexport\s*\*\s*(?:as\s+\w+\s*)?from\s*['"][^'"]*['"]/g, blank)
    .replace(/(?:const|let|var)\s+[\s\S]*?=\s*require\(\s*['"][^'"]*['"]\s*\)/g, blank);
}

function localDeclared(code) {
  return /(?:^|[^.\w$])(?:const|let|var|function|class)\s+Colors\b/.test(code) ||
         /(?:^|[^.\w$])(?:const|let|var)\s*\{[^}]*\bColors\b[^}]*\}/.test(code);
}

const files = walk(ROOT, []).sort();
const problems = [];
const warnings = [];

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  if (!new RegExp(`\\b${TARGET}\\b`).test(raw)) continue;
  const code = codeOnly(raw);
  const imports = parseImports(raw);
  const { bound, notes } = bindingFromImports(imports);

  // suspicious imports worth surfacing even if they "bind"
  for (const nt of notes) {
    if (nt.kind === 'type-only' || nt.kind === 'renamed' || nt.kind === 'namespace') {
      warnings.push({ file: f, note: nt });
    }
  }

  // unresolved relative import that should provide Colors
  for (const imp of imports) {
    const r = resolveRelative(f, imp.spec);
    if (r.kind === 'unresolved' && bound.includes(imp)) {
      problems.push({ file: f, line: 1, kind: 'unresolved-path', spec: imp.spec, tried: r.tried });
    }
  }

  if (localDeclared(code) || bound.length) continue;

  // no binding at all -> every identifier use is fatal
  const lines = blankStatements(code).split('\n');
  lines.forEach((ln, idx) => {
    const re = new RegExp(`\\b${TARGET}\\b`, 'g');
    if (re.test(ln)) {
      const orig = raw.split('\n')[idx] || '';
      problems.push({ file: f, line: idx + 1, kind: 'no-binding', snippet: orig.trim() });
    }
  });
}

const rel = (p) => path.relative(ROOT, p) || p;
const byFile = new Map();
for (const p of problems) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}

console.log(`\nScanned ${files.length} files under ${ROOT}\n`);
if (!byFile.size) {
  console.log('✅ No unbound `Colors` references found.');
} else {
  console.log(`❌ ${byFile.size} file(s) will throw "ReferenceError: Property 'Colors' doesn't exist":\n`);
  for (const [file, list] of byFile) {
    console.log(`  ${rel(file)}`);
    for (const it of list) {
      if (it.kind === 'no-binding') console.log(`     line ${it.line}: ${it.snippet}`);
      if (it.kind === 'unresolved-path') console.log(`     import "${it.spec}" does not resolve to a file`);
    }
    const imp = [...list].some((i) => i.kind === 'no-binding');
    if (imp) console.log(`     ↳ fix: add  import { ${TARGET} } from '<relative path to theme>';\n`);
  }
}
if (warnings.length) {
  console.log('\n⚠️  Fragile imports (resolve to undefined, or TS type-only):');
  for (const w of warnings) {
    const m = w.note;
    const label = m.kind === 'type-only' ? '`import type` — erased at compile time'
      : m.kind === 'renamed' ? `imported as \`${m.to}\` — bare \`Colors\` is undeclared`
      : `namespace import \`* as ${m.ns}\` — bare \`Colors\` is undeclared`;
    console.log(`   ${rel(w.file)}  from "${m.imp.spec}"  → ${label}`);
  }
}
console.log();
process.exitCode = byFile.size ? 1 : 0;
