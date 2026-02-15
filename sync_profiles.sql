-- DATA SYNC: Manually sync users from auth.users to public.profiles
-- Run this if your Member List is empty but you have registered users in Supabase Auth.

-- 1. Insert missing users from auth.users into profiles
INSERT INTO public.profiles (id, email, role)
SELECT 
    id, 
    email, 
    CASE 
        WHEN email = 'nbamoment@gmail.com' THEN 'admin'
        ELSE 'standard'
    END
FROM auth.users
ON CONFLICT (id) DO UPDATE 
SET email = EXCLUDED.email; -- Optional: Sync latest email if changed only

-- 2. Verify the count
SELECT count(*) as "Total Profiles" FROM public.profiles;
SELECT count(*) as "Total Auth Users" FROM auth.users;
