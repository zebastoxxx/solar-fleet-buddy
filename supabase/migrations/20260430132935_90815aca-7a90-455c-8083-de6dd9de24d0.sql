REVOKE ALL ON FUNCTION public.is_admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_role() TO authenticated;