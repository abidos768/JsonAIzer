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

export default function JSONOutput({ output }) {
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

  return (
    <section className="card output-card fade-in">
      <div className="output-header">
        <h2>JSON Output</h2>
        <CopyButton text={output} />
      </div>

      {topLevelObject ? (
        <div className="json-collapsible">
          {Object.entries(parsed).map(([key, value]) =>
            renderCollapsibleValue(key, value)
          )}
        </div>
      ) : (
        <pre>{output}</pre>
      )}
    </section>
  );
}
