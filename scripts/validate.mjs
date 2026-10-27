import path from 'node:path';
import { defaultDataDirectory } from '../src/paths.mjs';
import { validatePackage } from '../src/warhall/validate.mjs';

const directory = process.argv[2] ? path.resolve(process.argv[2]) : defaultDataDirectory;

validatePackage(directory)
  .then(result => {
    console.log(`Valid: ${result.units} units, ${result.records} records, ${result.files} files.`);
  })
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
