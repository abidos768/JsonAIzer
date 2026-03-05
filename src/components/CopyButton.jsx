import { useState } from "react";

export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (_error) {
      setFailed(true);
      setTimeout(() => setFailed(false), 1600);
    }
  };

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? "copied" : ""} ${failed ? "failed" : ""}`}
      onClick={handleCopy}
      disabled={!text}
    >
      {copied ? "Copied" : failed ? "Copy failed" : "Copy JSON"}
    </button>
  );
}
