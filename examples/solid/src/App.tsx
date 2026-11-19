import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { Accessor } from "solid-js";
import "./styles.css";

interface Product {
  id: string;
  name: string;
  detail: string;
  category: string;
  price: number;
  color: string;
  badge: string;
}
const products: Product[] = [
  {
    id: "lamp",
    name: "Arc lamp",
    detail: "A softer kind of spotlight.",
    category: "Lighting",
    price: 89,
    color: "peach",
    badge: "Bestseller",
  },
  {
    id: "vase",
    name: "Pebble vase",
    detail: "A little room for the wild.",
    category: "Ceramics",
    price: 42,
    color: "lilac",
    badge: "Small batch",
  },
  {
    id: "tote",
    name: "Everyday tote",
    detail: "For wherever the day goes.",
    category: "Essentials",
    price: 28,
    color: "sage",
    badge: "Made to last",
  },
];
const money = (value: number) => `$${value}`;

function ProductArtwork(props: { product: Product }) {
  return (
    <div
      class={`product-art ${props.product.color}`}
      role="img"
      aria-label={`${props.product.name} illustration`}
    >
      <span class="art-grid" />
      <div class={`object object-${props.product.id}`}>
        <i />
        <b />
        <span />
      </div>
      <span class="art-caption">
        FORM / FIELD — No. 0{products.indexOf(props.product) + 1}
      </span>
    </div>
  );
}

function ProductCard(props: {
  product: Product;
  saved: boolean;
  onSave: () => void;
  onAdd: () => void;
}) {
  return (
    <article class="product-card" data-testid="product-card">
      <div class="art-wrap">
        <ProductArtwork product={props.product} />
        <button class="product-badge detail-trigger" type="button" data-testid="freeze-trigger" aria-describedby={`detail-${props.product.id}`}>
          {props.product.badge}
          <span class="product-detail" id={`detail-${props.product.id}`} role="tooltip" data-testid="freeze-popover">
            {props.product.detail}
          </span>
        </button>
        <button
          class="save-button"
          type="button"
          aria-label={`Save ${props.product.name}`}
          aria-pressed={props.saved}
          onClick={props.onSave}
        >
          {props.saved ? "♥" : "♡"}
        </button>
      </div>
      <div class="product-meta">
        <span>{props.product.category}</span>
        <span>{money(props.product.price)}</span>
      </div>
      <h3>{props.product.name}</h3>
      <p>{props.product.detail}</p>
      <button
        class="add-button"
        type="button"
        aria-label={`Add ${props.product.name} to bag`}
        onClick={props.onAdd}
      >
        Add to bag <span aria-hidden="true">↗</span>
      </button>
    </article>
  );
}

function BagPanel(props: {
  quantities: Accessor<Record<string, number>>;
  onChange: (id: string, delta: number) => void;
  onClear: () => void;
}) {
  const items = createMemo(() =>
    products.filter((product) => (props.quantities()[product.id] ?? 0) > 0),
  );
  const count = createMemo(() =>
    Object.values(props.quantities()).reduce(
      (sum, quantity) => sum + quantity,
      0,
    ),
  );
  const total = createMemo(() =>
    items().reduce(
      (sum, product) => sum + product.price * props.quantities()[product.id],
      0,
    ),
  );
  return (
    <aside class="bag-panel" aria-label="Shopping bag">
      <div class="bag-heading">
        <h2>Your bag</h2>
        <span class="count-pill" data-testid="bag-count" aria-live="polite">
          {count()}
        </span>
      </div>
      <Show
        when={items().length > 0}
        fallback={
          <div class="empty-bag">
            <span aria-hidden="true">⌑</span>
            <p>Your bag is a blank canvas.</p>
            <small>Find something that feels like you.</small>
          </div>
        }
      >
        <ul class="bag-items">
          <For each={items()}>
            {(product) => (
              <li>
                <div>
                  <strong>{product.name}</strong>
                  <small>{money(product.price)} each</small>
                </div>
                <div class="quantity-control">
                  <button
                    type="button"
                    aria-label={`Decrease ${product.name} quantity`}
                    onClick={() => props.onChange(product.id, -1)}
                  >
                    −
                  </button>
                  <span aria-label={`${product.name} quantity`}>
                    {props.quantities()[product.id]}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${product.name} quantity`}
                    onClick={() => props.onChange(product.id, 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            )}
          </For>
        </ul>
        <div class="subtotal">
          <span>Subtotal</span>
          <strong data-testid="bag-total" aria-live="polite">
            {money(total())}
          </strong>
        </div>
        <button class="clear-button" type="button" onClick={props.onClear}>
          Clear bag
        </button>
      </Show>
      <label class="gift-note">
        Make it personal
        <textarea
          aria-label="Gift note"
          placeholder="A note for someone special…"
          rows={3}
        />
      </label>
      <p class="demo-disclaimer">Just a playground. No checkout, no charge.</p>
      <div class="solid-note">
        <span class="status-dot" />
        Fine-grained by design
        <small>
          Signals + For + Show. Real Solid components, not a static mockup.
        </small>
      </div>
    </aside>
  );
}

/** Is Send's destination (the local MCP server) reachable? */
function McpStatus() {
  const [state, setState] = createSignal<"checking" | "online" | "offline">("checking");
  const check = async () => {
    try {
      const res = await fetch("http://localhost:3456/health", { signal: AbortSignal.timeout(1500) });
      setState(res.ok ? "online" : "offline");
    } catch {
      setState("offline");
    }
  };
  onMount(() => {
    void check();
    const timer = setInterval(check, 10000);
    window.addEventListener("focus", check);
    onCleanup(() => { clearInterval(timer); window.removeEventListener("focus", check); });
  });
  return (
    <span class="mcp-status" data-testid="mcp-status" role="status" data-state={state()}>
      <Show when={state() !== "checking"} fallback="Checking MCP server…">
        <Show when={state() === "online"} fallback={<>MCP server offline · run <code>npx @point-grab/mcp-server</code> to Send</>}>
          MCP server connected
        </Show>
      </Show>
    </span>
  );
}

function GrabGuide() {
  return (
    <section class="grab-guide" data-testid="playground-guide" aria-labelledby="guide-heading">
      <div>
        <span class="eyebrow">SOLID PLAYGROUND</span>
        <h2 id="guide-heading">Try Point Grab on this storefront.</h2>
        <McpStatus />
      </div>
      <ol>
        <li><span>01</span><strong>Grab</strong><p>Hold <kbd>Ctrl+B</kbd>, hover a product card or a bag item and click. Your clipboard gets its HTML plus the Solid component and source file.</p></li>
        <li><span>02</span><strong>Comment</strong><p>Toolbar <kbd>⋯</kbd> → Add Comment, click an element, write a note. Queue a few, then Confirm &amp; Copy.</p></li>
        <li><span>03</span><strong>Freeze</strong><p>Hover a product badge like <em>Bestseller</em>, hold <kbd>Ctrl+B</kbd> and press <kbd>F</kbd>. The detail and the spark hold still. <kbd>Esc</kbd> resumes.</p></li>
        <li><span>04</span><strong>Screenshot</strong><p><kbd>⋯</kbd> → Add screenshot, drag over the collection, add a note and Send it to your AI.</p></li>
        <li><span>05</span><strong>History</strong><p>The clock button lists every grab. Click one to copy it again.</p></li>
      </ol>
    </section>
  );
}

export default function App() {
  const [query, setQuery] = createSignal("");
  const [category, setCategory] = createSignal("All objects");
  const [savedOnly, setSavedOnly] = createSignal(false);
  const [saved, setSaved] = createSignal<string[]>([]);
  const [quantities, setQuantities] = createSignal<Record<string, number>>({});
  const visibleProducts = createMemo(() =>
    products.filter(
      (product) =>
        (category() === "All objects" || product.category === category()) &&
        (!savedOnly() || saved().includes(product.id)) &&
        `${product.name} ${product.detail}`
          .toLowerCase()
          .includes(query().toLowerCase()),
    ),
  );
  const changeQuantity = (id: string, delta: number) =>
    setQuantities((previous) => ({
      ...previous,
      [id]: Math.max(0, (previous[id] ?? 0) + delta),
    }));
  const resetFilters = () => {
    setQuery("");
    setCategory("All objects");
    setSavedOnly(false);
  };
  return (
    <div class="storefront">
      <header class="site-header">
        <a href="#" class="wordmark" aria-label="Form and Field home">
          form<span>/</span>field<span class="brand-dot">®</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#collection">The collection</a>
          <a href="#guide-heading">Try Point Grab ↗</a>
        </nav>
        <span class="live-label">
          <span class="status-dot" />
          SOLID PLAYGROUND
        </span>
      </header>
      <main>
        <section class="hero">
          <div>
            <div class="eyebrow">
              <span class="tiny-spark" data-testid="motion-sample" aria-hidden="true">✳</span> LESS, BUT A LITTLE LOVELIER
            </div>
            <h1>
              Objects for
              <br />
              everyday rituals.
            </h1>
            <p>
              Thoughtful shapes. Useful things. A small collection
              <br class="desktop-break" /> for the spaces and moments you call
              your own.
            </p>
          </div>
          <div class="hero-stamp">
            <span>CURATED WITH CARE</span>
            <strong>
              Make room
              <br />
              for good things.
            </strong>
            <span>COLLECTION / 001</span>
          </div>
        </section>
        <section
          class="collection"
          id="collection"
          aria-label="Object collection"
        >
          <div class="collection-heading">
            <h2>
              The everyday edit <sup>03</sup>
            </h2>
            <label class="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search objects"
                type="search"
                placeholder="Find your next favorite"
                value={query()}
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
            </label>
          </div>
          <div class="collection-layout">
            <div>
              <div class="filters" aria-label="Filter collection">
                <div class="category-tabs">
                  <For
                    each={["All objects", "Lighting", "Ceramics", "Essentials"]}
                  >
                    {(name) => (
                      <button
                        type="button"
                        aria-pressed={category() === name}
                        onClick={() => setCategory(name)}
                      >
                        {name}
                      </button>
                    )}
                  </For>
                </div>
                <button
                  class="saved-filter"
                  type="button"
                  aria-pressed={savedOnly()}
                  onClick={() => setSavedOnly((value) => !value)}
                >
                  ♡ Saved only
                </button>
              </div>
              <div class="product-grid">
                <For each={visibleProducts()}>
                  {(product) => (
                    <ProductCard
                      product={product}
                      saved={saved().includes(product.id)}
                      onSave={() =>
                        setSaved((previous) =>
                          previous.includes(product.id)
                            ? previous.filter((id) => id !== product.id)
                            : [...previous, product.id],
                        )
                      }
                      onAdd={() => changeQuantity(product.id, 1)}
                    />
                  )}
                </For>
              </div>
              <Show when={visibleProducts().length === 0}>
                <div class="no-results">
                  <h3>No objects found.</h3>
                  <p>Try a different search or start fresh.</p>
                  <button type="button" onClick={resetFilters}>
                    Reset filters
                  </button>
                </div>
              </Show>
              <div class="collection-footnote">
                <span>Considered objects. Uncomplicated living.</span>
                <span>Designed to be used, every day. ↗</span>
              </div>
            </div>
            <BagPanel
              quantities={quantities}
              onChange={changeQuantity}
              onClear={() => setQuantities({})}
            />
          </div>
        </section>
        <GrabGuide />
      </main>
      <footer>
        <span>form / field</span>
        <span>
          A SolidJS playground for Point Grab · No purchases, just
          possibilities.
        </span>
        <a href="https://point-grab.com">point-grab.com ↗</a>
      </footer>
    </div>
  );
}
