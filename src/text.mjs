export function cleanRuleText(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/([A-Za-z])\s+('s\b)/g, '$1$2')
    .replace(/([A-Za-z])\s+(['’])(?=\s|$)/g, '$1$2')
    .replace(/\s*[•‣]\s*/g, '\n• ')
    .replace(/\s+(\d+\s+(?:CP|PE|BM):)/g, '\n$1')
    .trim();
}
