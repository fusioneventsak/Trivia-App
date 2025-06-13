/*
  # Customer Multi-tenant Implementation

  1. New Tables
    - `customers` - Stores customer identification and settings
    - `customer_access` - Manages which users have access to which customers
    - `customer_rooms` - Maps rooms to customers

  2. Security
    - Enable RLS on all new tables
    - Add policies to restrict access to customer data
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL UNIQUE,
  name text NOT NULL,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customer access table
CREATE TABLE IF NOT EXISTS customer_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, user_id)
);

-- Create customer rooms mapping table
CREATE TABLE IF NOT EXISTS customer_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, room_id)
);

-- Add customer_id column to existing rooms table to maintain backward compatibility
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS customer_id text;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_id ON customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_rooms_customer ON customer_rooms(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_rooms_room ON customer_rooms(room_id);
CREATE INDEX IF NOT EXISTS idx_customer_access_customer ON customer_access(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_access_user ON customer_access(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_customer ON rooms(customer_id);

-- Enable Row Level Security
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_rooms ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customers table
CREATE POLICY "Admins can manage all customers"
  ON customers
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

CREATE POLICY "Users can view their assigned customers"
  ON customers
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customer_access 
    WHERE customer_access.customer_id = customers.customer_id 
    AND customer_access.user_id = auth.uid()
  ));

-- Create RLS policies for customer_access table
CREATE POLICY "Admins can manage customer access"
  ON customer_access
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

CREATE POLICY "Users can view their own access"
  ON customer_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create RLS policies for customer_rooms table
CREATE POLICY "Admins can manage customer rooms"
  ON customer_rooms
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'info@fusion-events.ca' OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

CREATE POLICY "Users can view rooms for their customers"
  ON customer_rooms
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM customer_access 
    WHERE customer_access.customer_id = customer_rooms.customer_id 
    AND customer_access.user_id = auth.uid()
  ));

-- Create master admin customer (ak)
INSERT INTO customers (customer_id, name, settings, is_active)
VALUES ('ak', 'Master Admin', '{"isAdmin": true}'::jsonb, true)
ON CONFLICT (customer_id) DO NOTHING;

-- Function to automatically assign rooms to customers
CREATE OR REPLACE FUNCTION assign_room_to_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- If customer_id is provided in the room, use it
  IF NEW.customer_id IS NOT NULL THEN
    -- Insert into customer_rooms mapping
    INSERT INTO customer_rooms (customer_id, room_id)
    VALUES (NEW.customer_id, NEW.id)
    ON CONFLICT (customer_id, room_id) DO NOTHING;
  ELSE
    -- Default to 'ak' customer for backward compatibility
    INSERT INTO customer_rooms (customer_id, room_id)
    VALUES ('ak', NEW.id)
    ON CONFLICT (customer_id, room_id) DO NOTHING;
    
    -- Update the room with the default customer_id
    UPDATE rooms SET customer_id = 'ak' WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to assign rooms to customers on creation
CREATE TRIGGER assign_room_to_customer_trigger
AFTER INSERT ON rooms
FOR EACH ROW
EXECUTE FUNCTION assign_room_to_customer();

-- Create function to check if user has access to a customer
CREATE OR REPLACE FUNCTION user_has_customer_access(p_customer_id text)
RETURNS boolean AS $$
BEGIN
  -- Admin users always have access
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR email = 'info@fusion-events.ca')
  ) THEN
    RETURN true;
  END IF;
  
  -- Check customer access table
  RETURN EXISTS (
    SELECT 1 FROM customer_access 
    WHERE customer_id = p_customer_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

-- Update the existing RLS policies on rooms to respect customer boundaries
DROP POLICY IF EXISTS "Room owners can manage their rooms" ON rooms;
CREATE POLICY "Room owners can manage their rooms"
  ON rooms
  FOR ALL
  TO authenticated
  USING (
    (auth.uid() = owner_id) OR 
    (rooms.customer_id IS NOT NULL AND user_has_customer_access(rooms.customer_id))
  )
  WITH CHECK (
    (auth.uid() = owner_id) OR 
    (rooms.customer_id IS NOT NULL AND user_has_customer_access(rooms.customer_id))
  );

-- Migrate existing rooms to 'ak' customer
UPDATE rooms SET customer_id = 'ak' WHERE customer_id IS NULL;
INSERT INTO customer_rooms (customer_id, room_id)
SELECT 'ak', id FROM rooms WHERE id NOT IN (
  SELECT room_id FROM customer_rooms WHERE customer_id = 'ak'
);

-- Create helper function for creating new customers
CREATE OR REPLACE FUNCTION create_customer(
  p_customer_id text,
  p_name text,
  p_owner_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Validate customer_id format
  IF NOT p_customer_id ~ '^[a-z0-9]{2,4}$' THEN
    RAISE EXCEPTION 'Invalid customer ID format. Must be 2-4 lowercase alphanumeric characters.';
  END IF;
  
  -- Insert new customer
  INSERT INTO customers (customer_id, name, owner_id)
  VALUES (p_customer_id, p_name, p_owner_id)
  RETURNING id INTO v_id;
  
  -- If owner is provided, grant them access
  IF p_owner_id IS NOT NULL THEN
    INSERT INTO customer_access (customer_id, user_id, access_level)
    VALUES (p_customer_id, p_owner_id, 'owner')
    ON CONFLICT (customer_id, user_id) DO UPDATE 
    SET access_level = 'owner';
  END IF;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;