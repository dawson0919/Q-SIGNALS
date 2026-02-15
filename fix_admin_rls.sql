-- Fix Admin Access via RLS (Row Level Security)
-- This allows specific admin emails OR user IDs to bypass standard role checks.

-- 1. Profiles Table: Allow View/Edit for Super Admin
CREATE POLICY "Super Admin Manage Profiles" ON public.profiles
FOR ALL
USING (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com' OR
  auth.uid() = 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd'
)
WITH CHECK (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com' OR
  auth.uid() = 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd'
);

-- 2. Premium Applications: Allow View/Edit for Super Admin
CREATE POLICY "Super Admin Manage Applications" ON public.premium_applications
FOR ALL
USING (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com' OR
  auth.uid() = 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd'
)
WITH CHECK (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com' OR
  auth.uid() = 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd'
);

-- 3. Subscriptions: Allow View/Edit for Super Admin
CREATE POLICY "Super Admin Manage Subscriptions" ON public.subscriptions
FOR ALL
USING (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com' OR
  auth.uid() = 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd'
)
WITH CHECK (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com' OR
  auth.uid() = 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd'
);
