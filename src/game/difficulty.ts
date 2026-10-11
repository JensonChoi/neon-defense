export type Difficulty = 'easy' | 'medium' | 'hard' | 'hardcore';
export const DIFFICULTIES: readonly Difficulty[] = Object.freeze(['easy', 'medium', 'hard', 'hardcore']);
export const DIFFICULTY_PROFILES = Object.freeze({
  easy: Object.freeze({ name: 'Easy', quantity: 1, health: 1, reactorHp: 20, description: 'Original campaign balance.' }),
  medium: Object.freeze({ name: 'Medium', quantity: 1.2, health: 1.35, reactorHp: 20, description: 'Denser waves, tougher enemies.' }),
  hard: Object.freeze({ name: 'Hard', quantity: 1.4, health: 1.75, reactorHp: 20, description: 'Heavy pressure on your defenses.' }),
  hardcore: Object.freeze({ name: 'Hardcore', quantity: 1.6, health: 2.25, reactorHp: 10, description: 'Maximum pressure, half the reactor HP.' }),
});
export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && DIFFICULTIES.includes(value as Difficulty);
}
