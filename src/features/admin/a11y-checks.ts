// Shared checks for the admin a11y/responsive tests (X9). jsdom computes no
// layout, so responsiveness is checked through the Tailwind classes in use.

const labelled = (el: Element) =>
  Boolean(
    el.getAttribute("aria-label")?.trim() ||
    el.getAttribute("aria-labelledby") ||
    el.closest("label") ||
    (el.id && el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`)),
  );

/** Form fields without an accessible name (label, aria-label or aria-labelledby). */
export function unlabelledFields(root: ParentNode): Element[] {
  return [...root.querySelectorAll("input, select, textarea")].filter(
    // Hidden file inputs are opened by a named button; they never get focus.
    (el) =>
      (el as HTMLInputElement).type !== "hidden" && !(el as HTMLElement).hidden && !labelled(el),
  );
}

/** Buttons with no text and no aria-label/aria-labelledby/title (icon-only). */
export function unnamedButtons(root: ParentNode): Element[] {
  return [...root.querySelectorAll("button, [role='button']")].filter(
    (el) =>
      !el.textContent?.trim() &&
      !el.getAttribute("aria-label")?.trim() &&
      !el.getAttribute("aria-labelledby") &&
      !el.getAttribute("title")?.trim(),
  );
}

/** Classes that would overflow a 375 px screen. */
export function wideFixedWidths(root: ParentNode): string[] {
  const found: string[] = [];
  for (const el of root.querySelectorAll("[class]")) {
    for (const cls of el.getAttribute("class")!.split(/\s+/)) {
      // Only unprefixed classes apply on a phone (sm:/md:/lg: start at 640 px).
      const m = /^(?:min-)?w-\[(\d+)px\]$/.exec(cls);
      if (m && Number(m[1]) > 375) found.push(cls);
    }
  }
  return found;
}

/**
 * Grids that start with more than two columns on a phone. Two small cards side
 * by side are by design (metrics); the 7-column month calendar is too.
 */
export function multiColumnGrids(root: ParentNode): string[] {
  const found: string[] = [];
  for (const el of root.querySelectorAll("[class~='grid']")) {
    for (const cls of el.getAttribute("class")!.split(/\s+/)) {
      const m = /^grid-cols-(\d+)$/.exec(cls);
      if (m && Number(m[1]) > 2 && m[1] !== "7") found.push(cls);
    }
  }
  return found;
}
