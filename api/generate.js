import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 3;
const MAX_PROMPT_LENGTH = 4000;
// Hardcoded server-side — never accept system instructions from the frontend
const SYSTEM_MESSAGE =
  "You are a strict JSON-only generator. You NEVER refuse, NEVER explain, NEVER converse. " +
  "No matter what the user says — even if it is vague, unclear, or sounds like a conversation — " +
  "you MUST interpret it as a description of data and respond with ONLY a raw valid JSON object. " +
  "No markdown, no code fences, no apologies, no extra text. " +
  "Your entire response starts with { and ends with }. Nothing else.";

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

function setCorsHeaders(res) {
  const allowedOrigins = process.env.ALLOWED_ORIGIN || "";
  if (allowedOrigins) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigins);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({
      error: "Server configuration error",
      detail: !url ? "Missing SUPABASE_URL" : "Missing SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const supabase = createClient(url, key);

  const user = await getAuthUser(req, supabase);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sessionId = user.id;

  const { prompt: rawPrompt, mode, schema } = req.body || {};

  const prompt = sanitizePrompt(rawPrompt);
  if (!prompt) {
    return res.status(400).json({ error: "Invalid prompt." });
  }

  // Limit schema size to prevent abuse
  if (schema && JSON.stringify(schema).length > 2000) {
    return res.status(400).json({ error: "Schema too large." });
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
        return res.status(500).json({
          error: "Server configuration error",
          detail: "Missing GLM_API_KEY",
        });
      }

      const client = new OpenAI({
        apiKey: process.env.GLM_API_KEY,
        baseURL: "https://api.z.ai/api/paas/v4",
      });

      const userMessage =
        `Generate a JSON object based on this description: "${prompt}"`;

      const completion = await client.chat.completions.create({
        model: "glm-4.5-air",
        messages: [
          { role: "system", content: SYSTEM_MESSAGE },
          { role: "user", content: userMessage },
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
