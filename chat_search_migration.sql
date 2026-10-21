-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 2. Create optimized GIN index for search within rooms
-- This allows incredibly fast filtering by room_id combined with full-text partial matching on message
CREATE INDEX IF NOT EXISTS idx_chat_messages_search 
ON public.chat_messages 
USING GIN (room_id, message gin_trgm_ops) 
WHERE type = 'text';

-- 3. Create Search RPC
-- We use SECURITY INVOKER to ensure the function executes with the permissions of the calling user, naturally respecting RLS
CREATE OR REPLACE FUNCTION search_messages(
  p_room_id uuid,
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
) 
RETURNS SETOF public.chat_messages
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.chat_messages
  WHERE room_id = p_room_id
    AND type = 'text'
    AND message ILIKE '%' || p_query || '%'
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
