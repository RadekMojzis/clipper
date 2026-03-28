<script setup>
import { onMounted, ref, watch } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  placeholder: { type: String, default: "" },
  widthClass: { type: String, default: "w-[70px]" },
});

const emit = defineEmits(["update:modelValue", "update:seconds", "update:error"]);
const localValue = ref(props.modelValue);
const isFocused = ref(false);

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

function commitValidation(value) {
  const parsed = parseTimeInput(value);
  emit("update:seconds", parsed.ok ? parsed.value : null);
  emit("update:error", parsed.ok ? "" : parsed.error);
}

watch(
  () => props.modelValue,
  (next) => {
    if (!isFocused.value && next !== localValue.value) {
      localValue.value = next;
    }
  }
);

function sanitizeValue(value) {
  return String(value ?? "").replace(/[^\d:.]/g, "");
}

function onBeforeInput(event) {
  if (!event.data) return;
  if (/^[\d:.]+$/.test(event.data)) return;
  event.preventDefault();
}

function onInput(event) {
  const nextValue = sanitizeValue(event.target.value);
  if (nextValue !== event.target.value) {
    event.target.value = nextValue;
  }
  localValue.value = nextValue;
  emit("update:modelValue", nextValue);
}

function onFocus() {
  isFocused.value = true;
  emit("update:error", "");
}

function onBlur() {
  isFocused.value = false;
  commitValidation(localValue.value);
}

onMounted(() => {
  commitValidation(localValue.value);
});
</script>

<template>
  <input
    :value="localValue"
    class="ui-input py-2 tabular-nums rounded-lg text-center"
    :class="widthClass"
    type="text"
    inputmode="decimal"
    :placeholder="placeholder"
    @beforeinput="onBeforeInput"
    @input="onInput"
    @focus="onFocus"
    @blur="onBlur"
  />
</template>
