-- Initial migration to create all tables, relationships, and RLS policies


-- Create profile table
CREATE TABLE public.profile (
    id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    handicap_index DECIMAL NOT NULL DEFAULT 0,
    verified BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (id)
);

-- Create course table
CREATE TABLE public.course (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'pending'
);

-- Create tee_info table
CREATE TABLE public.tee_info (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES public.course(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    course_rating_18 DECIMAL NOT NULL,
    course_rating_front_9 DECIMAL NOT NULL,
    course_rating_back_9 DECIMAL NOT NULL,
    slope_rating_18 INTEGER NOT NULL,
    slope_rating_front_9 INTEGER NOT NULL,
    slope_rating_back_9 INTEGER NOT NULL,
    total_distance INTEGER NOT NULL,
    out_distance INTEGER NOT NULL,
    in_distance INTEGER NOT NULL,
    total_par INTEGER NOT NULL,
    out_par INTEGER NOT NULL,
    in_par INTEGER NOT NULL,
    distance_measurement TEXT NOT NULL DEFAULT 'yards',
    approval_status TEXT NOT NULL DEFAULT 'pending',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1
);

-- Create hole table
CREATE TABLE public.hole (
    id SERIAL PRIMARY KEY,
    tee_id INTEGER NOT NULL REFERENCES public.tee_info(id) ON DELETE CASCADE,
    hole_number INTEGER NOT NULL,
    par INTEGER NOT NULL,
    distance INTEGER NOT NULL,
    hcp INTEGER NOT NULL
);

-- Create round table
CREATE TABLE public.round (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES public.course(id) ON DELETE RESTRICT,
    tee_id INTEGER NOT NULL REFERENCES public.tee_info(id) ON DELETE RESTRICT,
    tee_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_strokes INTEGER NOT NULL,
    par_played INTEGER NOT NULL,
    adjusted_gross_score INTEGER NOT NULL,
    adjusted_played_score INTEGER NOT NULL,
    course_handicap INTEGER NOT NULL,
    score_differential DECIMAL NOT NULL,
    existing_handicap_index DECIMAL NOT NULL,
    updated_handicap_index DECIMAL NOT NULL,
    exceptional_score_adjustment DECIMAL NOT NULL DEFAULT 0,
    notes TEXT,
    approval_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_tee_time UNIQUE (user_id, tee_time)
);

-- Create score table
CREATE TABLE public.score (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profile(id) ON DELETE CASCADE,
    round_id INTEGER NOT NULL REFERENCES public.round(id) ON DELETE CASCADE,
    hole_id INTEGER NOT NULL REFERENCES public.hole(id) ON DELETE RESTRICT,
    strokes INTEGER NOT NULL,
    hcp_strokes INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT unique_round_hole UNIQUE (round_id, hole_id)
);

-- Create indexes for performance
CREATE INDEX idx_profile_email ON public.profile(email);
CREATE INDEX idx_tee_info_course_id ON public.tee_info(course_id);
CREATE INDEX idx_hole_tee_id ON public.hole(tee_id);
CREATE INDEX idx_round_user_id ON public.round(user_id);
CREATE INDEX idx_round_course_id ON public.round(course_id);
CREATE INDEX idx_round_tee_id ON public.round(tee_id);
CREATE INDEX idx_round_tee_time ON public.round(tee_time);
CREATE INDEX idx_score_user_id ON public.score(user_id);
CREATE INDEX idx_score_round_id ON public.score(round_id);
CREATE INDEX idx_score_hole_id ON public.score(hole_id);

-- Enable Row Level Security on all tables
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tee_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hole ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profile table
CREATE POLICY "Users can view their own profile" ON public.profile
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert their own profile" ON public.profile
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update their own profile" ON public.profile
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can delete their own profile" ON public.profile
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = id);

-- RLS Policies for course table (read-only for authenticated users, admin can manage)
CREATE POLICY "Authenticated users can view courses" ON public.course
FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for tee_info table (read-only for authenticated users)
CREATE POLICY "Authenticated users can view tee info" ON public.tee_info
FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for hole table (read-only for authenticated users)
CREATE POLICY "Authenticated users can view holes" ON public.hole
FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for round table
CREATE POLICY "Users can view their own rounds" ON public.round
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own rounds" ON public.round
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own rounds" ON public.round
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own rounds" ON public.round
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- RLS Policies for score table
CREATE POLICY "Users can view their own scores" ON public.score
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own scores" ON public.score
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own scores" ON public.score
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own scores" ON public.score
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

create extension if not exists "pgjwt" with schema "extensions";
-- -- Enable extensions for HTTP requests
-- CREATE EXTENSION IF NOT EXISTS http;

-- -- Create function to call create-profile edge function
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS TRIGGER AS $$
-- DECLARE
--     response_status integer;
-- BEGIN
--     -- Call the create-profile edge function
--     SELECT status INTO response_status
--     FROM http((
--         'POST',
--         current_setting('app.supabase_url', true) || '/functions/v1/create-profile',
--         ARRAY[
--             http_header('Content-Type', 'application/json'),
--             http_header('Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true))
--         ],
--         'application/json',
--         json_build_object(
--             'userId', NEW.id,
--             'email', NEW.email,
--             'name', COALESCE(NEW.raw_user_meta_data->>'name', ''),
--             'handicapIndex', 54
--         )::text
--     ));
    
--     -- Log any non-200 responses (optional)
--     IF response_status != 200 THEN
--         RAISE WARNING 'create-profile edge function returned status: %', response_status;
--     END IF;
    
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- -- Create function to call send-verification-email edge function
-- CREATE OR REPLACE FUNCTION public.handle_email_verification()
-- RETURNS TRIGGER AS $$
-- DECLARE
--     response_status integer;
-- BEGIN
--     -- Only trigger on email confirmation changes
--     IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
--         -- Update profile verified status directly since we have the data
--         UPDATE public.profile 
--         SET verified = true 
--         WHERE id = NEW.id;
--     END IF;
    
--     -- Handle email changes
--     IF OLD.email != NEW.email THEN
--         UPDATE public.profile 
--         SET email = NEW.email 
--         WHERE id = NEW.id;
--     END IF;
    
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- -- Create function to call handicap-engine after round updates
-- CREATE OR REPLACE FUNCTION public.handle_round_calculation()
-- RETURNS TRIGGER AS $$
-- DECLARE
--     response_status integer;
-- BEGIN
--     -- Only trigger for approved rounds
--     IF (TG_OP = 'INSERT' AND NEW.approval_status = 'approved') OR 
--        (TG_OP = 'UPDATE' AND OLD.approval_status != 'approved' AND NEW.approval_status = 'approved') THEN
        
--         -- Call the handicap-engine edge function
--         SELECT status INTO response_status
--         FROM http((
--             'POST',
--             current_setting('app.supabase_url', true) || '/functions/v1/handicap-engine',
--             ARRAY[
--                 http_header('Content-Type', 'application/json'),
--                 http_header('Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true))
--             ],
--             'application/json',
--             json_build_object('userId', NEW.user_id)::text
--         ));
        
--         -- Log any non-200 responses (optional)
--         IF response_status != 200 THEN
--             RAISE WARNING 'handicap-engine edge function returned status: %', response_status;
--         END IF;
--     END IF;
    
--     RETURN COALESCE(NEW, OLD);
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- -- Create triggers
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CREATE TRIGGER on_auth_user_updated
--     AFTER UPDATE ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_email_verification();

-- CREATE TRIGGER on_round_approved
--     AFTER INSERT OR UPDATE ON public.round
--     FOR EACH ROW EXECUTE FUNCTION public.handle_round_calculation();

-- -- Note: Additional edge functions are available for manual calls:
-- -- - check-email: Validates email existence during registration
-- -- - reset-password: Handles password reset requests
-- -- - update-password: Updates user passwords
