import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 3;
const MAX_PROMPT_LENGTH = 4000;

const SYSTEM_MESSAGE =
  "Output MUST be valid JSON with predefined schema only. " +
  "Respond with a single JSON object. Do not include any text outside the JSON.";

function sanitizePrompt(raw) {
  if (typeof raw !== "string") return null;

  let cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  cleaned = cleaned.trim().slice(0, MAX_PROMPT_LENGTH);

  if (cleaned.length === 0) return null;
  return cleaned;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: "Missing Supabase env vars" });
  }

  if (!process.env.GLM_API_KEY) {
    return res.status(500).json({ error: "Missing GLM_API_KEY env var" });
  }

  const supabase = createClient(url, key);

  const { prompt: rawPrompt, sessionId } = req.body || {};

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Missing or invalid sessionId" });
  }

  const prompt = sanitizePrompt(rawPrompt);
  if (!prompt) {
    return res
      .status(400)
      .json({ error: "Prompt is required (max 4000 characters)" });
  }

  try {
    let { data: session, error: selectError } = await supabase
      .from("sessions")
      .select("attempts_used")
      .eq("session_id", sessionId)
      .single();

    if (selectError && selectError.code === "PGRST116") {
      const { data: newSession, error: insertError } = await supabase
        .from("sessions")
        .insert({ session_id: sessionId, attempts_used: 0 })
        .select("attempts_used")
        .single();

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        return res.status(500).json({ error: "Failed to create session" });
      }

      session = newSession;
    } else if (selectError) {
      console.error("Supabase select error:", selectError);
      return res.status(500).json({ error: "Failed to retrieve session data" });
    }

    if (session.attempts_used >= MAX_ATTEMPTS) {
      return res.status(429).json({
        error: "You have reached the 3-attempt limit for this session.",
        attemptsUsed: session.attempts_used,
      });
    }

    const client = new OpenAI({
      apiKey: process.env.GLM_API_KEY,
      baseURL: "https://api.z.ai/api/paas/v4",
    });

    const completion = await client.chat.completions.create({
      model: "glm-4-flash",
      messages: [
        { role: "system", content: SYSTEM_MESSAGE },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    const rawOutput = completion.choices?.[0]?.message?.content;

    if (!rawOutput) {
      return res
        .status(502)
        .json({ error: "AI did not return a response. Please try again." });
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(rawOutput);
    } catch {
      return res.status(502).json({
        error: "AI returned invalid JSON. Please try a different prompt.",
      });
    }

    const newAttemptsUsed = session.attempts_used + 1;

    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        attempts_used: newAttemptsUsed,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    if (updateError) {
      console.error("Supabase update error:", updateError);
    }

    return res.status(200).json({
      json: JSON.stringify(parsedJson, null, 2),
      attemptsUsed: newAttemptsUsed,
    });
  } catch (err) {
    console.error("Unexpected error:", err);

    if (err?.status === 401 || err?.code === "invalid_api_key") {
      return res
        .status(500)
        .json({ error: "Server configuration error. Please contact support." });
    }

    if (err?.status === 429) {
      return res
        .status(502)
        .json({ error: "AI service is busy. Please try again shortly." });
    }

    return res
      .status(500)
      .json({ error: "An unexpected error occurred. Please try again.", details: err.message });
  }
}
