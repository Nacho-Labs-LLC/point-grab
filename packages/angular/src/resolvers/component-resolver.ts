import { getNgApi, cleanComponentName } from './ng-utils';

interface ComponentResult {
  name: string | null;
  hostElement: Element | null;
  stack: Array<{ name: string; hostElement: Element | null }>;
}

export function resolveComponent(element: Element): ComponentResult {
  const ng = getNgApi();
  if (!ng) return { name: null, hostElement: null, stack: [] };

  const stack: Array<{ name: string; hostElement: Element | null }> = [];
  const seen = new Set<object>();

  // Walk up the DOM collecting every Angular component host
  let current: Element | null = element;
  while (current) {
    const comp = ng.getComponent(current);
    if (comp && typeof comp === 'object' && !seen.has(comp)) {
      seen.add(comp);
      stack.push({
        name: cleanComponentName(comp.constructor.name),
        hostElement: current,
      });
    }
    current = current.parentElement;
  }

  // If no direct component found, try getOwningComponent for the original element
  if (stack.length === 0) {
    let walk: Element | null = element;
    while (walk) {
      const owning = ng.getOwningComponent(walk);
      if (owning && typeof owning === 'object' && !seen.has(owning)) {
        seen.add(owning);

        // Find the host element for the owning component
        let host: Element | null = walk.parentElement;
        while (host) {
          if (ng.getComponent(host) === owning) break;
          host = host.parentElement;
        }

        stack.push({
          name: cleanComponentName(owning.constructor.name),
          hostElement: host ?? walk.parentElement,
        });

        // Continue walking from the host to collect parent components
        current = host?.parentElement ?? walk.parentElement?.parentElement ?? null;
        while (current) {
          const comp = ng.getComponent(current);
          if (comp && typeof comp === 'object' && !seen.has(comp)) {
            seen.add(comp);
            stack.push({
              name: cleanComponentName(comp.constructor.name),
              hostElement: current,
            });
          }
          current = current.parentElement;
        }
        break;
      }
      walk = walk.parentElement;
    }
  }

  const closest = stack.length > 0 ? stack[0] : { name: null, hostElement: null };

  return {
    name: closest.name,
    hostElement: closest.hostElement,
    stack,
  };
}
