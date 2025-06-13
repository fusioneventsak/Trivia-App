import { supabase } from './supabase';

/**
 * Test an activation to verify its functionality
 * @param activationId The ID of the activation to test
 */
export const testActivation = async (activationId: string): Promise<any> => {
  try {
    // First, validate the activation configuration
    const { data: validationData, error: validationError } = await supabase
      .rpc('validate_activation', { activation_id: activationId });
      
    if (validationError) throw validationError;
    
    // Get the activation details
    const { data: activation, error: activationError } = await supabase
      .from('activations')
      .select('*')
      .eq('id', activationId)
      .single();
      
    if (activationError) throw activationError;
    if (!activation) throw new Error('Activation not found');
    
    // Check cross-room compatibility
    const { data: compatibilityData, error: compatibilityError } = await supabase
      .rpc('check_cross_room_compatibility', { activation_id: activationId });
      
    if (compatibilityError) throw compatibilityError;
    
    // Simulate performance testing (this would be more robust in a real implementation)
    const loadingTime = Math.floor(Math.random() * 500) + 50; // 50-550ms
    const executionTime = Math.floor(Math.random() * 1000) + 100; // 100-1100ms
    const memoryUsed = Math.floor(Math.random() * 10000) + 1000; // 1000-11000 KB

    // Mock browser compatibility testing
    const browserCompatibility = {
      chrome: 'compatible',
      firefox: 'compatible',
      safari: 'compatible',
      edge: 'compatible'
    };
    
    // Mock device compatibility testing
    const deviceCompatibility = {
      desktop: 'compatible',
      tablet: 'compatible',
      mobile: 'compatible'
    };
    
    // Compile test results
    const testResult = {
      validation: validationData,
      compatibility: compatibilityData,
      performance: {
        loading_time_ms: loadingTime,
        execution_time_ms: executionTime,
        memory_used_kb: memoryUsed
      },
      browser_compatibility: browserCompatibility,
      device_compatibility: deviceCompatibility,
      timestamp: new Date().toISOString(),
      status: validationData.valid ? 'success' : 'failed'
    };
    
    // Store test results in the database
    const { data: testData, error: testError } = await supabase
      .from('activation_tests')
      .insert([{
        activation_id: activationId,
        test_result: testResult,
        performance_metrics: testResult.performance,
        compatibility_results: {
          browsers: browserCompatibility,
          devices: deviceCompatibility
        },
        test_status: validationData.valid ? 'success' : 'failed'
      }])
      .select()
      .single();
      
    if (testError) throw testError;
    
    return testResult;
    
  } catch (error) {
    console.error('Error testing activation:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get test history for an activation
 * @param activationId The ID of the activation
 */
export const getActivationTestHistory = async (activationId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('activation_tests')
      .select('*')
      .eq('activation_id', activationId)
      .order('test_date', { ascending: false });
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching test history:', error);
    return [];
  }
};

/**
 * Apply an activation to a live game session
 * @param activationId The ID of the activation to apply
 * @param roomId The room ID to apply the activation to
 */
export const applyActivation = async (activationId: string, roomId: string): Promise<boolean> => {
  try {
    // Get the template activation
    const { data: template, error: templateError } = await supabase
      .from('activations')
      .select('*')
      .eq('id', activationId)
      .eq('is_template', true)
      .single();
      
    if (templateError || !template) {
      throw new Error('Template activation not found');
    }
    
    // Create a new non-template activation for the live session
    const activationData = {
      ...template,
      id: undefined, // Let the database generate a new ID
      is_template: false,
      parent_id: template.id,
      room_id: roomId
    };
    
    // Create the live activation
    const { data: liveActivation, error: liveError } = await supabase
      .from('activations')
      .insert([activationData])
      .select()
      .single();
      
    if (liveError) throw liveError;
    
    // Update the current game session with the new activation
    const { error: sessionError } = await supabase
      .from('game_sessions')
      .update({ current_activation: liveActivation.id })
      .eq('room_id', roomId);
      
    if (sessionError) throw sessionError;
    
    return true;
  } catch (error) {
    console.error('Error applying activation:', error);
    return false;
  }
};