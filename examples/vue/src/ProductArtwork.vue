<script setup>
defineProps({ color: String, name: String, monogram: String });
</script>
<template>
  <div class="product-image" :style="{ background: color }" role="img" :aria-label="`${name || 'Unselected'} Novo Crewneck illustration`">
    <span class="art-edition">KRATE / ESSENTIALS — 001</span>
    <svg class="crewneck-art" data-testid="motion-sample" width="300" height="300" viewBox="0 0 300 300" aria-hidden="true"><path d="M95 70 65 87 25 155 65 180 87 145 80 245 220 245 213 145 235 180 275 155 235 87 205 70 180 62Q150 85 120 62Z" fill="currentColor" stroke="#ffffff50" stroke-width="2"/><path d="M120 62Q150 112 180 62M90 225H210M100 85 88 140M200 85 212 140" fill="none" stroke="#ffffff60" stroke-width="3"/><text x="150" y="150" text-anchor="middle" fill="#ffffffa0" font-size="12" letter-spacing="3">KRATE</text><text v-if="monogram" data-testid="artwork-monogram" x="182" y="118" text-anchor="middle" fill="#ffffffd0" font-size="14" font-weight="700" letter-spacing="2">{{ monogram }}</text></svg>
    <span class="image-color-label">{{ name || 'Choose your color' }}</span>
  </div>
</template>
<style scoped>
.product-image { position: relative; display: grid; place-items: center; overflow: hidden; }
.crewneck-art { width: 90%; height: auto; color: #7c8585; animation: garment-float 5s ease-in-out infinite; }
.art-edition { position: absolute; top: 22px; left: 22px; font-size: 10px; letter-spacing: .15em; color: #fff; background: #161921; padding: 5px 9px; border-radius: 4px; }
@keyframes garment-float { 50% { transform: translateY(-7px) rotate(2deg); } }
@media (prefers-reduced-motion: reduce) { .crewneck-art { animation: none; } }
</style>
