<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  modelValue: [String, Number, Boolean, Object, null],
  options: { type: Array, default: () => [] }, // [{ value, label, disabled? }, ...]
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: "Select…" },

  // styling knobs
  widthClass: { type: String, default: "" }, // optional: e.g. "w-28"
  align: { type: String, default: "left" }, // "left" | "right"
  maxMenuHeightClass: { type: String, default: "max-h-64" },
});

const emit = defineEmits(["update:modelValue", "change"]);

const rootEl = ref(null);
const btnEl = ref(null);
const menuEl = ref(null);

const open = ref(false);
const activeIndex = ref(-1);

// --- derived ---
const normalizedOptions = computed(() =>
  (props.options || []).map((o) => ({
    value: o?.value,
    label: String(o?.label ?? o?.value ?? ""),
    disabled: !!o?.disabled,
  }))
);

const selectedIndex = computed(() =>
  normalizedOptions.value.findIndex((o) => Object.is(o.value, props.modelValue))
);

const selectedLabel = computed(() => {
  const idx = selectedIndex.value;
  if (idx >= 0) return normalizedOptions.value[idx]?.label ?? "";
  return "";
});

function isDisabled(i) {
  return !!normalizedOptions.value[i]?.disabled;
}

function clampIndex(i) {
  const n = normalizedOptions.value.length;
  if (!n) return -1;
  return Math.max(0, Math.min(n - 1, i));
}

function findNextEnabled(from, dir) {
  const opts = normalizedOptions.value;
  if (!opts.length) return -1;

  let i = clampIndex(from);
  for (let step = 0; step < opts.length; step++) {
    if (!isDisabled(i)) return i;
    i = (i + dir + opts.length) % opts.length;
  }
  return -1;
}

function scrollActiveIntoView() {
  const el = menuEl.value;
  if (!el) return;
  const item = el.querySelector(`[data-idx="${activeIndex.value}"]`);
  if (!item) return;

  const itemTop = item.offsetTop;
  const itemBottom = itemTop + item.offsetHeight;
  const viewTop = el.scrollTop;
  const viewBottom = viewTop + el.clientHeight;

  if (itemTop < viewTop) el.scrollTop = itemTop;
  else if (itemBottom > viewBottom) el.scrollTop = itemBottom - el.clientHeight;
}

async function openMenu() {
  if (props.disabled) return;
  open.value = true;

  // set active to selected or first enabled
  const base = selectedIndex.value >= 0 ? selectedIndex.value : 0;
  activeIndex.value = findNextEnabled(base, +1);

  await nextTick();
  scrollActiveIntoView();
}

function closeMenu() {
  open.value = false;
}

function toggle() {
  if (props.disabled) return;
  if (open.value) closeMenu();
  else openMenu();
}

function selectByIndex(i) {
  const opt = normalizedOptions.value[i];
  if (!opt || opt.disabled) return;

  emit("update:modelValue", opt.value);
  emit("change", opt.value);
  closeMenu();

  // keep focus on button for wheel/keyboard
  nextTick(() => btnEl.value?.focus?.());
}

function moveActive(dir) {
  if (!open.value) {
    // if closed: wheel/keys should change selection immediately
    const start = selectedIndex.value >= 0 ? selectedIndex.value : 0;
    const next = findNextEnabled(start + dir, dir);
    if (next >= 0) selectByIndex(next);
    return;
  }

  const start = activeIndex.value >= 0 ? activeIndex.value : 0;
  const next = findNextEnabled(start + dir, dir);
  if (next >= 0) {
    activeIndex.value = next;
    nextTick(scrollActiveIntoView);
  }
}

// --- click outside ---
function onDocMouseDown(e) {
  if (!open.value) return;
  const root = rootEl.value;
  if (!root) return;
  if (root.contains(e.target)) return;
  closeMenu();
}

onMounted(() => document.addEventListener("mousedown", onDocMouseDown));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocMouseDown));

// --- keyboard ---
let typeBuffer = "";
let typeTimer = null;

function clearTypeahead() {
  typeBuffer = "";
  if (typeTimer) clearTimeout(typeTimer);
  typeTimer = null;
}

function onKeydown(e) {
  if (props.disabled) return;

  const k = e.key;

  if (k === "Enter" || k === " ") {
    e.preventDefault();
    if (!open.value) openMenu();
    else if (activeIndex.value >= 0) selectByIndex(activeIndex.value);
    return;
  }

  if (k === "Escape") {
    if (open.value) {
      e.preventDefault();
      closeMenu();
    }
    return;
  }

  if (k === "ArrowDown") {
    e.preventDefault();
    if (!open.value) openMenu();
    else moveActive(+1);
    return;
  }
  if (k === "ArrowUp") {
    e.preventDefault();
    if (!open.value) openMenu();
    else moveActive(-1);
    return;
  }

  if (k === "Home") {
    if (!open.value) return;
    e.preventDefault();
    activeIndex.value = findNextEnabled(0, +1);
    nextTick(scrollActiveIntoView);
    return;
  }

  if (k === "End") {
    if (!open.value) return;
    e.preventDefault();
    activeIndex.value = findNextEnabled(normalizedOptions.value.length - 1, -1);
    nextTick(scrollActiveIntoView);
    return;
  }

  // typeahead (letters/numbers)
  if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    typeBuffer += k.toLowerCase();
    if (typeTimer) clearTimeout(typeTimer);
    typeTimer = setTimeout(clearTypeahead, 450);

    const opts = normalizedOptions.value;
    const start = open.value ? (activeIndex.value >= 0 ? activeIndex.value : 0) : (selectedIndex.value >= 0 ? selectedIndex.value : 0);

    // search forward wrapping
    for (let step = 1; step <= opts.length; step++) {
      const idx = (start + step) % opts.length;
      if (opts[idx].disabled) continue;
      if (opts[idx].label.toLowerCase().startsWith(typeBuffer)) {
        if (!open.value) {
          selectByIndex(idx);
        } else {
          activeIndex.value = idx;
          nextTick(scrollActiveIntoView);
        }
        break;
      }
    }
  }
}

// --- wheel support ---
function onWheel(e) {
  if (props.disabled) return;
  // only if user is interacting with this control
  // (hover over it or focus inside)
  const root = rootEl.value;
  if (!root) return;

  const active = document.activeElement;
  const hovering = root.matches(":hover");
  const focused = root.contains(active);

  if (!hovering && !focused) return;

  // prevent page scroll
  e.preventDefault();

  const dir = e.deltaY > 0 ? +1 : -1;
  if (!open.value) {
    moveActive(dir);
  } else {
    moveActive(dir);
  }
}

watch(
  () => props.modelValue,
  () => {
    // if model changed externally while open, keep active aligned
    if (!open.value) return;
    const base = selectedIndex.value >= 0 ? selectedIndex.value : activeIndex.value;
    activeIndex.value = findNextEnabled(base, +1);
    nextTick(scrollActiveIntoView);
  }
);

const menuPosClass = computed(() => (props.align === "right" ? "right-0" : "left-0"));
</script>

<template>
  <div ref="rootEl" class="relative inline-block" @wheel.passive="false" @wheel="onWheel">
    <button
      ref="btnEl"
      type="button"
      :disabled="disabled"
      @click="toggle"
      @keydown="onKeydown"
      class="group flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-base font-semibold shadow-sm transition
             border-white/15 bg-black/35 text-white
             hover:border-green-700 hover:bg-black/45
             focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-green-300/60
             disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:bg-black/35"
      :class="widthClass"
      aria-haspopup="listbox"
      :aria-expanded="open ? 'true' : 'false'"
    >
      <span class="min-w-0 flex-1 truncate text-left">
        <span v-if="selectedLabel">{{ selectedLabel }}</span>
        <span v-else class="text-white/45">{{ placeholder }}</span>
      </span>

      <span
        class="pointer-events-none select-none text-white/40 transition-colors
               group-hover:text-green-500 group-focus:text-green-500"
      >
        <fa icon="chevron-down"></fa>
      </span>
    </button>

    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1 scale-[0.99]"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-120 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-1 scale-[0.99]"
    >
      <div
        v-if="open"
        class="absolute z-50 mt-2 w-full min-w-[12rem] overflow-hidden rounded-2xl border border-white/10 bg-black/85 shadow-[0_18px_60px_rgba(0,0,0,.55)] backdrop-blur"
        :class="[menuPosClass]"
        role="listbox"
      >
        <div
          ref="menuEl"
          class="overflow-auto p-1"
          :class="maxMenuHeightClass"
        >
          <button
            v-for="(opt, i) in normalizedOptions"
            :key="`${i}-${String(opt.value)}`"
            type="button"
            role="option"
            :aria-selected="Object.is(opt.value, modelValue) ? 'true' : 'false'"
            :disabled="opt.disabled"
            @mouseenter="!opt.disabled && (activeIndex = i)"
            @click="selectByIndex(i)"
            class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-base transition"
            :data-idx="i"
            :class="[
              opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              i === activeIndex ? 'bg-green-500/15' : 'bg-transparent',
              Object.is(opt.value, modelValue) ? 'text-green-200' : 'text-white/90',
              !opt.disabled && 'hover:bg-green-500/15'
            ]"
          >
            <span class="min-w-0 flex-1 truncate">{{ opt.label }}</span>
            <span v-if="Object.is(opt.value, modelValue)" class="text-grass-300">●</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
