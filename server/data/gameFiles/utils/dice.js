function parseDice(diceStr) {
  // Very small parser: supports formats like '1d8', '2d6+1', '1d10-1'
  const m = String(diceStr).trim().match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!m) return null;
  return {
    count: parseInt(m[1], 10),
    sides: parseInt(m[2], 10),
    modifier: m[3] ? parseInt(m[3], 10) : 0,
  };
}

function rollDice(diceStr) {
  const parsed = parseDice(diceStr);
  if (!parsed) {
    const n = Number(diceStr);
    return Number.isFinite(n) ? n : 0;
  }
  let total = 0;
  for (let i = 0; i < parsed.count; i++) {
    total += Math.floor(Math.random() * parsed.sides) + 1;
  }
  total += parsed.modifier;
  return total;
}

module.exports = { parseDice, rollDice };
