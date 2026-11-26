import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from '../paths.mjs';
import { dataAssetBaseUrl } from '../urls.mjs';

// Vector source: rank badge requested by the user, with a real transparent background.
export const specialistBadgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<g fill="#fff" stroke="#13212c" stroke-width="6" stroke-linejoin="round">
<path d="M72 24H440V380L256 488 72 380Z M96 48V366L256 460 416 366V48Z" fill-rule="evenodd"/>
<path d="M256 78 276 137 338 137 288 174 307 233 256 197 205 233 224 174 174 137 236 137Z"/>
<path d="M144 236 256 294 368 236V292L256 350 144 292Z M144 330 256 388 368 330V386L256 444 144 386Z"/>
</g></svg>`;

export async function specialistIcon() {
  const directory = path.join(projectRoot, 'Starcraft/assets/icons');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'specialist.svg'), specialistBadgeSvg + '\n');
  await writeFile(
    path.join(directory, 'specialist.png'),
    await sharp(Buffer.from(specialistBadgeSvg)).png().toBuffer(),
  );
  return {
    Id: 'sc_icon_specialist',
    Name: 'Specialist',
    Type: 'unit',
    MatchingRuleName: 'rule_keyword_specialist',
    URL: `${dataAssetBaseUrl}/assets/icons/specialist.png`,
  };
}
