-- Update the constraint for poll display types to include 'vertical'
ALTER TABLE activations
DROP CONSTRAINT IF EXISTS valid_poll_display_type;

ALTER TABLE activations
ADD CONSTRAINT valid_poll_display_type
CHECK (poll_display_type IS NULL OR poll_display_type IN ('bar', 'pie', 'horizontal', 'vertical'));

-- Also update the valid poll display types for question_templates
ALTER TABLE question_templates
DROP CONSTRAINT IF EXISTS question_templates_poll_display_type_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'question_templates' AND column_name = 'poll_display_type'
  ) THEN
    ALTER TABLE question_templates
    ADD CONSTRAINT question_templates_poll_display_type_check
    CHECK (poll_display_type IS NULL OR poll_display_type IN ('bar', 'pie', 'horizontal', 'vertical'));
  END IF;
END $$;