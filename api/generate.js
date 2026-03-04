import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 3;
const MAX_PROMPT_LENGTH = 4000;

const DEFAULT_SYSTEM_MESSAGE =
  "You are a JSON generator. You MUST respond with ONLY raw valid JSON. " +
  "No markdown, no code fences, no explanation, no extra text. " +
  "Your entire response must be a single JSON object that starts with { and ends with }.";

function sanitizePrompt(raw) {
  if (typeof raw !== "string") return null;

  let cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  cleaned = cleaned.trim().slice(0, MAX_PROMPT_LENGTH);

  if (cleaned.length === 0) return null;
  return cleaned;
}

function validateAgainstSchema(data, schema) {
  if (!schema || typeof schema !== "object") return true;

  if (schema.type === "object" && typeof data !== "object") return false;
  if (schema.type === "array" && !Array.isArray(data)) return false;

  if (schema.required && Array.isArray(schema.required)) {
    for (const key of schema.required) {
      if (!(key in data)) return false;
    }
  }

  if (schema.additionalProperties === false && schema.properties) {
    const allowed = Object.keys(schema.properties);
    for (const key of Object.keys(data)) {
      if (!allowed.includes(key)) return false;
    }
  }

  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const supabase = createClient(url, key);

  const { prompt: rawPrompt, sessionId, mode, schema } = req.body || {};

  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Missing or invalid sessionId" });
  }

  const prompt = sanitizePrompt(rawPrompt);
  if (!prompt) {
    return res.status(400).json({ error: "Invalid prompt." });
  }

  try {
    // Look up or create session
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

    // Enforce attempt limit
    if (session.attempts_used >= MAX_ATTEMPTS) {
      return res.status(429).json({
        error: "Max attempts reached.",
        attemptsUsed: session.attempts_used,
      });
    }

    let parsedJson;

    if (mode === "verbatim") {
      // Verbatim mode: return the prompt exactly as-is, no AI call
      parsedJson = { input: prompt };
    } else {
      // AI mode: call GLM
      if (!process.env.GLM_API_KEY) {
        return res.status(500).json({ error: "Server configuration error" });
      }

      const systemMessage =
        typeof req.body.systemInstruction === "string" && req.body.systemInstruction.trim()
          ? req.body.systemInstruction.trim()
          : DEFAULT_SYSTEM_MESSAGE;

      const client = new OpenAI({
        apiKey: process.env.GLM_API_KEY,
        baseURL: "https://api.z.ai/api/paas/v4",
      });

      const completion = await client.chat.completions.create({
        model: "glm-4.5-air",
        messages: [
          { role: "system", content: systemMessage },
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

      // Extract JSON — GLM may wrap it in ```json ... ```
      let jsonString = rawOutput.trim();

      const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonString = fenceMatch[1].trim();
      }

      if (!jsonString.startsWith("{") && !jsonString.startsWith("[")) {
        const objectMatch = jsonString.match(/(\{[\s\S]*\})/);
        const arrayMatch = jsonString.match(/(\[[\s\S]*\])/);
        jsonString = objectMatch?.[1] || arrayMatch?.[1] || jsonString;
      }

      try {
        parsedJson = JSON.parse(jsonString);
      } catch {
        return res.status(502).json({
          error: "AI returned invalid JSON. Please try a different prompt.",
        });
      }
    }

    // Validate against schema if provided
    if (schema && !validateAgainstSchema(parsedJson, schema)) {
      return res.status(502).json({
        error: "Output does not match the expected schema.",
      });
    }

    // Increment attempts_used
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
      .json({ error: "An unexpected error occurred. Please try again." });
  }
}
