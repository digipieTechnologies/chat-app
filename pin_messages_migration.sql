-- Migration to add pin message functionality

-- 1. Add is_pinned column to chat_messages table
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- 2. Create a partial unique index to enforce only one pinned message per room/conversation
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_one_pinned_per_room 
ON public.chat_messages (room_id) 
WHERE (is_pinned = true);

-- 3. Create atomic toggle function
CREATE OR REPLACE FUNCTION public.toggle_pinned_message(p_room_id uuid, p_message_id uuid)
RETURNS void AS $$
DECLARE
  v_current_pinned_id uuid;
BEGIN
  -- Find the currently pinned message in this room (if any)
  SELECT id INTO v_current_pinned_id 
  FROM public.chat_messages 
  WHERE room_id = p_room_id AND is_pinned = true;

  -- Unpin all messages in this room
  UPDATE public.chat_messages 
  SET is_pinned = false 
  WHERE room_id = p_room_id AND is_pinned = true;

  -- If the message we are toggling was NOT the one already pinned, pin it
  IF v_current_pinned_id IS NULL OR v_current_pinned_id <> p_message_id THEN
    UPDATE public.chat_messages 
    SET is_pinned = true 
    WHERE id = p_message_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
