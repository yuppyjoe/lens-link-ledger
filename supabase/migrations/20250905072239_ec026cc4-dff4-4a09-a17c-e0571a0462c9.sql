-- Update RLS policies to include superadmin access

-- Update profiles table policies to include superadmin
DROP POLICY IF EXISTS "Admins and staff can view all profiles" ON public.profiles;
CREATE POLICY "Admins, staff and superadmins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'staff'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role));

-- Update app_user_roles table policies to include superadmin
DROP POLICY IF EXISTS "Admins can view all roles" ON public.app_user_roles;
CREATE POLICY "Admins and superadmins can view all roles" 
ON public.app_user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role));

-- Update the manage roles policy to include superadmin
DROP POLICY IF EXISTS "Admins can manage roles" ON public.app_user_roles;
CREATE POLICY "Admins and superadmins can manage roles" 
ON public.app_user_roles 
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'superadmin'::user_role));