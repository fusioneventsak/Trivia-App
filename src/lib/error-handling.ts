/**
 * Error handling utilities for the application
 */

import { supabase } from './supabase';

/**
 * Log an error to the console and optionally to a backend service
 * @param error The error object
 * @param context Additional context about where the error occurred
 * @param userId Optional user ID for tracking
 */
export async function logError(
  error: Error | unknown,
  context: string,
  userId?: string
): Promise<void> {
  // Always log to console
  console.error(`Error in ${context}:`, error);
  
  // Prepare error data
  const errorData = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    user_id: userId,
    browser: navigator.userAgent,
    timestamp: new Date().toISOString(),
    url: window.location.href
  };
  
  // Only try to log to analytics_events if we're online
  if (navigator.onLine) {
    try {
      const { error: dbError } = await supabase
        .from('analytics_events')
        .insert([{
          event_type: 'client_error',
          user_id: userId,
          event_data: errorData
        }]);
      
      if (dbError) {
        console.warn('Failed to log error to database:', dbError);
      }
    } catch (logError) {
      console.warn('Error logging to database:', logError);
    }
  } else {
    console.warn('Offline - error not logged to database');
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn The function to retry
 * @param retries Maximum number of retries
 * @param delay Initial delay in ms
 * @param backoff Backoff factor
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 300,
  backoff = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // If we're offline, don't retry - just fail fast
    if (!navigator.onLine || isNetworkError(error)) {
      throw new Error('Network error: You appear to be offline');
    }
    
    if (retries <= 0) {
      throw error;
    }
    
    console.log(`Retrying after ${delay}ms, ${retries} retries left`);
    
    // Wait for the specified delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Retry with exponential backoff
    return retry(fn, retries - 1, delay * backoff, backoff);
  }
}

/**
 * Check if an error is a network error
 * @param error The error to check
 */
export function isNetworkError(error: any): boolean {
  // Check for common network error patterns
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true;
  }
  
  if (error.name === 'AbortError') {
    return true;
  }
  
  if (error.message && (
    error.message.includes('network') ||
    error.message.includes('connection') ||
    error.message.includes('offline')
  )) {
    return true;
  }
  
  return false;
}

/**
 * Get a user-friendly error message
 * @param error The error object
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!navigator.onLine) {
    return 'You are currently offline. Please check your internet connection and try again.';
  }
  
  if (isNetworkError(error)) {
    return 'Network error. Please check your internet connection and try again.';
  }
  
  if (error.code === 'PGRST301') {
    return 'Resource not found. The item you\'re looking for may have been deleted.';
  }
  
  if (error.code === '23505') {
    return 'This item already exists. Please try with different information.';
  }
  
  if (error.code === '42P01') {
    return 'Database configuration error. Please contact support.';
  }
  
  if (error.code === '42501') {
    return 'You don\'t have permission to perform this action.';
  }
  
  if (error.code === 'P0001') {
    // Extract the message from the database error
    const match = error.message.match(/ERROR:\s*(.*)/i);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Default message
  return error.message || 'An unexpected error occurred. Please try again.';
}