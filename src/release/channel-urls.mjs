const prefix = 'https://raw.githubusercontent.com/modmoto/StarcraftTMG-Warhall/';
const pattern = new RegExp(`${prefix.replaceAll('.', '\\.')}((refs/heads/)?(main|test))/`, 'g');

export function channelUrls(text, branch) {
  if (!['main', 'test'].includes(branch)) throw new Error('Channel must be main or test');
  return text.replace(pattern, `${prefix}${branch}/`);
}
