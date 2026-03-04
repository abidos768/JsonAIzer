import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Missing sessionId query parameter" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const supabase = createClient(url, key);

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
