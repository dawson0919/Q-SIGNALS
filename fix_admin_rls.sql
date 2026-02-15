-- Fix Admin Access via RLS (Row Level Security)
-- This allows specific admin emails to bypass standard role checks based on their login token (JWT).

-- 1. Profiles Table: Allow View/Edit for Super Admin
CREATE POLICY "Super Admin Manage Profiles" ON public.profiles
FOR ALL
USING (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com'
)
WITH CHECK (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com'
);

-- 2. Premium Applications: Allow View/Edit for Super Admin
CREATE POLICY "Super Admin Manage Applications" ON public.premium_applications
FOR ALL
USING (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com'
)
WITH CHECK (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com'
);

-- 3. Subscriptions: Allow View/Edit for Super Admin
CREATE POLICY "Super Admin Manage Subscriptions" ON public.subscriptions
FOR ALL
USING (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com'
)
WITH CHECK (
  (auth.jwt() ->> 'email') = 'nbamoment@gmail.com'
);
