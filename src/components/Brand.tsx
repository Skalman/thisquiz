/** The app's wordmark: "This" bold in the accent, "Quiz" as the text around it. */
export function Brand() {
  return (
    <>
      <span class="font-bold text-accent" data-brand-word="this">
        This
      </span>{" "}
      <span data-brand-word="quiz">Quiz</span>
    </>
  );
}
