import { supabase } from './supabase';
import { AnswerRequest, AnswerResponse } from './types';

const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';

export class APIClient {
  private static async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  static async submitAnswer(request: AnswerRequest): Promise<AnswerResponse> {
    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}/calculate-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error submitting answer:', error);
      throw error;
    }
  }

  static async validateAnswer(
    activationId: string,
    answer: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}/validate-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ activationId, answer }),
      });

      return await response.json();
    } catch (error) {
      console.error('Error validating answer:', error);
      return { isValid: false, error: 'Validation failed' };
    }
  }
}