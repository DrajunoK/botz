import { Difficulty } from "@/config/game";

export type MatchMode = "solo" | "passPlay";

export interface MatchConfig {
  mode: MatchMode;
  difficulty: Difficulty;
}
