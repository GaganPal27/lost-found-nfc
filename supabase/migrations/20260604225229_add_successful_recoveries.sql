ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS successful_recoveries INT DEFAULT 0;
