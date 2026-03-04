const MAX_ATTEMPTS = 3;

export default function AttemptsCounter({ attemptsUsed }) {
  const remaining = Math.max(0, MAX_ATTEMPTS - attemptsUsed);
  const exhausted = remaining === 0;

  return (
    <div className={`attempts-counter ${exhausted ? "exhausted" : ""}`}>
      <span>Attempts Remaining</span>
      <strong>
        {remaining}/{MAX_ATTEMPTS}
      </strong>
    </div>
  );
}
