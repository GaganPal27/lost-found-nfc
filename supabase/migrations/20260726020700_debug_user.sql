CREATE OR REPLACE FUNCTION public.debug_get_all_users()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT json_agg(row_to_json(u)) FROM (SELECT id, auth_id, email, full_name FROM public.users) u;
$$;

GRANT EXECUTE ON FUNCTION public.debug_get_all_users() TO anon, authenticated;
