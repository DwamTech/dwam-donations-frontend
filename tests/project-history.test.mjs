import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { fixtureDetail } from './fixture.mjs';

async function moduleAt(file) {
  const text = await readFile(new URL(file, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { parseProject } = await moduleAt('../src/features/projects/data/contract.ts');
const { parseProjectQuery, backendProjectParams, projectHref, changeProjectFilters } = await moduleAt('../src/features/projects/data/query.ts');
const { publicProjectLabels } = await moduleAt('../src/features/projects/data/presentation.ts');

test('history classification is consumed from Laravel without inventing funding or execution facts', () => {
  for (const state of ['active', 'funded', 'expired', 'closed', 'reserved', 'upcoming', 'unavailable']) {
    const project = parseProject({ ...fixtureDetail(), public_state: state, accepts_donations: state === 'active' });
    assert.equal(project.public_state, state);
    assert.equal(project.collected_amount_minor, 1234);
    assert.equal(project.progress_percent, 12.34);
    assert(!publicProjectLabels[state].includes('تنفيذ'));
  }
});
test('missing or contradictory acceptance data fails closed rather than opening a historical form', () => {
  assert.throws(() => parseProject({ ...fixtureDetail(), public_state: 'closed', accepts_donations: true }));
  assert.throws(() => parseProject({ ...fixtureDetail(), public_state: undefined, accepts_donations: undefined }));
});
test('historical filters and pagination stay server-side and survive category/country changes', () => {
  const query = parseProjectQuery({ state: 'expired', country_code: 'EG', donation_project_category_id: '3', page: '2' });
  assert.equal(backendProjectParams(query, 12).get('state'), 'expired');
  assert.equal(backendProjectParams(query, 12).get('page'), '2');
  assert.match(projectHref(query), /state=expired/);
  assert.equal(changeProjectFilters(query, { country_code: 'SA' }).state, 'expired');
  assert.equal(changeProjectFilters(query, { country_code: 'SA' }).page, 1);
  assert.equal(parseProjectQuery({ state: 'unknown' }).state, undefined);
});
test('donation entry is guarded before the form and sitemap explicitly discovers public history', async () => {
  const entry = await readFile(new URL('../src/app/donate/[project]/page.tsx', import.meta.url), 'utf8');
  assert(entry.indexOf('if (!project.accepts_donations)') < entry.indexOf('<GuestDonationForm'));
  assert.match(await readFile(new URL('../src/app/sitemap.ts', import.meta.url), 'utf8'), /state: "all"/);
});
