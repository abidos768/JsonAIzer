import { useEffect, useMemo, useState } from "react";
import AttemptsCounter from "./components/AttemptsCounter";
import JSONOutput from "./components/JSONOutput";
import PromptInput from "./components/PromptInput";

const MAX_ATTEMPTS = 3;
const SESSION_STORAGE_KEY = "jsonfi_session_id";
const VERBATIM_SCHEMA = {
  type: "object",
  properties: {
    input: { type: "string" }
  },
  required: ["input"],
  additionalProperties: false
};

function getSessionId() {
  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const created = crypto.randomUUID();
  sessionStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}

function formatApiError(errorData, fallbackMessage) {
  if (!errorData || typeof errorData !== "object") return fallbackMessage;
  return errorData.error || fallbackMessage;
}

export default function App() {
  const [sessionId] = useState(() => getSessionId());
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const blocked = useMemo(() => attemptsUsed >= MAX_ATTEMPTS, [attemptsUsed]);

  useEffect(() => {
    async function loadAttempts() {
      try {
        const response = await fetch(
          `/api/attempts?sessionId=${encodeURIComponent(sessionId)}`
        );
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data.attemptsUsed === "number") {
          setAttemptsUsed(data.attemptsUsed);
        }
      } catch (_err) {
        // Frontend should remain usable if backend is not reachable.
      }
    }

    loadAttempts();
  }, [sessionId]);

  const handleSubmit = async () => {
    setError("");
    setOutput("");

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Please enter a prompt.");
      return;
    }

    if (blocked) {
      setError("You have reached the 3-attempt limit for this session.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          sessionId,
          mode: "verbatim",
          systemInstruction:
            'Return valid JSON only. Copy the user prompt exactly into key "input" with no paraphrasing.',
          schema: VERBATIM_SCHEMA
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (typeof data.attemptsUsed === "number") {
          setAttemptsUsed(data.attemptsUsed);
        } else if (response.status === 429) {
          setAttemptsUsed(MAX_ATTEMPTS);
        }
        setError(
          formatApiError(data, "Unable to generate JSON. Please try again.")
        );
        return;
      }

      if (typeof data.attemptsUsed === "number") {
        setAttemptsUsed(data.attemptsUsed);
      } else {
        setAttemptsUsed((prev) => Math.min(MAX_ATTEMPTS, prev + 1));
      }

      const jsonText =
        typeof data.json === "string"
          ? data.json
          : JSON.stringify(data.json ?? {}, null, 2);

      const normalized = JSON.stringify(JSON.parse(jsonText), null, 2);
      setOutput(normalized);
    } catch (_err) {
      setError("Network error. Please check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <div className="background-grid" />
      <div className="crt-noise" />
      <section className="app-content">
        <header className="hero">
          <p className="badge">TERMINAL CORE / JSONFI</p>
          <h1>One-Shot Prompt to JSON</h1>
        </header>

        <section className="terminal-frame">
          <div className="menu-bar">
            <span>File</span>
            <span>Edit</span>
            <span>Options</span>
            <span>Buffers</span>
            <span>Tools</span>
            <span>Help</span>
          </div>

          <p className="overlay-text">THIS IS HOW YOUR EMAIL WILL FIND ME</p>

          <div className="layout">
            <PromptInput
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={handleSubmit}
              disabled={blocked}
              loading={loading}
            />
            <JSONOutput output={output} />
          </div>

          <div className="status-bar">
            <span>-UUU:---</span>
            <span>F1</span>
            <span>email.txt</span>
            <span>All L1 (Text)</span>
          </div>
        </section>

        <div className="counter-wrap">
          <AttemptsCounter attemptsUsed={attemptsUsed} />
        </div>

        {loading ? <p className="status loading">Processing...</p> : null}
        {error ? <p className="status error">{error}</p> : null}
      </section>
    </main>
  );
}
