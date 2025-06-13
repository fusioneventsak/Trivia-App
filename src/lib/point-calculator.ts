// Base points for different activation types
export const POINT_VALUES = {
  MULTIPLE_CHOICE_CORRECT: 100,
  TEXT_ANSWER_CORRECT: 150,
  POLL_PARTICIPATION: 25,
  SOCIAL_WALL_POST: 50,
  STREAK_BONUS: 50,
  PERFECT_ROUND_BONUS: 200,
  SPEED_BONUS_MAX: 50,
  ATTENDANCE_POINTS: 10
};

// Time thresholds for bonus calculations (in milliseconds)
export const TIME_THRESHOLDS = {
  INSTANT: 1000,    // Under 1 second
  FAST: 3000,       // Under 3 seconds
  NORMAL: 5000,     // Under 5 seconds
  SLOW: 10000       // Under 10 seconds
};

/**
 * Calculate time bonus based on response time
 * @param responseTimeMs - Response time in milliseconds
 * @returns Time bonus multiplier (0 to 1)
 */
export function getTimeBonus(responseTimeMs: number): number {
  if (responseTimeMs <= TIME_THRESHOLDS.INSTANT) {
    return 1.0; // 100% bonus
  } else if (responseTimeMs <= TIME_THRESHOLDS.FAST) {
    return 0.75; // 75% bonus
  } else if (responseTimeMs <= TIME_THRESHOLDS.NORMAL) {
    return 0.5; // 50% bonus
  } else if (responseTimeMs <= TIME_THRESHOLDS.SLOW) {
    return 0.25; // 25% bonus
  }
  return 0; // No bonus
}

/**
 * Calculate points for a correct answer with time bonus
 * @param basePoints - Base points for the question type
 * @param timeBonusMultiplier - Time bonus multiplier (0 to 1)
 * @returns Total points earned
 */
export function calculatePoints(
  basePoints: number,
  timeBonusMultiplier: number = 0
): number {
  const timeBonus = Math.round(basePoints * timeBonusMultiplier * 0.5); // Max 50% extra points
  return basePoints + timeBonus;
}

/**
 * Calculate streak bonus based on consecutive correct answers
 * @param streakCount - Number of consecutive correct answers
 * @returns Streak bonus points
 */
export function calculateStreakBonus(streakCount: number): number {
  if (streakCount < 3) return 0;
  
  // Bonus starts at 3 correct answers and increases
  const bonusMultiplier = Math.min(streakCount - 2, 5); // Cap at 5x
  return POINT_VALUES.STREAK_BONUS * bonusMultiplier;
}

/**
 * Calculate accuracy bonus for high accuracy players
 * @param correctAnswers - Number of correct answers
 * @param totalAnswers - Total number of answers
 * @returns Accuracy bonus points
 */
export function calculateAccuracyBonus(
  correctAnswers: number,
  totalAnswers: number
): number {
  if (totalAnswers < 5) return 0; // Need at least 5 answers
  
  const accuracy = correctAnswers / totalAnswers;
  
  if (accuracy >= 1.0) {
    return POINT_VALUES.PERFECT_ROUND_BONUS;
  } else if (accuracy >= 0.9) {
    return 100;
  } else if (accuracy >= 0.8) {
    return 50;
  }
  
  return 0;
}

/**
 * Format points for display
 * @param points - Points to format
 * @returns Formatted string
 */
export function formatPoints(points: number): string {
  if (points >= 1000000) {
    return `${(points / 1000000).toFixed(1)}M`;
  } else if (points >= 1000) {
    return `${(points / 1000).toFixed(1)}K`;
  }
  return points.toString();
}

/**
 * Calculate level based on total points
 * @param totalPoints - Total points earned
 * @returns Player level
 */
export function calculateLevel(totalPoints: number): number {
  // Simple level calculation - every 1000 points = 1 level
  return Math.floor(totalPoints / 1000) + 1;
}

/**
 * Get points needed for next level
 * @param totalPoints - Current total points
 * @returns Points needed for next level
 */
export function getPointsToNextLevel(totalPoints: number): number {
  const currentLevel = calculateLevel(totalPoints);
  const pointsForNextLevel = currentLevel * 1000;
  return pointsForNextLevel - totalPoints;
}

/**
 * Calculate bonus for participation in special events
 * @param eventType - Type of special event
 * @returns Bonus points
 */
export function calculateEventBonus(eventType: string): number {
  const eventBonuses: { [key: string]: number } = {
    'double_points': 2,
    'triple_points': 3,
    'speed_round': 1.5,
    'bonus_round': 1.25
  };
  
  return eventBonuses[eventType] || 1;
}

/**
 * Calculate total score with all bonuses
 * @param basePoints - Base points earned
 * @param responseTimeMs - Response time in milliseconds
 * @param streakCount - Current streak count
 * @param eventType - Optional event type for bonus
 * @returns Total points with all bonuses
 */
export function calculateTotalScore(
  basePoints: number,
  responseTimeMs: number,
  streakCount: number = 0,
  eventType?: string
): number {
  // Calculate time bonus
  const timeBonusMultiplier = getTimeBonus(responseTimeMs);
  let totalPoints = calculatePoints(basePoints, timeBonusMultiplier);
  
  // Add streak bonus
  totalPoints += calculateStreakBonus(streakCount);
  
  // Apply event multiplier if applicable
  if (eventType) {
    const eventMultiplier = calculateEventBonus(eventType);
    totalPoints = Math.round(totalPoints * eventMultiplier);
  }
  
  return totalPoints;
}