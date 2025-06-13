/*
  # Add Activation Status and History Fields
  
  1. New Fields
    - Add 'active' boolean field to track activation status
    - Add 'last_activated' and 'last_deactivated' timestamp fields
    - Add 'activation_history' JSONB array to store activation events
*/

-- Add new fields to the activations table for tracking status and history
ALTER TABLE activations
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_activated TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_deactivated TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS activation_history JSONB DEFAULT '[]'::jsonb;

-- Create an index on the active column for faster lookups
CREATE INDEX IF NOT EXISTS idx_activations_active
ON activations(active);

-- Create an index on last_activated for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_activations_last_activated
ON activations(last_activated);

-- Function to create activation audit log entry
CREATE OR REPLACE FUNCTION log_activation_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.active != NEW.active THEN
    -- If the active state has changed, log this change in activation_history
    IF NEW.activation_history IS NULL THEN
      NEW.activation_history := '[]'::jsonb;
    END IF;
    
    NEW.activation_history := NEW.activation_history || jsonb_build_object(
      'timestamp', CURRENT_TIMESTAMP,
      'action', CASE WHEN NEW.active THEN 'activated' ELSE 'deactivated' END,
      'user_id', auth.uid()
    );
    
    -- Update the appropriate timestamp
    IF NEW.active THEN
      NEW.last_activated := CURRENT_TIMESTAMP;
    ELSE
      NEW.last_deactivated := CURRENT_TIMESTAMP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically track activation state changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'track_activation_changes'
  ) THEN
    CREATE TRIGGER track_activation_changes
    BEFORE UPDATE ON activations
    FOR EACH ROW
    WHEN (OLD.active IS DISTINCT FROM NEW.active)
    EXECUTE FUNCTION log_activation_change();
  END IF;
END $$;