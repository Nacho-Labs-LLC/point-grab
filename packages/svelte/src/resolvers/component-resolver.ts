interface SvelteMeta {
  loc?: {
    file?: string;
    line?: number;
    column?: number;
    char?: number;
  };
  type?: string;
  name?: string;
}

interface SvelteComponent {
  constructor: { name: string };
  $$?: {
    ctx?: unknown[];
  };
}

interface ComponentResult {
  name: string | null;
  hostElement: Element | null;
  stack: Array<{ name: string; hostElement: Element | null }>;
}

function getSvelte5Meta(element: Element): SvelteMeta | null {
  return (element as unknown as Record<string, unknown>).__svelte_meta as SvelteMeta | undefined ?? null;
}

function getSvelte4Component(element: Element): SvelteComponent | null {
  return (element as unknown as Record<string, unknown>).__svelte_component as
    SvelteComponent | undefined ?? null;
}

function getComponentNameFromMeta(meta: SvelteMeta): string | null {
  if (meta.name) return meta.name;

  // Derive from file path
  if (meta.loc?.file) {
    const match = meta.loc.file.match(/([^/\\]+)\.svelte$/);
    if (match) return match[1];
  }

  return null;
}

function getComponentNameFromInstance(component: SvelteComponent): string | null {
  const name = component.constructor?.name;
  if (!name || name === 'Object') return null;
  return name;
}

export function resolveComponent(element: Element): ComponentResult {
  const stack: Array<{ name: string; hostElement: Element | null }> = [];
  const seen = new Set<Element>();

  let current: Element | null = element;
  while (current) {
    if (seen.has(current)) {
      current = current.parentElement;
      continue;
    }
    seen.add(current);

    // Svelte 5 (runes): check __svelte_meta
    const meta = getSvelte5Meta(current);
    if (meta) {
      const name = getComponentNameFromMeta(meta);
      if (name) {
        stack.push({ name, hostElement: current });
      }
      current = current.parentElement;
      continue;
    }

    // Svelte 4: check __svelte_component
    const component = getSvelte4Component(current);
    if (component) {
      const name = getComponentNameFromInstance(component);
      if (name) {
        stack.push({ name, hostElement: current });
      }
      current = current.parentElement;
      continue;
    }

    current = current.parentElement;
  }

  const closest = stack.length > 0 ? stack[0] : { name: null, hostElement: null };

  return {
    name: closest.name,
    hostElement: closest.hostElement,
    stack,
  };
}
