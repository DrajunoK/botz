/**
 * Quick messages one player can fire at the other during an online match. Only the index travels
 * (the receiver looks the text up), so nobody can send anything that is not on this list.
 */
export const QUICK_MESSAGES: readonly string[] = [
  "Loser !",
  "La prochaine est pour moi",
  "Le cours, c'est demain 7h",
  "Pas mal… pour un débutant",
  "Je t'ai laissé gagner",
];

/** Minimum gap between two messages from the same player. */
export const CHAT_COOLDOWN_MS = 3000;
