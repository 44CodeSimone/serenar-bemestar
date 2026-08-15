-- Migration: Harden Storage RLS for client-documents private bucket
-- Ensures least-privilege access for administrative/staff users

-- 1. Drop existing policies on client-documents if any exist to ensure clean state
DROP POLICY IF EXISTS "Staff read client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload client-documents" ON storage.objects;

-- 2. SELECT policy: Authorized staff can read objects and generate signed URLs for client-documents bucket
CREATE POLICY "Staff read client-documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'client-documents'
    AND public.is_staff(auth.uid())
);

-- 3. INSERT policy: Authorized staff can upload objects to client-documents bucket
CREATE POLICY "Staff upload client-documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'client-documents'
    AND public.is_staff(auth.uid())
);

-- Note: UPDATE and DELETE policies are intentionally omitted per least-privilege principles.
-- Application does not perform physical updates or deletes on storage objects.
