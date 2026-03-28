<script setup>
import { computed, ref, watch } from "vue";
import UiSelect from "./ui/UiSelect.vue";
import UiTimeInput from "./ui/UiTimeInput.vue";

const props = defineProps({ file: Object });
const emit = defineEmits(["remove"]);

const isRunning = computed(() => ["queued", "encoding"].includes(props.file.status) && !!props.file.jobId);

const progressPct = computed(() => {
  const v = props.file.pctMonotonic ?? props.file.pct ?? 0;
  return Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
});

const estimateClass = computed(() => {
  const r = props.file.estimateRisk;
  if (!r) return "text-white/70";
  if (r === "low") return "text-green-500";
  if (r === "medium") return "text-amber-400";
  if (r === "high") return "text-amber-500";
  if (r === "very_high") return "text-rose-500";
  return "text-rose-300";
});

const sourceFpsLabel = computed(() => {
  const fps = props.file.inFps;
  if (!fps) return "Source";
  return `${fps} (Source)`;
});

const scaleOptions = computed(() => {
  const w = props.file.inWidth;
  const h = props.file.inHeight;
  const factors = [1, 0.75, 2 / 3, 0.5, 1 / 3, 0.25];

  if (!w || !h) {
    return factors.map((s) => ({ value: s, label: `${Math.round(s * 100)}%` }));
  }

  return factors.map((s) => {
    const outW = Math.max(2, Math.round(w * s));
    const outH = Math.max(2, Math.round(h * s));
    return { value: s, label: `${outW}×${outH}${s === 1 ? " (source)" : ""}` };
  });
});

// ----- file name helpers -----
function basename(p) {
  if (!p) return "";
  const parts = String(p).split(/[\\/]/);
  return parts[parts.length - 1] || "";
}

const inputName = computed(() => props.file?.name || basename(props.file?.path));
const outputName = computed(() => basename(props.file?.outputPath) || plannedOutputName.value);

const inlineSummary = computed(() => {
  const out = outputName.value;
  const est = props.file?.estimateMb?.toFixed?.(1);
  return { out, est };
});

const clipInputError = computed(() => {
  if (props.file.startError) return `Start: ${props.file.startError}`;
  if (props.file.endError) return `End: ${props.file.endError}`;
  return "";
});

function stripExt(name) {
  return String(name || "").replace(/\.[^/.]+$/, "");
}

const plannedOutputName = computed(() => {
  const base = stripExt(inputName.value);
  const codec = props.file.codec || "av1";
  const mb = props.file.targetMb ?? 50;
  return `${base}_${codec}_${mb}MB.mp4`;
});


// ----- estimate debounce & stale-response guard -----
const estimating = ref(false);
let estimateTimer = null;
let estimateToken = 0;

function scheduleEstimate() {
  if (estimateTimer) clearTimeout(estimateTimer);
  estimateTimer = setTimeout(() => {
    estimate().catch((e) => console.error("estimate failed", e));
  }, 250);
}

async function estimate() {
  const myToken = ++estimateToken;
  estimating.value = true;

  const payload = {
    path: props.file.path,
    targetMb: Number(props.file.targetMb),
    fpsCap: Number(props.file.fpsCap),
    scale: Number(props.file.scale),
    start: props.file.startSeconds,
    end: props.file.endSeconds,
    audioMode: String(props.file.audioMode),
    audioSelected: Array.from(props.file.audioSelected || []).map((x) => Number(x)),
    audioKbps: Number(props.file.audioKbps),
    codec: String(props.file.codec),
  };

  let res;
  try {
    res = await window.clipper.estimate(payload);
  } catch (err) {
    if (myToken !== estimateToken) return;
    props.file.estimateMb = null;
    props.file.estimateRisk = "error";
    props.file.error = String(err?.message || err);
    estimating.value = false;
    return;
  }

  if (myToken !== estimateToken) return;

  if (res?.ok) {
    props.file.estimateMb = res.estimateMb;
    props.file.estimateRisk = res.estimateRisk;
    props.file.estimateRatio = res.estimateRatio;

    props.file.inWidth = res.inWidth;
    props.file.inHeight = res.inHeight;
    props.file.inFps = res.inFps;

    props.file.audioTracksInfo = res.audioTracksInfo || [];

    if (props.file.audioMode === "custom") {
      const validSet = new Set((props.file.audioTracksInfo || []).map((t) => Number(t.streamIndex)));
      const current = Array.from(props.file.audioSelected || [])
        .map(Number)
        .filter((x) => validSet.has(x));

      // only repair if invalids exist
      const prev = Array.from(props.file.audioSelected || []).map(Number);
      if (current.join(",") !== prev.join(",")) props.file.audioSelected = current;

      // if empty, pick first immediately
      if (props.file.audioSelected.length === 0 && props.file.audioTracksInfo.length > 0) {
        props.file.audioSelected = [Number(props.file.audioTracksInfo[0].streamIndex)];
      }
    }

    props.file.error = "";
  } else {
    props.file.estimateMb = null;
    props.file.estimateRisk = "error";
    props.file.estimateRatio = null;
    props.file.audioTracksInfo = [];
    props.file.error = res?.error || "Estimate failed";
  }

  estimating.value = false;
}

watch(
  () => [
    props.file.targetMb,
    props.file.fpsCap,
    props.file.scale,
    props.file.startSeconds,
    props.file.endSeconds,
    props.file.startError,
    props.file.endError,
    props.file.audioMode,
    props.file.audioKbps,
    props.file.codec,
    (props.file.audioSelected || []).slice().sort().join(","),
  ],
  () => {
    if (clipInputError.value) {
      props.file.estimateMb = null;
      props.file.estimateRisk = "error";
      props.file.estimateRatio = null;
      props.file.error = clipInputError.value;
      return;
    }
    scheduleEstimate();
  },
  { immediate: true }
);

watch(
  () => props.file.audioMode,
  (mode) => {
    if (mode !== "custom") return;
    if ((!props.file.audioSelected || props.file.audioSelected.length === 0) && (props.file.audioTracksInfo || []).length > 0) {
      props.file.audioSelected = [Number(props.file.audioTracksInfo[0].streamIndex)];
    }
  }
);

function buildEncodePayload() {
  return {
    path: props.file.path,
    name: props.file.name,
    size: props.file.size,
    targetMb: props.file.targetMb,
    fpsCap: props.file.fpsCap,
    scale: props.file.scale,
    start: props.file.startSeconds,
    end: props.file.endSeconds,
    audioMode: props.file.audioMode,
    audioSelected: Array.from(props.file.audioSelected || []).map((x) => Number(x)),
    audioKbps: props.file.audioKbps,
    codec: props.file.codec,
  };
}
function formatBytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let x = v;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i++; }
  return `${x.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

const finalSizeLabel = computed(() => formatBytes(props.file.outputBytes));

async function copyOutputFile() {
  if (!props.file.outputPath) return;
  const res = await window.clipper.copyFileToClipboard(props.file.outputPath);
  if (!res?.ok) {
    props.file.error = res?.error || "Failed to copy file to clipboard";
  }
}
async function encode() {
  if (isRunning.value) return;
  if (clipInputError.value) {
    props.file.status = "error";
    props.file.error = clipInputError.value;
    return;
  }

  // reset for a new run (optional but recommended)
  props.file.pct = 0;
  props.file.pctMonotonic = 0;
  props.file.pass = 1;

  props.file.status = "queued";
  props.file.error = "";
  props.file.outputPath = "";
  props.file.outputBytes = null;

  const res = await window.clipper.enqueueJobs({ file: buildEncodePayload() });
  if (!res?.ok) {
    console.log(props.file)
    props.file.status = "error";
    props.file.error = res?.error || "Canceled";
    return;
  }

  // ✅ allow stop immediately even before first progress event
  props.file.jobId = res.jobId;
}

async function stop() {
  // only stop if actually running and we have a job id
  if (!isRunning.value || !props.file.jobId) return;

  try {
    await window.clipper.cancelJob(props.file.jobId);
  } finally {
    // optimistic UI (your main onJobStatus can still overwrite later)
    props.file.status = "cancelled";
    props.file.error = "";
  }
}

async function cancelOrRemove() {
  if (isRunning.value && props.file.jobId) {
    await window.clipper.cancelJob(props.file.jobId);
    props.file.status = "cancelled";
  }
  emit("remove", props.file.id);
}

const statusLabel = computed(() => {
  if (props.file.status === "encoding") return `Encoding (pass ${props.file.pass || 1}/2)`;
  if (props.file.status === "queued") return "Queued";
  if (props.file.status === "done") return "Done";
  if (props.file.status === "cancelled") return "Cancelled";
  if (props.file.status === "error") return "Error";
  return "Idle";
});

const statusClass = computed(() => {
  const s = props.file.status;
  if (s === "encoding") return "border-green-500/40 text-green-200 bg-green-500/10";
  if (s === "done") return "border-green-500/40 text-green-200 bg-green-500/10";
  if (s === "queued") return "border-amber-500/40 text-amber-200 bg-amber-500/10";
  if (s === "cancelled") return "border-amber-500/40 text-amber-200 bg-amber-500/10";
  if (s === "error") return "border-rose-500/40 text-rose-200 bg-rose-500/10";
  return "border-white/10 text-white/70 bg-white/5";
});

const targetBytes = computed(() => {
  const mb = Number(props.file?.targetMb);
  if (!Number.isFinite(mb) || mb <= 0) return null;
  return mb * 1024 * 1024;
});

const isWithinTarget = computed(() => {
  const out = Number(props.file?.outputBytes);
  const tgt = targetBytes.value;
  if (!Number.isFinite(out) || out <= 0 || !Number.isFinite(tgt) || tgt <= 0) return null;
  return out <= tgt;
});

const finalSizeClass = computed(() => {
  if (isWithinTarget.value === true) return "text-green-500";
  if (isWithinTarget.value === false) return "text-rose-500";
  return "text-white/70";
});

const finalSizeIcon = computed(() => {
  if (isWithinTarget.value === true) return "check";
  if (isWithinTarget.value === false) return "times";
  return null;
});
</script>

<template>
  <div class="rounded-3xl border border-white/10 bg-ink-900/40 p-5 shadow-[0_10px_30px_rgba(0,0,0,.25)]">
    <!-- Top line -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-3">
          <div class="truncate text-xl font-bold">
            {{ inputName }}
          </div>
          <fa v-if="inlineSummary" icon="arrow-right"></fa>
          <div v-if="inlineSummary" class="truncate text-xl font-bold text-white/90">
            {{ inlineSummary.out }}
          </div>
          <div v-if="file.status === 'done'" class="flex text-xl flex-wrap items-center gap-2">
            <span class="font-semibold flex items-center gap-2" :class="finalSizeClass">
              {{ finalSizeLabel }}
              <fa v-if="finalSizeIcon" :icon="finalSizeIcon" />
            </span>
          </div>
          <div v-else-if="inlineSummary" class="flex text-xl flex-wrap items-center gap-2">
            <span class="font-semibold" :class="estimateClass">
                ~ {{ inlineSummary.est ?? "—" }} MB
            </span>
          </div>
        </div>
      </div>
      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button
          v-if="file.status === 'done'"
          class="btn-action btn-glow btn-amber"
          @click="copyOutputFile"
          title="Copy output file to clipboard"
        >
          <fa icon="copy" class="relative z-10" />
        </button>
        <button
          v-if="!isRunning"
          class="btn-action btn-glow btn-green"
          @click="encode"
          title="Encode"
        >
          <fa icon="play" class="relative z-10" />
        </button>

        <button
          v-else
          class="btn-action btn-glow btn-amber"
          @click="stop"
          title="Stop"
        >
          <fa icon="stop" class="relative z-10" />
        </button>
        <button
          class="btn-action btn-glow btn-rose"
          @click="cancelOrRemove"
          title="Cancel / Remove"
        >
          <fa icon="trash" class="relative z-10" />
        </button>
      </div>
    </div>

    <!-- Controls -->
    <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 font-semibold">
      <div class="flex items-center gap-3">
        <label class="flex flex flex-col">
          <span class="text-white/80">Target</span>
          <div>
              <input
                v-wheel-step
                class="ui-input py-2 tabular-nums w-14 max-w-[40px] text-center"
                type="number" min="1" step="1"
                v-model.number="file.targetMb"
              />
            <span class="text-white/80 ms-2">MB</span>
          </div>
        </label>
        <label class="flex flex-col">
          <span class="text-white/80">Codec</span>
          <UiSelect
            v-model="file.codec"
            :options="[
              { value: 'av1', label: 'AV1' },
              { value: 'h264', label: 'H.264' },
            ]"
            width-class="w-28"
          />
      </label>
      </div>
      <div class="hidden sm:block h-20 w-px bg-white/10"></div>
      
      <div class="flex items-center gap-3">
        <label class="flex flex-col">
          <span class="text-white/80">FPS</span>
          <UiSelect
            v-model="file.fpsCap"
            :options="[
              { value: 0, label: sourceFpsLabel },
              { value: 60, label: '60' },
              { value: 30, label: '30' },
              { value: 25, label: '25' },
              { value: 20, label: '20' },
              { value: 15, label: '15' },
            ]"
            width-class="w-36"
          />
        </label>
        <label class="flex flex-col">
          <span class="text-white/80">Scale</span>
          <UiSelect
            v-model="file.scale"
            :options="scaleOptions.map(o => ({ value: o.value, label: o.label }))"
            width-class="w-44"
          />
        </label>
      </div>
      <div class="hidden sm:block h-20 w-px bg-white/10"></div>
      <div class="flex items-center gap-3">
        <label class="flex flex-col">
          <span class="text-white/80">Audio</span>
          <UiSelect
            v-model="file.audioMode"
            :options="[
              { value: 'all', label: 'All tracks' },
              { value: 'custom', label: 'Choose tracks…' },
              { value: 'none', label: 'No audio' },
            ]"
            width-class="w-44"
          />
        </label>

        <label v-if="file.audioMode !== 'none'" class="flex flex-col">
          <span class="text-white/80">
            Audio bitrate
          </span>
          <div>
            <input
              v-wheel-step
              class="ui-input py-2 tabular-nums w-[50px] rounded-lg text-center"
              type="number"
              min="0"
              step="16"
              :disabled="file.audioMode === 'none' || (file.audioMode === 'custom' && (!file.audioSelected || !file.audioSelected.length))"
              v-model.number="file.audioKbps"
            />
            <span class="text-white/80">
              kbps
            </span>
          </div>
        </label>
      </div>
      <div class="hidden sm:block h-20 w-px bg-white/10"></div>
      <div class="flex items-center gap-2">
        <label class="flex flex-col">
          <span class="text-white/80">Start</span>
          <div>
            <UiTimeInput
              v-model="file.startText"
              placeholder=""
              @update:seconds="file.startSeconds = $event"
              @update:error="file.startError = $event"
            />
          </div>
        </label>
        <label class="flex flex-col">
          <span class="text-white/80">End</span>
          <div>
            <UiTimeInput
              v-model="file.endText"
              placeholder=""
              @update:seconds="file.endSeconds = $event"
              @update:error="file.endError = $event"
            />
          </div>
        </label>
      </div>
    </div>

    <!-- Track picker -->
    <div v-if="file.audioMode === 'custom'" class="mt-4 rounded-3xl border border-white/10 bg-ink-950/35 p-4">
      <div class="flex items-center justify-between">
        <div class="text-base font-semibold text-white/80">Tracks</div>
        <div class="text-sm text-white/50">pick one or many</div>
      </div>

      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        <label
          v-for="t in (file.audioTracksInfo || [])"
          :key="t.streamIndex"
          class="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition
                 hover:border-green-500 hover:bg-white/7"
        >
          <input
            type="checkbox"
            :value="t.streamIndex"
            v-model="file.audioSelected"
            class="h-5 w-5 accent-green-500"
          />
          <div class="min-w-0">
            <div class="truncate text-base font-semibold text-white/90">
              {{ t.displayName || t.label }}
            </div>
            <div class="truncate text-sm text-white/55">
              {{ t.label }}
            </div>
          </div>
        </label>

        <div v-if="!(file.audioTracksInfo || []).length" class="text-sm text-white/60">
          (No audio tracks detected)
        </div>
      </div>
    </div>

    <!-- Progress -->
    <!-- <div class="mt-2 text-xs text-white/60">
      status={{ file.status }} pct={{ file.pct }} mono={{ file.pctMonotonic }} pass={{ file.pass }} 
    </div> -->
    <div v-if="file.status === 'encoding' || file.status === 'queued' || file.status === 'done'" class="mt-4 relative">
      <div class="absolute inset-0 flex text-lg right-0 items-center justify-end -top-20">
          
        </div>
      <div class="relative overflow-hidden h-8 rounded-lg border border-white/10 bg-ink-950/45">
        <div
          class="h-full bg-gradient-to-r from-green-800 to-green-400 transition-[width] duration-200"
          :style="{ width: progressPct + '%' }"
        ></div>
        <!-- sheen while encoding -->
        <div
          v-if="file.status === 'encoding'"
          class="pointer-events-none absolute inset-0 opacity-35"
        >
          <!-- <div class="h-full w-1/3 bg-white/20 blur-sm animate-sheen"></div> -->
        </div>

        <div v-if="file.status !== 'done'" class="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-white text-shadow-lg/100">
          {{ progressPct }}% 
          <span v-if="file.status === 'encoding'" class="ms-1">
            (pass {{ file.pass || 1 }}/2)
          </span>
        </div>
        <div v-else class="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-white text-shadow-lg/100">
          Done
        </div>
      </div>
    </div>
    <div v-if="file.error" class="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-base text-rose-100">
      {{ file.error }}
    </div>
  </div>
</template>
