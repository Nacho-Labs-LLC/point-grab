interface ComponentResult {
  name: string | null;
  hostElement: Element | null;
  stack: Array<{ name: string; hostElement: Element | null }>;
}

function isCustomElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  // Custom elements must contain a hyphen
  if (!tagName.includes('-')) return false;
  return customElements.get(tagName) !== undefined;
}

function getComponentName(element: Element): string {
  const tagName = element.tagName.toLowerCase();

  // Prefer the class name if it's meaningful
  const className = element.constructor?.name;
  if (className && className !== 'HTMLElement' && className !== 'HTMLUnknownElement') {
    return className;
  }

  return tagName;
}

function getShadowHost(element: Element): Element | null {
  const root = element.getRootNode();
  if (root instanceof ShadowRoot) {
    return root.host;
  }
  return null;
}

export function resolveComponent(element: Element): ComponentResult {
  const stack: Array<{ name: string; hostElement: Element | null }> = [];
  const seen = new Set<Element>();

  // Start at the element, walk through shadow DOM boundaries and DOM tree
  let current: Element | null = element;

  while (current) {
    if (seen.has(current)) break;
    seen.add(current);

    if (isCustomElement(current)) {
      stack.push({
        name: getComponentName(current),
        hostElement: current,
      });
    }

    // Check if we're inside a shadow root -- walk to the host
    const shadowHost = getShadowHost(current);
    if (shadowHost) {
      current = shadowHost;
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
