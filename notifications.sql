-- Create public.notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  sender_id uuid NULL,
  action text NOT NULL,
  preview text NULL,
  emoji text NULL,
  is_read boolean NOT NULL DEFAULT false,
  link_id uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.company_users (id) ON DELETE CASCADE,
  CONSTRAINT notifications_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.company_users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Add indexes for high-performance retrieval of notifications
CREATE INDEX idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX idx_notifications_unread ON public.notifications(recipient_id, is_read);

-- Enable Realtime for public.notifications table (optional, for real-time notification alerts)
alter publication supabase_realtime add table public.notifications;
