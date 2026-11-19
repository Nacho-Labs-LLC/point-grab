<script setup>
defineProps({ item: Object });
defineEmits(['remove']);
</script>
<template>
  <div class="cart-item" data-testid="cart-item">
    <div class="cart-item-swatch" :style="{ background: item.swatch }" />
    <div class="cart-item-details"><span class="cart-item-name">{{ item.name }}</span><span class="cart-item-meta">{{ item.color }} · {{ item.size }}<template v-if="item.monogram"> · {{ item.monogram }}</template></span></div>
    <span class="cart-item-price">{{ item.price }}</span>
    <button class="remove-item" :aria-label="`Remove ${item.name}`" @click="$emit('remove', item.id)">×</button>
  </div>
</template>
