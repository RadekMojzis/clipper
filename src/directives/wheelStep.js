// src/directives/wheelStep.js
function clamp(n, min, max) {
  if (Number.isFinite(min)) n = Math.max(min, n);
  if (Number.isFinite(max)) n = Math.min(max, n);
  return n;
}

function dispatchInput(el) {
  // makes v-model update
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export default {
  mounted(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();

    // Ignore checkboxes (as requested)
    if (tag === "input" && type === "checkbox") return;

    // NUMBER INPUTS
    if (tag === "input" && type === "number") {
      const onWheel = (e) => {
        // only when hovered/focused so you don’t accidentally change values while scrolling page
        const isActive = document.activeElement === el || el.matches(":hover");
        if (!isActive) return;

        e.preventDefault();

        const stepAttr = el.getAttribute("step");
        const step = stepAttr && stepAttr !== "any" ? Number(stepAttr) : 1;
        const min = el.hasAttribute("min") ? Number(el.getAttribute("min")) : -Infinity;
        const max = el.hasAttribute("max") ? Number(el.getAttribute("max")) : Infinity;

        const cur = Number(el.value || 0);
        const dir = e.deltaY < 0 ? +1 : -1;
        const next = clamp(cur + dir * (Number.isFinite(step) ? step : 1), min, max);

        el.value = String(next);
        dispatchInput(el);
      };

      el.__wheelStepHandler = onWheel;
      el.addEventListener("wheel", onWheel, { passive: false });
      return;
    }

    // SELECT DROPDOWNS
    if (tag === "select") {
      const onWheel = (e) => {
        const isActive = document.activeElement === el || el.matches(":hover");
        if (!isActive) return;

        e.preventDefault();

        const opts = Array.from(el.options).filter((o) => !o.disabled);
        if (!opts.length) return;

        const currentIndex = opts.findIndex((o) => o.value === el.value);
        const dir = e.deltaY < 0 ? -1 : +1; // wheel up -> previous, wheel down -> next
        const nextIndex = clamp(currentIndex + dir, 0, opts.length - 1);

        el.value = opts[nextIndex].value;
        dispatchInput(el);
      };

      const onKeyDown = (e) => {
        // allow up/down even if you want “option up/down” behavior explicitly
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

        e.preventDefault();

        const opts = Array.from(el.options).filter((o) => !o.disabled);
        if (!opts.length) return;

        const currentIndex = opts.findIndex((o) => o.value === el.value);
        const dir = e.key === "ArrowUp" ? -1 : +1;
        const nextIndex = clamp(currentIndex + dir, 0, opts.length - 1);

        el.value = opts[nextIndex].value;
        dispatchInput(el);
      };

      el.__wheelStepHandler = onWheel;
      el.__wheelStepKeyHandler = onKeyDown;
      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("keydown", onKeyDown);
      return;
    }
  },

  unmounted(el) {
    if (el.__wheelStepHandler) {
      el.removeEventListener("wheel", el.__wheelStepHandler);
      delete el.__wheelStepHandler;
    }
    if (el.__wheelStepKeyHandler) {
      el.removeEventListener("keydown", el.__wheelStepKeyHandler);
      delete el.__wheelStepKeyHandler;
    }
  },
};
