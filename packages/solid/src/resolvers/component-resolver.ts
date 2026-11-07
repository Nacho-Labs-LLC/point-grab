interface ComponentEntry {
  name: string;
  hostElement: Element | null;
}

interface ComponentResult {
  name: string | null;
  hostElement: Element | null;
  stack: ComponentEntry[];
}

const COMPONENT_ATTRIBUTE = "data-point-grab-component";

function getComponentName(element: Element): string | null {
  return element.getAttribute(COMPONENT_ATTRIBUTE);
}

export function resolveComponent(element: Element): ComponentResult {
  const stack: ComponentEntry[] = [];
  const seen = new Set<Element>();

  let current: Element | null = element;
  while (current) {
    if (!seen.has(current)) {
      seen.add(current);
      const name = getComponentName(current);
      if (name) {
        const previous = stack.at(-1);
        if (previous?.name === name) {
          previous.hostElement = current;
        } else {
          stack.push({ name, hostElement: current });
        }
      }
    }
    current = current.parentElement;
  }

  const closest = stack[0] ?? { name: null, hostElement: null };
  return { name: closest.name, hostElement: closest.hostElement, stack };
}
