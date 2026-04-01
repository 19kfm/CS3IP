import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing. Check .env.local and restart dev server.");
if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Check .env.local and restart dev server.");

export const supabase = createClient(url, anon);