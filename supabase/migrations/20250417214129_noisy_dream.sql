/*
  # Add Vertical Poll Display Type
  
  1. Changes
    - Add 'vertical' as a valid poll_display_type value
    - Update the valid_poll_display_type constraint
    
  2. Description
    This migration extends poll display options to include a vertical layout
    which stacks poll results vertically instead of horizontally or in a pie chart.
*/

-- Update the constraint for poll display types to include 'vertical'
ALTER TABLE activations
DROP CONSTRAINT IF EXISTS valid_poll_display_type;

ALTER TABLE activations
ADD CONSTRAINT valid_poll_display_type
CHECK (poll_display_type IS NULL OR poll_display_type IN ('bar', 'pie', 'horizontal', 'vertical'));