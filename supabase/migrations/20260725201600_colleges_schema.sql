-- Create colleges table
CREATE TABLE IF NOT EXISTS public.colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;

-- Allow public read access to colleges
CREATE POLICY "Public can view colleges" ON public.colleges
    FOR SELECT USING (true);

-- Allow authenticated users (or admin) to insert (basic community creation)
CREATE POLICY "Auth users can insert colleges" ON public.colleges
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Link community_groups to colleges
ALTER TABLE public.community_groups 
ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL;

-- Insert seed data for common colleges
INSERT INTO public.colleges (name, domain) VALUES
('Indian Institute of Technology (IIT) Delhi', 'iitd.ac.in'),
('Delhi University (DU)', 'du.ac.in'),
('BITS Pilani', 'bits-pilani.ac.in'),
('Indian Institute of Technology (IIT) Bombay', 'iitb.ac.in'),
('Vellore Institute of Technology (VIT)', 'vit.ac.in'),
('National Institute of Technology (NIT) Trichy', 'nitt.edu'),
('SRM Institute of Science and Technology', 'srmist.edu.in'),
('Manipal Academy of Higher Education', 'manipal.edu')
ON CONFLICT DO NOTHING;
