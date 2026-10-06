/** Dev builds' marker: a ribbon across the bottom-left corner. */
export function DevRibbon() {
  return (
    <div
      class="pointer-events-none fixed bottom-0 left-0 z-50 size-24 overflow-hidden print:hidden"
      aria-hidden="true"
    >
      {/* Centered on the corner's diagonal, 1.5rem in from each edge. */}
      <div class="absolute bottom-3.5 -left-11 h-5 w-34 rotate-45 bg-(--dev-badge) text-center text-chip leading-5 font-bold tracking-widest text-on-accent">
        DEV
      </div>
    </div>
  );
}
