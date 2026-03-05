import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const isSignUp = mode === "signup";
  const trimmedEmail = email.trim();
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const passwordIsValid = password.length >= 6;
  const confirmMatches = password === confirmPassword;
  const canSubmit =
    emailIsValid &&
    passwordIsValid &&
    (!isSignUp || (confirmPassword.length > 0 && confirmMatches));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setEmailTouched(true);
    setPasswordTouched(true);
    if (isSignUp) setConfirmTouched(true);

    if (!canSubmit) {
      setError("Please fix the highlighted fields before continuing.");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setMessage("Check your email for the confirmation link.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) {
          setError(signInError.message);
        }
      }
    } catch (_err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <div className="background-grid" />
      <section className="app-content auth-page">
        <aside className="auth-intro card">
          <p className="badge">AI JSON Generator</p>
          <h1>One-Shot Prompt to JSON</h1>
          <p>
            Generate schema-safe JSON with a secure account and tracked usage.
          </p>
          <ul className="auth-points">
            <li>3 protected attempts per account session</li>
            <li>Copy, edit, and refine generated JSON fast</li>
            <li>Backend-enforced limits and secure API handling</li>
          </ul>
        </aside>

        <form className="auth-form card" onSubmit={handleSubmit} noValidate>
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={`auth-tab ${!isSignUp ? "active" : ""}`}
              onClick={() => {
                setMode("signin");
                setError("");
                setMessage("");
                setConfirmPassword("");
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${isSignUp ? "active" : ""}`}
              onClick={() => {
                setMode("signup");
                setError("");
                setMessage("");
              }}
            >
              Sign Up
            </button>
          </div>

          <p className="auth-subtitle">
            {isSignUp
              ? "Create an account to start generating JSON."
              : "Welcome back. Sign in to continue."}
          </p>

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="auth-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            required
          />
          {emailTouched && !emailIsValid ? (
            <p className="status error inline">Enter a valid email address.</p>
          ) : null}

          <label htmlFor="password">Password</label>
          <div className="password-row">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="auth-input"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
              required
              minLength={6}
            />
            <button
              type="button"
              className="ghost-btn password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {passwordTouched && !passwordIsValid ? (
            <p className="status error inline">Password must be at least 6 characters.</p>
          ) : null}

          {isSignUp ? (
            <>
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                className="auth-input"
                placeholder="Retype password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setConfirmTouched(true)}
                required
                minLength={6}
              />
              {confirmTouched && !confirmMatches ? (
                <p className="status error inline">Passwords do not match.</p>
              ) : null}
            </>
          ) : null}

          <button
            type="submit"
            className="generate-btn auth-submit"
            disabled={loading || !canSubmit}
          >
            {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
          </button>

          {error && <p className="status error">{error}</p>}
          {message && <p className="status success">{message}</p>}
        </form>
      </section>
    </main>
  );
}
