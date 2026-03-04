const { supabase } = require("./_lib/supabase.js");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Missing sessionId query parameter" });
  }

  try {
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
};
