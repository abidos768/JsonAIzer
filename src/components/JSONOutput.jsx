import { useEffect, useState } from "react";
import CopyButton from "./CopyButton";

function renderCollapsibleValue(key, value) {
  const valueType = typeof value;
  const isObject = value && valueType === "object";

  if (!isObject) {
    return (
      <div className="json-leaf" key={key}>
        <span className="json-key">{key}:</span>{" "}
        <code>{JSON.stringify(value, null, 2)}</code>
      </div>
    );
  }

  return (
    <details className="json-section" key={key} open>
      <summary>{key}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

export default function JSONOutput({ output, loading, onOutputChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (!isEditing) {
      setDraft(output);
      setEditError("");
    }
  }, [isEditing, output]);

  if (loading && !output) {
    return (
      <section className="card output-card">
        <div className="output-header">
          <h2>JSON Output</h2>
        </div>
        <div className="skeleton-block" />
        <div className="skeleton-block short" />
        <div className="skeleton-block" />
      </section>
    );
  }

  if (!output) {
    return (
      <section className="card output-card empty">
        <h2>JSON Output</h2>
        <p>Generated JSON will appear here.</p>
      </section>
    );
  }

  const parsed = JSON.parse(output);
  const topLevelObject =
    parsed && typeof parsed === "object" && !Array.isArray(parsed);

  const handleSave = () => {
    try {
      const normalized = JSON.stringify(JSON.parse(draft), null, 2);
      onOutputChange(normalized);
      setIsEditing(false);
      setEditError("");
    } catch (_error) {
      setEditError("Invalid JSON. Fix formatting before saving.");
    }
  };

  return (
    <section className="card output-card fade-in">
      <div className="output-header">
        <h2>JSON Output</h2>
        <div className="output-actions">
          <CopyButton text={isEditing ? draft : output} />
          {isEditing ? (
            <>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setDraft(output);
                  setEditError("");
                  setIsEditing(false);
                }}
              >
                Cancel
              </button>
              <button type="button" className="generate-btn" onClick={handleSave}>
                Save
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <>
          <textarea
            className="json-editor"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={16}
            spellCheck={false}
          />
          {editError ? <p className="status error inline">{editError}</p> : null}
        </>
      ) : (
        <>
          {topLevelObject ? (
            <div className="json-collapsible">
              {Object.entries(parsed).map(([key, value]) =>
                renderCollapsibleValue(key, value)
              )}
            </div>
          ) : (
            <pre>{output}</pre>
          )}
        </>
      )}
    </section>
  );
}
