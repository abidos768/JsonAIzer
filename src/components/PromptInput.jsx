export default function PromptInput({
  prompt,
  onPromptChange,
  onSubmit,
  disabled,
  loading
}) {
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
      />
      <div className="input-actions">
        <button
          type="button"
          className="generate-btn"
          onClick={onSubmit}
          disabled={disabled || loading || !prompt.trim()}
        >
          {loading ? "Generating..." : "Generate JSON"}
        </button>
      </div>
    </section>
  );
}
