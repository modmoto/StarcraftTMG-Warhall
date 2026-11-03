export function upgradedHealth(value) {
  if (!Number.isInteger(value) || value <= 0) throw new Error('Invalid upgraded health');
  return `<color=#2596be>${value}</color><size=0>(${value})</size>`;
}

export function healthNumber(value) {
  if (/^[1-9]\d*$/.test(value ?? '')) return Number(value);
  const colored = value?.match(/^<color=#2596be>([1-9]\d*)<\/color><size=0>\((\d+)\)<\/size>$/);
  if (colored && colored[1] === colored[2]) return Number(colored[1]);
  return NaN;
}
