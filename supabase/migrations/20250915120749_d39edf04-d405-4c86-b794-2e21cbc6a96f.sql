-- Update RLS policies to include superadmin access

-- Drop and recreate inventory management policy
DROP POLICY IF EXISTS "Admins and staff can manage inventory" ON inventory_items;
CREATE POLICY "Admins, staff and superadmins can manage inventory" 
ON inventory_items 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'staff'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role));

-- Drop and recreate payments management policy  
DROP POLICY IF EXISTS "Staff and admins can manage payments" ON payments;
CREATE POLICY "Staff, admins and superadmins can manage payments" 
ON payments 
FOR ALL 
TO authenticated 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'staff'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role));

-- Update the payments view policy to include superadmin
DROP POLICY IF EXISTS "Users can view payments for their bookings" ON payments;
CREATE POLICY "Users can view payments for their bookings" 
ON payments 
FOR SELECT 
TO authenticated 
USING (
  (EXISTS (
    SELECT 1
    FROM bookings
    WHERE (bookings.id = payments.booking_id) AND (bookings.customer_id = auth.uid())
  )) 
  OR has_role(auth.uid(), 'admin'::user_role) 
  OR has_role(auth.uid(), 'staff'::user_role) 
  OR has_role(auth.uid(), 'superadmin'::user_role)
);