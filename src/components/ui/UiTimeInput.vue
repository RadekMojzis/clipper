<script setup>
import { computed, watch } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  placeholder: { type: String, default: "" },
  widthClass: { type: String, default: "w-[70px]" },
});

const emit = defineEmits(["update:modelValue", "update:seconds", "update:error"]);

function parseTimeInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true, value: null, error: "" };

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return { ok: true, value: Number(raw), error: "" };
  }

  const parts = raw.split(":").map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) {
    return { ok: false, value: null, error: "Use seconds or hh:mm:ss.s" };
  }
  if (parts.some((part) => !part || !/^\d+(\.\d+)?$/.test(part))) {
    return { ok: false, value: null, error: "Invalid time format" };
  }

  const nums = parts.map(Number);
  const seconds = nums.pop();
  const minutes = nums.pop() ?? 0;
  const hours = nums.pop() ?? 0;

  if (minutes >= 60 || seconds >= 60) {
    return { ok: false, value: null, error: "Minutes and seconds must be under 60" };
  }

  return { ok: true, value: hours * 3600 + minutes * 60 + seconds, error: "" };
}

const parsed = computed(() => parseTimeInput(props.modelValue));

watch(
  parsed,
  (next) => {
    emit("update:seconds", next.ok ? next.value : null);
    emit("update:error", next.ok ? "" : next.error);
  },
  { immediate: true }
);
</script>

<template>
  <input
    :value="modelValue"
    class="ui-input py-2 tabular-nums rounded-lg text-center"
    :class="widthClass"
    type="text"
    inputmode="decimal"
    :placeholder="placeholder"
    @input="emit('update:modelValue', $event.target.value)"
  />
</template>
