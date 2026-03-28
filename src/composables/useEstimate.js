// src/composables/useEstimate.js
import { ref, watch, onBeforeUnmount } from "vue";
import { clipperApi } from "../lib/clipperApi.js";

export function useEstimate(fileRef, { debounceMs = 250 } = {}) {
  const estimating = ref(false);

  let timer = null;
  let token = 0;

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function scheduleEstimate() {
    clearTimer();
    timer = setTimeout(() => {
      estimate().catch((e) => console.error("estimate failed", e));
    }, debounceMs);
  }

  function makePayload(file) {
    return {
      path: String(file.path),
      targetMb: Number(file.targetMb),
      fpsCap: Number(file.fpsCap),
      scale: Number(file.scale),
      audioMode: String(file.audioMode),
      audioSelected: Array.from(file.audioSelected || []).map((x) => Number(x)),
      audioKbps: Number(file.audioKbps),
      codec: String(file.codec),
    };
  }

  async function estimate() {
    const myToken = ++token;
    estimating.value = true;

    let res;
    try {
      res = await clipperApi.estimate(makePayload(fileRef.value));
    } catch (err) {
      if (myToken !== token) return;
      fileRef.value.estimateMb = null;
      fileRef.value.estimateRisk = "error";
      fileRef.value.error = String(err?.message || err);
      estimating.value = false;
      return;
    }

    if (myToken !== token) return;

    if (res?.ok) {
      const f = fileRef.value;

      f.estimateMb = res.estimateMb;
      f.estimateRisk = res.estimateRisk;
      f.estimateRatio = res.estimateRatio;

      f.inWidth = res.inWidth;
      f.inHeight = res.inHeight;
      f.inFps = res.inFps;

      // tracks list (from backend)
      f.audioTracksInfo = res.audioTracksInfo || [];

      // DO NOT overwrite selection every time.
      // Only repair if custom mode and contains invalid items or is empty.
      if (f.audioMode === "custom") {
        const validSet = new Set((f.audioTracksInfo || []).map((t) => Number(t.streamIndex)));
        const current = Array.from(f.audioSelected || []).map(Number).filter((x) => validSet.has(x));

        // remove invalid once
        if (current.join(",") !== (f.audioSelected || []).map(Number).join(",")) {
          f.audioSelected = current;
        }

        // if empty, select first once
        if (f.audioSelected.length === 0 && f.audioTracksInfo.length > 0) {
          f.audioSelected = [Number(f.audioTracksInfo[0].streamIndex)];
        }
      }

      f.warning = null;
    } else {
      const f = fileRef.value;
      f.estimateMb = null;
      f.estimateRisk = "error";
      f.estimateRatio = null;
      f.audioTracksInfo = [];
    }

    estimating.value = false;
  }

  // watch file inputs -> debounce estimate
  watch(
    () => [
      fileRef.value.targetMb,
      fileRef.value.fpsCap,
      fileRef.value.scale,
      fileRef.value.audioMode,
      fileRef.value.audioKbps,
      fileRef.value.codec,
      (fileRef.value.audioSelected || []).slice().sort().join(","),
    ],
    scheduleEstimate,
    { immediate: true }
  );

  // when entering custom mode, select first immediately if we already have tracks
  watch(
    () => fileRef.value.audioMode,
    (mode) => {
      if (mode !== "custom") return;
      const f = fileRef.value;
      if ((!f.audioSelected || f.audioSelected.length === 0) && (f.audioTracksInfo || []).length > 0) {
        f.audioSelected = [Number(f.audioTracksInfo[0].streamIndex)];
      }
    }
  );

  onBeforeUnmount(() => clearTimer());

  return {
    estimating,
    scheduleEstimate,
    estimate,
  };
}
