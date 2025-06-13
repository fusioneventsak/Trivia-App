export interface AnswerRequest {
  activationId: string;
  roomId: string;
  playerId: string;
  playerName: string;
  answer: string;
  timeTakenMs: number;
}

export interface AnswerResponse {
  success: boolean;
  isCorrect: boolean;
  pointsAwarded: number;
  newScore: number;
  error?: string;
}

export interface PlayerStats {
  totalPoints: number;
  correctAnswers: number;
  totalAnswers: number;
  averageResponseTimeMs: number;
}