export const GAMES = new Set(['snake', 'pong', 'shooter', 'minesweeper', 'pacman', 'brickbreaker', 'flappybird', 'tetris', 'tictactoe']);

export function validateScore(body) {
  if (!GAMES.has(body.game)) throw new Error('Unknown game.');
  if (!Number.isSafeInteger(body.scoreDelta) || body.scoreDelta < 1 || body.scoreDelta > 100000) {
    throw new Error('Score must be a whole number between 1 and 100000.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId || '')) {
    throw new Error('A UUID v4 requestId is required.');
  }
  return { ...body, xpGain: Math.max(1, Math.ceil(body.scoreDelta * 0.2)) };
}

export function badgesFor(game, score) {
  return [
    { id: 'first-score', title: 'First points', description: 'Save your first score.' },
    ...(score >= 100 ? [{ id: `${game}-century`, title: `${game}: Century club`, description: 'Earn 100 cumulative points in this game.' }] : []),
  ];
}
