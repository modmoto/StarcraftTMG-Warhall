import { readFileSync } from 'node:fs';
import path from 'node:path';
import { projectRoot } from './paths.mjs';

const version = JSON.parse(readFileSync(path.join(projectRoot, 'Starcraft/version.json'), 'utf8'));
export const publicationBranch = /\/(test)\/Starcraft\/manifest\.json$/.test(version.url)
  ? 'test'
  : 'main';
export const repositoryUrl = 'https://github.com/modmoto/StarcraftTMG-Warhall';
export const rawRepositoryUrl = `https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/${publicationBranch}`;
export const modelAssetBaseUrl = `${rawRepositoryUrl}/model-assets`;
export const manifestUrl = `${rawRepositoryUrl}/Starcraft/manifest.json`;
