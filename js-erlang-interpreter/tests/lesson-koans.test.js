import { TestFramework } from './test-framework.js';
import { KoanValidator } from '../src/koan-validator.js';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Tests every koan in every lesson, straight from the .mdx source.
//
// 1. Structure: required fields, exactly one blank, unique ids.
// 2. Validation: the KoanValidator used by the site accepts the documented
//    answer and rejects wrong ones.
// 3. Real Erlang (lessons from FIRST_STRICT_LESSON on, needs `escript` on
//    the PATH): koan code with the answer filled in must parse and compile,
//    `% => Term` comments are evaluated and compared, and every complete
//    module in a lesson code block must compile.

const FIRST_STRICT_LESSON = 8;
const MIN_KOANS = 6;
const MAX_KOANS = 8;

const here = path.dirname(fileURLToPath(import.meta.url));
const lessonsDir = path.resolve(here, '../../src/content/lessons');
const escriptPath = path.join(here, 'erlang', 'check_lessons.escript');

const test = new TestFramework();
const validator = new KoanValidator();

function loadLessons() {
  return fs.readdirSync(lessonsDir)
    .filter(name => name.endsWith('.mdx'))
    .sort()
    .map(name => {
      const source = fs.readFileSync(path.join(lessonsDir, name), 'utf8');
      const postNumber = Number((source.match(/^postNumber:\s*(\d+)/m) || [])[1]);
      return { name, source, postNumber, koans: extractKoans(source, name) };
    });
}

// The koans prop is a plain JavaScript array literal, so evaluate it.
function extractKoans(source, name) {
  const match = source.match(/koans=\{(\[[\s\S]*\])\}\s*\/>/);
  if (!match) return [];
  try {
    return new Function(`return ${match[1]};`)();
  } catch (error) {
    throw new Error(`${name}: koans prop is not valid JavaScript: ${error.message}`);
  }
}

function extractModules(source) {
  const blocks = [...source.matchAll(/```erlang[^\n]*\n([\s\S]*?)```/g)].map(m => m[1]);
  return blocks.filter(code => {
    const firstCode = code.split('\n').find(line => line.trim() && !line.trim().startsWith('%'));
    // Modules with local includes need files we do not have here.
    return firstCode && firstCode.startsWith('-module(') && !/-include\("/.test(code);
  });
}

function fillBlank(koan) {
  return koan.code.replace('___', koan.answer);
}

function wrongAnswersFor(koan) {
  const wrong = ['', 'definitely_not_the_answer', '{wrong, answer, here, ok}'];
  if (!isNaN(parseFloat(koan.answer))) {
    wrong.push(String(parseFloat(koan.answer) + 1));
  } else {
    wrong.push('424242');
  }
  return wrong;
}

function hasEscript() {
  return spawnSync('escript', ['-h'], { stdio: 'ignore' }).error === undefined;
}

// Returns a map of file name to failure reason. Empty map means all passed.
function runErlangChecks(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koans-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
    let output;
    try {
      output = execFileSync('escript', [escriptPath, dir], { encoding: 'utf8' });
    } catch (error) {
      output = `${error.stdout || ''}`;
      if (!output.trim()) throw error;
    }
    const failures = {};
    for (const line of output.split('\n')) {
      const match = line.match(/^fail (\S+) (.*)$/);
      if (match) failures[match[1]] = match[2];
    }
    return failures;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// LESSONS=08,09 limits the per-lesson checks to files with those prefixes.
const only = (process.env.LESSONS || '').split(',').map(s => s.trim()).filter(Boolean);
const selected = lesson => only.length === 0 || only.some(prefix => lesson.name.startsWith(prefix));

const allLessons = loadLessons();
const lessons = allLessons.filter(selected);
const withKoans = lessons.filter(lesson => lesson.koans.length > 0);
const strictLessons = lessons.filter(lesson => lesson.postNumber >= FIRST_STRICT_LESSON);
const erlangAvailable = hasEscript();

// The validator is async and the test framework is not, so resolve every
// validation up front.
const validations = new Map();
for (const lesson of withKoans) {
  for (const koan of lesson.koans) {
    const hint = koan.validation || 'value_check';
    const accepted = await validator.validateAnswer(String(koan.answer).trim(), String(koan.answer), hint);
    const wronglyAccepted = [];
    for (const wrong of wrongAnswersFor(koan)) {
      if (await validator.validateAnswer(wrong, String(koan.answer), hint)) {
        wronglyAccepted.push(wrong);
      }
    }
    validations.set(`${lesson.name}#${koan.id}`, { accepted, wronglyAccepted });
  }
}

test.describe('Lesson Koans - every lesson, parsed from the .mdx source', () => {

  if (only.length === 0) test.describe('Lesson files', () => {
    test.it('should find lessons with koans', () => {
      test.expect(withKoans.length > 0).toBeTrue();
    });

    test.it('should have no placeholder lessons left', () => {
      const stubs = lessons.filter(l => /Coming Soon/i.test(l.source)).map(l => l.name);
      test.expect(stubs).toEqual([]);
    });

    test.it('should number lessons sequentially with matching file names', () => {
      const problems = [];
      lessons.forEach((lesson, index) => {
        if (lesson.postNumber !== index) problems.push(`${lesson.name}: postNumber ${lesson.postNumber}, expected ${index}`);
        if (!lesson.name.startsWith(String(index).padStart(2, '0') + '-')) problems.push(`${lesson.name}: file prefix does not match position ${index}`);
      });
      test.expect(problems).toEqual([]);
    });

    test.it(`should give every lesson from ${FIRST_STRICT_LESSON} on ${MIN_KOANS}-${MAX_KOANS} koans`, () => {
      const problems = strictLessons
        .filter(l => l.koans.length < MIN_KOANS || l.koans.length > MAX_KOANS)
        .map(l => `${l.name}: ${l.koans.length} koans`);
      test.expect(problems).toEqual([]);
    });

    test.it('should use unique koan ids across all lessons', () => {
      const seen = new Map();
      const duplicates = [];
      for (const lesson of withKoans) {
        for (const koan of lesson.koans) {
          if (seen.has(koan.id)) duplicates.push(`${koan.id} (${seen.get(koan.id)} and ${lesson.name})`);
          seen.set(koan.id, lesson.name);
        }
      }
      test.expect(duplicates).toEqual([]);
    });
  });

  if (only.length > 0) {
    test.it(`should give the selected lessons ${MIN_KOANS}-${MAX_KOANS} koans with ids not used elsewhere`, () => {
      const problems = strictLessons
        .filter(l => l.koans.length < MIN_KOANS || l.koans.length > MAX_KOANS)
        .map(l => `${l.name}: ${l.koans.length} koans`);
      const ids = new Map();
      for (const lesson of allLessons) {
        for (const koan of lesson.koans) {
          if (ids.has(koan.id) && (selected(lesson) || selected(ids.get(koan.id)))) {
            problems.push(`duplicate id ${koan.id} (${ids.get(koan.id).name} and ${lesson.name})`);
          }
          ids.set(koan.id, lesson);
        }
      }
      test.expect(problems).toEqual([]);
    });
  }

  for (const lesson of withKoans) {
    const strict = lesson.postNumber >= FIRST_STRICT_LESSON;

    test.describe(`${lesson.name} (${lesson.koans.length} koans)`, () => {
      test.it('should have the required fields on every koan', () => {
        const problems = [];
        for (const koan of lesson.koans) {
          for (const field of ['id', 'question', 'code', 'answer']) {
            if (typeof koan[field] !== 'string' || koan[field].trim() === '') {
              problems.push(`${koan.id}: missing ${field}`);
            }
          }
          if (koan.validation && !['value_check', 'pattern_check'].includes(koan.validation)) {
            problems.push(`${koan.id}: unknown validation "${koan.validation}"`);
          }
        }
        test.expect(problems).toEqual([]);
      });

      if (strict) {
        test.it('should have exactly one blank in every koan', () => {
          const problems = lesson.koans
            .filter(koan => (koan.code.match(/___/g) || []).length !== 1)
            .map(koan => `${koan.id}: ${(koan.code.match(/___/g) || []).length} blanks`);
          test.expect(problems).toEqual([]);
        });

        test.it('should not put a blank in the question, hint or explanation', () => {
          const problems = lesson.koans
            .filter(koan => [koan.question, koan.hint, koan.explanation].some(text => text && text.includes('___')))
            .map(koan => koan.id);
          test.expect(problems).toEqual([]);
        });
      }

      test.it('should accept the documented answer', () => {
        const problems = lesson.koans
          .filter(koan => !validations.get(`${lesson.name}#${koan.id}`).accepted)
          .map(koan => `${koan.id}: "${koan.answer}" rejected`);
        test.expect(problems).toEqual([]);
      });

      if (strict) {
        test.it('should reject wrong answers', () => {
          const problems = lesson.koans
            .filter(koan => validations.get(`${lesson.name}#${koan.id}`).wronglyAccepted.length > 0)
            .map(koan => `${koan.id}: accepted ${JSON.stringify(validations.get(`${lesson.name}#${koan.id}`).wronglyAccepted)}`);
          test.expect(problems).toEqual([]);
        });
      }

      if (strict && erlangAvailable) {
        test.it('should be valid Erlang once the blank is filled in', () => {
          const files = {};
          lesson.koans.forEach(koan => { files[`${koan.id}.koan`] = fillBlank(koan); });
          const failures = runErlangChecks(files);
          test.expect(Object.entries(failures).map(([file, reason]) => `${file}: ${reason}`)).toEqual([]);
        });
      }
    });
  }

  if (erlangAvailable) {
    test.describe('Lesson code blocks', () => {
      for (const lesson of strictLessons) {
        const modules = extractModules(lesson.source);
        if (modules.length === 0) continue;
        test.it(`${lesson.name}: ${modules.length} complete module(s) should compile`, () => {
          const files = {};
          modules.forEach((code, index) => { files[`block${index + 1}.mod`] = code; });
          const failures = runErlangChecks(files);
          test.expect(Object.entries(failures).map(([file, reason]) => `${file}: ${reason}`)).toEqual([]);
        });
      }
    });
  } else {
    console.log('\n⚠️  escript not found, skipping real Erlang checks');
  }
});

test.summary();
