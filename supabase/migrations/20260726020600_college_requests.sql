CREATE TABLE public.college_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_name TEXT NOT NULL,
  email        TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  status       TEXT DEFAULT 'pending'
);

ALTER TABLE public.college_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit a request (even before login)
CREATE POLICY "Allow anonymous inserts on college_requests" 
ON public.college_requests 
FOR INSERT 
WITH CHECK (true);

-- Only admins can view and manage requests
CREATE POLICY "Admins can manage college_requests" 
ON public.college_requests 
FOR ALL 
USING (public.is_admin());
