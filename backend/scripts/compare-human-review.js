import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { compareHumanReview } from '../src/evaluation/analysis.js';

try {
  const { values } = parseArgs({ options: {
    report: { type: 'string' }, review: { type: 'string' }, out: { type: 'string' },
  } });
  if (!values.report || !values.review) throw new Error('Required: --report report.json --review human-review.json [--out calibration.json]');
  const report = JSON.parse(await readFile(values.report, 'utf8'));
  const review = JSON.parse(await readFile(values.review, 'utf8'));
  const result = compareHumanReview(report, review);
  const output = JSON.stringify(result, null, 2);
  // Never overwrite a report or the completed human review by mistake.
  if (values.out) await writeFile(values.out, output + '\n', { flag: 'wx' });
  console.log(output);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
