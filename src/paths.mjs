import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const defaultDataDirectory = path.join(projectRoot, 'Starcraft-test');
export const defaultNewRecruitDirectory = path.resolve(projectRoot, '../StarcraftTMG-NR');
export const defaultPdfCacheDirectory = path.join(projectRoot, '.cache/pdf');
