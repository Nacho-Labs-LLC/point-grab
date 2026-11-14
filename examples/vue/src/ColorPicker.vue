<script setup>
defineProps({ colors: Array, modelValue: Object });
defineEmits(['update:modelValue']);
</script>
<template>
  <div class="option-group">
    <div class="option-label">
      Color
      <span v-if="modelValue" class="option-value">{{ modelValue.name }}</span>
    </div>
    <div class="color-swatches">
      <button
        v-for="color in colors"
        :key="color.value"
        :class="['color-swatch', { 'swatch-active': modelValue?.value === color.value }]"
        :style="{ background: color.value }"
        :aria-label="color.name"
        :aria-pressed="modelValue?.value === color.value"
        @click="$emit('update:modelValue', color)"
      />
    </div>
  </div>
</template>
