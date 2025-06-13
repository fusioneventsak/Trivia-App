// Constants for point calculation
const POINT_CONFIG = {
  MAX_POINTS: 100.0,
  TIME_DEDUCTION_PER_SECOND: 2.0,
  MIN_POINTS: 10.0,
  INCORRECT_POINTS: 0.0
};

/**
 * Calculate points for a correct answer based on time taken
 * @param timeTakenSeconds Time taken to answer in seconds
 * @returns Points earned (between MIN_POINTS and MAX_POINTS)
 */
export function calculatePoints(timeTakenSeconds: number): number {
  if (timeTakenSeconds < 0) {
    timeTakenSeconds = 0;
  }
  
  // Calculate points with time deduction
  let points = POINT_CONFIG.MAX_POINTS - (timeTakenSeconds * POINT_CONFIG.TIME_DEDUCTION_PER_SECOND);
  
  // Ensure points don't go below minimum
  points = Math.max(POINT_CONFIG.MIN_POINTS, points);
  
  // Round to nearest integer for cleaner display
  return Math.round(points);
}

/**
 * Format points to 1 decimal place
 * @param points Points to format
 * @returns Formatted points string
 */
export function formatPoints(points: number): string {
  if (points === undefined || points === null) {
    return "0.0";
  }
  return Number(points).toFixed(1);
}

/**
 * Checks if a string is a valid UUID
 * @param str String to check
 * @returns True if string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Safely parse JSON with error handling
 * @param jsonString JSON string to parse
 * @param fallback Fallback value if parsing fails
 * @returns Parsed JSON or fallback value
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return fallback;
  }
}

/**
 * Generate a random room code (4 uppercase letters/numbers)
 * @returns Random room code
 */
export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}