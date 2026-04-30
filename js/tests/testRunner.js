// Minimal test runner — no dependencies, no build step.
// Usage: describe('suite', () => { test('case', () => { assert(...) }) })
// Call runAll() once after all suites are registered to execute and render results.

const suites = [];
let currentSuite = null;

export function describe(name, fn) {
  currentSuite = { name, tests: [] };
  suites.push(currentSuite);
  fn();
  currentSuite = null;
}

export function test(name, fn) {
  if (!currentSuite) throw new Error(`test() called outside describe(): "${name}"`);
  currentSuite.tests.push({ name, fn });
}

export class AssertionError extends Error {}

export function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new AssertionError(message);
}

export function assertEqual(a, b, message) {
  if (a !== b) {
    throw new AssertionError(message ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

export function assertOneOf(value, options, message) {
  if (!options.includes(value)) {
    throw new AssertionError(message ?? `Expected one of [${options.join(', ')}], got ${JSON.stringify(value)}`);
  }
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runAll(outputEl) {
  let totalPass = 0, totalFail = 0;
  const lines = [];

  for (const suite of suites) {
    lines.push({ type: 'suite', text: suite.name });
    for (const t of suite.tests) {
      try {
        await t.fn();
        totalPass++;
        lines.push({ type: 'pass', text: `  ✓ ${t.name}` });
      } catch (err) {
        totalFail++;
        lines.push({ type: 'fail', text: `  ✗ ${t.name}`, detail: err.message });
      }
    }
  }

  const summaryType = totalFail === 0 ? 'pass' : 'fail';
  lines.push({ type: summaryType, text: `\n${totalPass} passed, ${totalFail} failed` });

  if (outputEl) {
    outputEl.innerHTML = lines.map(l => {
      const color = l.type === 'pass'  ? '#4fc16a'
                  : l.type === 'fail'  ? '#ff5555'
                  : l.type === 'suite' ? '#f8f8f2'
                  : '#aaa';
      const detail = l.detail ? `\n      ${l.detail}` : '';
      return `<span style="color:${color}">${escHtml(l.text + detail)}</span>`;
    }).join('\n');
  } else {
    for (const l of lines) {
      const method = l.type === 'fail' ? 'error' : 'log';
      console[method](l.text + (l.detail ? `\n  → ${l.detail}` : ''));
    }
  }

  return { totalPass, totalFail };
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
