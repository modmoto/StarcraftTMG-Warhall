import { copyTestToLive } from '../src/data-copy.mjs';
import { projectRoot } from '../src/paths.mjs';

const version = await copyTestToLive(projectRoot);
console.log(`Copied Starcraft-test to Starcraft, data version ${version}.`);
console.log('Commit and push main, then publish the required production skins and menu bindings.');
