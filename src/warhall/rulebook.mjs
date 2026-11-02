import path from 'node:path';
import { readJson } from '../io.mjs';
import { projectRoot } from '../paths.mjs';

export async function loadRulebookRules() {
  const book = await readJson(path.join(projectRoot, 'rulebook.json'));
  const id = number => `rule_chapter_${number.replaceAll('.', '_')}`;
  const entries = book.chapters.map(chapter => {
    const children = book.chapters.filter(
      child =>
        child.number.startsWith(`${chapter.number}.`) &&
        child.number.split('.').length === chapter.number.split('.').length + 1,
    );
    const title =
      chapter.number === '8.7.4'
        ? `${chapter.title} (Hit, Surge, Armour, Evade, Damage)`
        : chapter.title;
    return {
      Id: id(chapter.number),
      Name: `${chapter.number} ${title}`,
      Type: 'Rule',
      Description: [
        `<i>Core rulebook, p. ${chapter.page - book.source.printedPageOffset}</i>`,
        chapter.text,
        ...children.map(
          child => `<link="${id(child.number)}">${child.number} ${child.title}</link>`,
        ),
      ]
        .filter(Boolean)
        .join('\n\n'),
    };
  });
  entries.push({
    Id: 'rule_chapter_11',
    Name: '11 Keyword Glossary And Definitions',
    Type: 'Rule',
    Description:
      'Keyword definitions are listed individually. Follow a linked keyword to read its full definition.',
  });
  return { entries, source: book.source, chapters: book.chapters };
}
