import { readFile } from 'node:fs/promises';
import path from 'node:path';

const maximumBytes = 5 * 1024 * 1024;

export function thumbnailDataUrl(bytes) {
  if (!bytes.length || bytes.length > maximumBytes) {
    throw new Error('Thumbnail must be nonempty and at most 5 MiB');
  }
  let mime;
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) mime = 'image/png';
  else if (bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) mime = 'image/jpeg';
  else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
    mime = 'image/webp';
  else throw new Error('Thumbnail must be a PNG, JPEG or WebP image');
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

export async function loadThumbnail(entry, { directory, root }) {
  const filenames = entry.thumbnailFile
    ? [path.resolve(root, entry.thumbnailFile)]
    : ['png', 'jpg', 'jpeg', 'webp'].map(extension =>
        path.join(directory, `${entry.profileId}.${extension}`),
      );
  for (const filename of filenames) {
    try {
      return thumbnailDataUrl(await readFile(filename));
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`${entry.name}: ${error.message}`);
    }
  }
  throw new Error(
    `${entry.name}: missing thumbnail. Save a model snapshot as ${filenames[0]} or set thumbnailFile in model-catalogue.json`,
  );
}
