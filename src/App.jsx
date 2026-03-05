import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";
import AttemptsCounter from "./components/AttemptsCounter";
import JSONOutput from "./components/JSONOutput";
import PromptInput from "./components/PromptInput";

const MAX_ATTEMPTS = 3;

function formatApiError(errorData, fallbackMessage) {
  if (!errorData || typeof errorData !== "object") return fallbackMessage;
  return errorData.error || fallbackMessage;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const blocked = useMemo(() => attemptsUsed >= MAX_ATTEMPTS, [attemptsUsed]);
  const user = session?.user;
  const accessToken = session?.access_token;

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    async function loadAttempts() {
      try {
        const response = await fetch("/api/attempts", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
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
  }, [accessToken]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAttemptsUsed(0);
    setOutput("");
    setPrompt("");
    setError("");
    setSuccess("");
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

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
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
        }),
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
      setSuccess("JSON generated. You can copy or edit it.");
    } catch (_err) {
      setError("Network error. Please check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  if (!supabase) {
    return (
      <main className="app-shell">
        <div className="background-grid" />
        <section className="app-content">
          <header className="hero">
            <p className="badge">AI JSON Generator</p>
            <h1>Configuration Error</h1>
            <p className="status error">
              Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.
              Check your .env file.
            </p>
          </header>
        </section>
      </main>
    );
  }

  if (authLoading) {
    return (
      <main className="app-shell">
        <div className="background-grid" />
        <section className="app-content">
          <p className="status loading" role="status">Loading...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <main className="app-shell">
      <div className="background-grid" />
      <section className="app-content">
        <header className="hero">
          <div className="hero-top-row">
            <p className="badge">AI JSON Generator</p>
            <button className="ghost-btn logout-btn" onClick={handleLogout}>
              Log out
            </button>
          </div>
          <h1>One-Shot Prompt to JSON</h1>
          <p>
            Submit one prompt and get schema-safe JSON back from the backend.
          </p>
          <AttemptsCounter attemptsUsed={attemptsUsed} />
        </header>

        <div className="layout">
          <PromptInput
            prompt={prompt}
            onPromptChange={setPrompt}
            onSubmit={handleSubmit}
            disabled={blocked}
            loading={loading}
          />
          <JSONOutput
            output={output}
            loading={loading}
            onOutputChange={(nextOutput) => {
              setOutput(nextOutput);
              setSuccess("JSON updated.");
              setError("");
            }}
          />
        </div>

        {loading ? (
          <p className="status loading" role="status">
            Generating JSON...
          </p>
        ) : null}
        {success ? (
          <p className="status success" role="status">
            {success}
          </p>
        ) : null}
        {error ? <p className="status error">{error}</p> : null}
      </section>
    </main>
  );
}
