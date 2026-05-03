/**
 * Finds the deepest element at a point, piercing through shadow DOM boundaries.
 * The native `document.elementFromPoint` stops at shadow roots.
 */
export function deepElementFromPoint(x: number, y: number): Element | null {
  let element = document.elementFromPoint(x, y);
  if (!element) return null;

  // Keep drilling into shadow roots
  while (element.shadowRoot) {
    const deeper = element.shadowRoot.elementFromPoint(x, y);
    if (!deeper || deeper === element) break;
    element = deeper;
  }

  return element;
}

/**
 * Walks up from an element collecting every shadow root boundary.
 * Returns an array of shadow host elements from innermost to outermost.
 */
export function getShadowRootChain(element: Element): Element[] {
  const chain: Element[] = [];
  let current: Node = element;

  while (current) {
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      chain.push(root.host);
      current = root.host;
    } else {
      break;
    }
  }

  return chain;
}

/**
 * Serializes an element's shadow tree as a string representation.
 * Includes the shadow root's innerHTML nested within the host's
 * opening tag for a complete view of the component.
 */
export function serializeShadowTree(element: Element, maxDepth = 3): string {
  return serializeNode(element, 0, maxDepth);
}

function serializeNode(element: Element, depth: number, maxDepth: number): string {
  if (depth >= maxDepth) return `<${element.tagName.toLowerCase()}>...</${element.tagName.toLowerCase()}>`;

  const tag = element.tagName.toLowerCase();
  const attrs = serializeAttributes(element);
  const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;

  const parts: string[] = [openTag];
  const indent = '  '.repeat(depth + 1);

  // If the element has a shadow root, serialize its content
  if (element.shadowRoot) {
    parts.push(`${indent}#shadow-root`);
    const children = Array.from(element.shadowRoot.children);
    for (const child of children) {
      if (child instanceof Element) {
        parts.push(indent + serializeNode(child, depth + 1, maxDepth));
      }
    }
  }

  // Serialize light DOM children
  const lightChildren = Array.from(element.children);
  for (const child of lightChildren) {
    if (child instanceof Element) {
      parts.push(indent + serializeNode(child, depth + 1, maxDepth));
    }
  }

  parts.push(`</${tag}>`);
  return parts.join('\n');
}

function serializeAttributes(element: Element): string {
  const attrs: string[] = [];
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    if (attr.value) {
      attrs.push(`${attr.name}="${attr.value}"`);
    } else {
      attrs.push(attr.name);
    }
  }
  return attrs.join(' ');
}
