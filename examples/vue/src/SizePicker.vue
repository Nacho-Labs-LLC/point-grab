<script setup>
defineProps({ sizes: Array, modelValue: String });
defineEmits(['update:modelValue']);
</script>
<template>
  <div class="option-group">
    <div class="option-label">
      Size
      <span v-if="modelValue" class="option-value">{{ modelValue }}</span>
    </div>
    <div class="size-options">
      <button
        v-for="size in sizes"
        :key="size"
        :class="['size-btn', { 'size-active': modelValue === size }]"
        :aria-pressed="modelValue === size"
        @click="$emit('update:modelValue', size)"
      >{{ size }}</button>
    </div>
  </div>
</template>
