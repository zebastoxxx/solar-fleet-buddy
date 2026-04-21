-- Remove legacy permissive policies on storage.objects for the 'documents' bucket.
-- The role-restricted policies (documents_*_managers, documents_select_authenticated) already exist
-- and supersede these laxer ones, but having both means anyone authenticated could still upload/delete.
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read documents" ON storage.objects;