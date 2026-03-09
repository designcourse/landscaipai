-- Migration: Row Level Security policies
-- Uses (SELECT auth.uid()) pattern per Supabase best practices

-- Profiles: users can read/update their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);

-- Projects: users can CRUD their own projects; shared projects are publicly readable
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own projects" ON public.projects
  FOR ALL USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Shared projects are publicly readable" ON public.projects
  FOR SELECT USING (is_shared = true);

-- Images: users can CRUD their own images; images in shared projects are publicly readable
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own images" ON public.images
  FOR ALL USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Images in shared projects are readable" ON public.images
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND is_shared = true));

-- Generations: users can read their own; generations in shared projects are publicly readable
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own generations" ON public.generations
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Generations in shared projects are readable" ON public.generations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.images i
    JOIN public.projects p ON i.project_id = p.id
    WHERE i.id = image_id AND p.is_shared = true
  ));

-- Credit transactions: users can view their own
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Subscriptions: users can view their own
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Admin settings: readable by admins only (accessed via service role in API routes)
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Processed stripe events: service role only (no policies)
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- Gallery items: publicly readable when published
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gallery items are publicly readable" ON public.gallery_items
  FOR SELECT USING (is_published = true);
