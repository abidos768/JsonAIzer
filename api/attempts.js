import { createClient } from "@supabase/supabase-js";

function setCorsHeaders(res) {
  const allowedOrigins = process.env.ALLOWED_ORIGIN || "";
  if (allowedOrigins) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigins);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function getAuthUser(req, supabase) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const supabase = createClient(url, key);

    const user = await getAuthUser(req, supabase);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sessionId = user.id;

    const { data, error } = await supabase
      .from("sessions")
      .select("attempts_used")
      .eq("session_id", sessionId)
      .single();

    if (error && error.code === "PGRST116") {
      return res.status(200).json({ attemptsUsed: 0 });
    }

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to retrieve session data" });
    }

    return res.status(200).json({ attemptsUsed: data.attempts_used });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
