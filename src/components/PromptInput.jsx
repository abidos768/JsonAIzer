export default function PromptInput({
  prompt,
  onPromptChange,
  onSubmit,
  disabled,
  loading
}) {
  const trimmedPrompt = prompt.trim();

  return (
    <section className="card input-card">
      <label htmlFor="prompt-input">Prompt</label>
      <textarea
        id="prompt-input"
        placeholder="Describe what JSON you want..."
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        maxLength={4000}
        rows={8}
        disabled={disabled || loading}
        aria-describedby="prompt-helper"
      />
      <div className="prompt-helper" id="prompt-helper">
        <span>Describe the JSON structure and field constraints.</span>
        <span>{prompt.length}/4000</span>
      </div>
      <div className="input-actions">
        <button
          type="button"
          className="generate-btn"
          onClick={onSubmit}
          disabled={disabled || loading || !trimmedPrompt}
        >
          {loading ? "Generating..." : "Generate JSON"}
        </button>
      </div>
    </section>
  );
}
