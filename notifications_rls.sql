-- Enable Row Level Security (RLS) on public.notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

-- 1. Allow users to read notifications where they are the recipient or the sender
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = (SELECT id FROM public.company_users WHERE user_id = auth.uid())
    OR 
    sender_id = (SELECT id FROM public.company_users WHERE user_id = auth.uid())
  );

-- 2. Allow users to create notifications where they are the sender
CREATE POLICY "Users can create notifications" ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (SELECT id FROM public.company_users WHERE user_id = auth.uid())
  );

-- 3. Allow users to update notifications where they are the recipient (e.g. marking as read)
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_id = (SELECT id FROM public.company_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    recipient_id = (SELECT id FROM public.company_users WHERE user_id = auth.uid())
  );

-- 4. Allow users to delete notifications where they are the recipient
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    recipient_id = (SELECT id FROM public.company_users WHERE user_id = auth.uid())
  );
