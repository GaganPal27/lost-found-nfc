-- Supabase Migration: 006_admin_dashboard.sql
-- Description: Adds is_admin function and policies to allow admins to manage all users and items.

-- 1. Create a secure function to check if the current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add bypass policies for users table
-- Allow admins to read all users
CREATE POLICY "admin_select_users" ON public.users FOR SELECT USING (is_admin());
-- Allow admins to update all users (e.g. changing roles or tiers)
CREATE POLICY "admin_update_users" ON public.users FOR UPDATE USING (is_admin());
-- Allow admins to delete users (optional, but good for moderation)
CREATE POLICY "admin_delete_users" ON public.users FOR DELETE USING (is_admin());

-- 3. Add bypass policies for items table
-- Allow admins to read all items
CREATE POLICY "admin_select_items" ON public.items FOR SELECT USING (is_admin());
-- Allow admins to update all items
CREATE POLICY "admin_update_items" ON public.items FOR UPDATE USING (is_admin());
-- Allow admins to delete items
CREATE POLICY "admin_delete_items" ON public.items FOR DELETE USING (is_admin());

-- 4. Make sure user can view their own profile so they know they are an admin
-- The 'own_user' policy already exists, but ensure it allows SELECT and UPDATE for themselves
-- (Assuming 'own_user' handles this in 001_schema.sql)
