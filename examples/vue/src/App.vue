<script setup>
import { ref, computed, inject, onMounted, onBeforeUnmount } from 'vue';

const colors = [
  { name: 'Black',  value: '#1a1a1a' },
  { name: 'Cream',  value: '#f5f0e8' },
  { name: 'Forest', value: '#2d4a3e' },
];

const sizes = ['S', 'M', 'L', 'XL'];

const selectedColor = ref(null);
const selectedSize  = ref(null);
const cartCount     = ref(0);
const cartOpen      = ref(false);
const cartItems     = ref([]);
const cartBumping   = ref(false);
const btnShaking    = ref(false);

const productImageBg = computed(() =>
  selectedColor.value ? selectedColor.value.value : '#1e2130'
);

function selectColor(color) {
  selectedColor.value = color;
}

function selectSize(size) {
  selectedSize.value = size;
}

function addToCart() {
  if (!selectedColor.value || !selectedSize.value) {
    btnShaking.value = true;
    setTimeout(() => { btnShaking.value = false; }, 300);
    return;
  }

  cartItems.value.push({
    id: Date.now(),
    name: 'Novo Crewneck',
    color: selectedColor.value.name,
    size: selectedSize.value,
    price: '$68.00',
  });

  cartCount.value += 1;

  cartBumping.value = true;
  setTimeout(() => { cartBumping.value = false; }, 400);

  cartOpen.value = true;
}

function openCart() {
  cartOpen.value = true;
}

function closeCart() {
  cartOpen.value = false;
}

const pointGrab = inject('$point-grab');
const walkthroughStep = ref(1);
const annotations = ref([]);
const walkthroughComplete = ref(false);
const promptPreview = computed(() => annotations.value.length
  ? annotations.value.map(({ snippet, comment }, index) => `## Element ${index + 1}\n${snippet}\n\nComment: ${comment}`).join('\n\n---\n\n')
  : 'Your accepted review comments will appear here exactly as Point-grab writes them to the clipboard.');

pointGrab?.registerPlugin({
  name: 'vue-walkthrough-preview',
  hooks: {
    onCopySuccess(snippet, _context, comment) {
      if (!comment || annotations.value.some((item) => item.snippet === snippet && item.comment === comment)) return;
      annotations.value.push({ snippet, comment });
      walkthroughStep.value = annotations.value.length === 1 ? 2 : 3;
    },
  },
});

const handleCaptureSession = (event) => {
  const { action, annotationCount } = event.detail || {};

  if (action === 'accepted') {
    walkthroughStep.value = annotationCount === 1 ? 2 : 3;
    // The cart item was created before the session began; reveal that real reactive
    // state as the next walkthrough target once the CTA review is accepted.
    if (annotationCount === 1) openCart();
  } else if (action === 'skipped' && walkthroughStep.value === 2) {
    walkthroughStep.value = 3;
  } else if (action === 'ended') {
    walkthroughComplete.value = annotations.value.length > 0;
  }
};

onMounted(() => {
  window.addEventListener('point-grab:capture-session', handleCaptureSession);
});

onBeforeUnmount(() => {
  pointGrab?.unregisterPlugin('vue-walkthrough-preview');
  window.removeEventListener('point-grab:capture-session', handleCaptureSession);
});

function starFill(index) {
  const rating = 4.8;
  if (index < Math.floor(rating)) return 'full';
  if (index < rating) return 'partial';
  return 'empty';
}
</script>

<template>
  <header class="krate-header">
    <span class="krate-logo">Krate</span>
    <button class="cart-icon-btn" @click="openCart" aria-label="Open cart">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
      <span :class="['cart-badge', { bumping: cartBumping }]" v-if="cartCount > 0">{{ cartCount }}</span>
    </button>
  </header>

  <main class="page-main">
    <section class="walkthrough" aria-label="Point-grab capture walkthrough">
      <span>Step {{ walkthroughStep }} of 3</span>
      <strong>{{ walkthroughStep === 1 ? 'Capture the Add to Cart action' : walkthroughStep === 2 ? 'Skip the reactive cart total, then capture it' : 'End Capture Mode to finish your review' }}</strong>
      <p>Start Capture Mode with Cmd+Shift+C / Ctrl+Shift+C or click the subtle Capture mode control below.</p>
      <pre data-testid="prompt-preview">{{ promptPreview }}</pre>
      <div v-if="walkthroughComplete" class="walkthrough-complete" data-testid="walkthrough-complete">
        {{ annotations.length }} reviewed elements + comments are ready for your AI agent.
      </div>
    </section>
    <nav class="breadcrumb">
      <span>Shop</span>
      <span class="breadcrumb-sep">/</span>
      <span>Tops</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-current">Novo Crewneck</span>
    </nav>

    <div class="product-layout">
      <div
        class="product-image"
        :style="{ background: productImageBg }"
      >
        <span v-if="selectedColor" class="image-color-label">{{ selectedColor.name }}</span>
      </div>

      <div class="product-info">
        <h1 class="product-name">Novo Crewneck</h1>

        <div class="product-price">$68</div>

        <div class="rating">
          <span class="stars">
            <svg
              v-for="i in 5"
              :key="i"
              class="star"
              :class="starFill(i - 1)"
              width="14" height="14" viewBox="0 0 24 24"
            >
              <polygon
                points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                :fill="starFill(i - 1) !== 'empty' ? '#f59e0b' : 'none'"
                stroke="#f59e0b"
                stroke-width="1.5"
              />
            </svg>
          </span>
          <span class="rating-score">4.8</span>
          <span class="rating-count">214 reviews</span>
        </div>

        <p class="product-description">
          Heavyweight 400gsm French terry. Slightly oversized. Pre-shrunk.
        </p>

        <div class="option-group">
          <div class="option-label">
            Color
            <span v-if="selectedColor" class="option-value">{{ selectedColor.name }}</span>
          </div>
          <div class="color-swatches">
            <button
              v-for="color in colors"
              :key="color.value"
              :class="['color-swatch', { 'swatch-active': selectedColor?.value === color.value }]"
              :style="{ background: color.value }"
              :aria-label="color.name"
              @click="selectColor(color)"
            />
          </div>
        </div>

        <div class="option-group">
          <div class="option-label">
            Size
            <span v-if="selectedSize" class="option-value">{{ selectedSize }}</span>
          </div>
          <div class="size-options">
            <button
              v-for="size in sizes"
              :key="size"
              :class="['size-btn', { 'size-active': selectedSize === size }]"
              @click="selectSize(size)"
            >{{ size }}</button>
          </div>
        </div>

        <button
          :class="['add-to-cart-btn', { shake: btnShaking, 'walkthrough-target': walkthroughStep === 1 }]"
          @click="addToCart"
        >
          Add to Cart
        </button>

        <div class="product-meta">
          <span class="meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            Free shipping over $100
          </span>
          <span class="meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Free 30-day returns
          </span>
        </div>
      </div>
    </div>
  </main>

  <div v-if="cartOpen" class="cart-overlay" @click="closeCart" />

  <div v-if="cartOpen" class="cart-drawer">
    <div class="cart-drawer-header">
      <span class="cart-drawer-title">Your Cart</span>
      <button class="cart-close" @click="closeCart" aria-label="Close cart">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="cart-body">
      <div v-if="cartItems.length === 0" class="cart-empty">
        Your cart is empty.
      </div>
      <div
        v-for="item in cartItems"
        :key="item.id"
        class="cart-item"
      >
        <div class="cart-item-swatch" :style="{ background: colors.find(c => c.name === item.color)?.value || '#1e2130' }" />
        <div class="cart-item-details">
          <span class="cart-item-name">{{ item.name }}</span>
          <span class="cart-item-meta">{{ item.color }} · {{ item.size }}</span>
        </div>
        <span class="cart-item-price">{{ item.price }}</span>
      </div>
    </div>

    <div v-if="cartItems.length > 0" class="cart-footer">
      <div class="cart-total">
        <span>Total</span>
        <span>${{ (cartItems.length * 68).toFixed(2) }}</span>
      </div>
      <button class="checkout-btn">Checkout</button>
    </div>
  </div>
</template>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:           #0d0f14;
  --bg-raised:    #161921;
  --bg-muted:     #1e2130;
  --border:       #2a2d3e;
  --text:         #c8ccd8;
  --text-heading: #eef0f8;
  --text-muted:   #7880a0;
  --text-faint:   #454868;
  --accent:       #7c8cf8;
  --accent-dim:   rgba(124, 140, 248, 0.12);
  --green:        #34d399;
  --red:          #f87171;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}

/* ── Header ── */
.krate-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  height: 56px;
  background: rgba(13, 15, 20, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.krate-logo {
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-heading);
}

.cart-icon-btn {
  position: relative;
  background: none;
  border: none;
  color: var(--text);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}
.cart-icon-btn:hover { color: var(--text-heading); }

.cart-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: var(--accent);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  transform-origin: center;
}

/* ── Main ── */
.page-main {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

/* ── Breadcrumb ── */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 1.75rem;
}
.breadcrumb-sep { color: var(--text-faint); }
.breadcrumb-current { color: var(--text); }

/* ── Product layout ── */
.product-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5rem;
  align-items: start;
}

@media (max-width: 600px) {
  .product-layout { grid-template-columns: 1fr; gap: 1.5rem; }
}

/* ── Product image ── */
.product-image {
  aspect-ratio: 4/5;
  border-radius: 16px;
  transition: background 0.35s ease;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 1.25rem;
  background: var(--bg-muted);
  position: relative;
  overflow: hidden;
}

.product-image::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, rgba(255,255,255,0.04) 0%, transparent 60%);
  pointer-events: none;
}

.image-color-label {
  position: relative;
  z-index: 1;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  background: rgba(0,0,0,0.3);
  padding: 3px 10px;
  border-radius: 999px;
  backdrop-filter: blur(4px);
}

/* ── Product info ── */
.product-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.product-name {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-heading);
  line-height: 1.2;
}

.product-price {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--text-heading);
}

/* ── Rating ── */
.rating {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stars {
  display: flex;
  gap: 2px;
}

.star { flex-shrink: 0; }

.rating-score {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-heading);
}

.rating-count {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* ── Description ── */
.product-description {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.7;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--border);
}

/* ── Options ── */
.option-group { display: flex; flex-direction: column; gap: 0.6rem; }

.option-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.option-value {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text);
}

/* ── Color swatches ── */
.color-swatches {
  display: flex;
  gap: 0.6rem;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  outline: 2px solid transparent;
  outline-offset: 2px;
  cursor: pointer;
  padding: 0;
  transition: outline-color 0.15s, transform 0.15s;
}
.color-swatch:hover { transform: scale(1.1); }
.swatch-active {
  outline-color: var(--accent);
}

/* ── Size buttons ── */
.size-options {
  display: flex;
  gap: 0.5rem;
}

.size-btn {
  min-width: 44px;
  height: 40px;
  padding: 0 0.75rem;
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.size-btn:hover {
  border-color: var(--text-muted);
  color: var(--text-heading);
}
.size-active {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Add to cart ── */
.add-to-cart-btn {
  width: 100%;
  height: 50px;
  background: var(--accent);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: filter 0.2s, transform 0.1s;
  margin-top: 0.25rem;
}
.add-to-cart-btn:hover { filter: brightness(1.12); }
.add-to-cart-btn:active { transform: scale(0.98); }

/* ── Product meta ── */
.product-meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.meta-item svg { color: var(--green); flex-shrink: 0; }

/* ── Cart overlay ── */
.cart-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  animation: fade-in 0.2s ease;
}

/* ── Cart drawer ── */
.cart-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 201;
  width: 360px;
  max-width: 90vw;
  background: var(--bg-raised);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  animation: slide-in 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.cart-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.cart-drawer-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-heading);
}

.cart-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.cart-close:hover { color: var(--text-heading); }

.cart-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cart-empty {
  color: var(--text-muted);
  font-size: 0.875rem;
  text-align: center;
  padding: 2rem 0;
}

.cart-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem;
  background: var(--bg-muted);
  border-radius: 10px;
  border: 1px solid var(--border);
}

.cart-item-swatch {
  width: 40px;
  height: 48px;
  border-radius: 6px;
  flex-shrink: 0;
}

.cart-item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.cart-item-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-heading);
}

.cart-item-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.cart-item-price {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-heading);
  flex-shrink: 0;
}

.cart-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  flex-shrink: 0;
}

.cart-total {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-heading);
}

.checkout-btn {
  width: 100%;
  height: 46px;
  background: var(--accent);
  border: none;
  border-radius: 9px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s;
}
.checkout-btn:hover { filter: brightness(1.12); }

/* ── Animations ── */
@keyframes badge-bump {
  0%   { transform: scale(1); }
  30%  { transform: scale(1.4); }
  70%  { transform: scale(0.9); }
  100% { transform: scale(1); }
}
.cart-badge.bumping { animation: badge-bump 0.4s ease; }

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-6px); }
  75%       { transform: translateX(6px); }
}
.add-to-cart-btn.shake { animation: shake 0.3s ease; }

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes slide-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}
.walkthrough {
  margin: 0 0 1.5rem;
  padding: 1rem;
  display: grid;
  gap: .45rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-raised);
}
.walkthrough > span { color: var(--accent); font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.walkthrough > strong { color: var(--text-heading); }
.walkthrough > p { color: var(--text-muted); font-size: .82rem; }
.walkthrough pre { max-height: 130px; overflow: auto; white-space: pre-wrap; padding: .7rem; border-radius: 8px; background: var(--bg); color: #b9c3ff; font-size: .7rem; line-height: 1.45; }
.walkthrough-complete { color: var(--green); font-size: .82rem; font-weight: 600; }
</style>
