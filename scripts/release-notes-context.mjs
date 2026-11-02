import { parseArgs } from 'node:util';
import { gitText } from '../src/release/commands.mjs';
const { values } = parseArgs({
  options: { since: { type: 'string' }, until: { type: 'string', default: 'HEAD' } },
});
const range = values.since ? `${values.since}..${values.until}` : values.until;
console.log(gitText(['log', '--date=short', '--format=%h %ad %s%n%b', '--name-only', range]));
