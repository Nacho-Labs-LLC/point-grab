interface VueComponentInstance {
  type: {
    __name?: string;
    name?: string;
    __file?: string;
  };
  parent: VueComponentInstance | null;
  vnode: {
    el: Element | null;
  };
}

interface ComponentResult {
  name: string | null;
  hostElement: Element | null;
  stack: Array<{ name: string; hostElement: Element | null }>;
}

function getVueInstance(element: Element): VueComponentInstance | null {
  // Vue 3: __vueParentComponent is set on the host element
  const vueParent = (element as Record<string, unknown>).__vueParentComponent as
    VueComponentInstance | undefined;
  if (vueParent) return vueParent;

  // Vue 3 alternative: vnode.component
  const vnode = (element as Record<string, unknown>).__vnode as
    { component?: VueComponentInstance } | undefined;
  if (vnode?.component) return vnode.component;

  // Vue 3: walk up until we find an element with a component reference
  const vnodeDirect = (element as Record<string, unknown>)._vnode as
    { component?: VueComponentInstance } | undefined;
  if (vnodeDirect?.component) return vnodeDirect.component;

  return null;
}

function getComponentName(instance: VueComponentInstance): string | null {
  const type = instance.type;
  if (!type) return null;

  if (type.__name) return type.__name;
  if (type.name) return type.name;

  // Derive name from __file path as a last resort
  if (type.__file) {
    const match = type.__file.match(/([^/\\]+)\.vue$/);
    if (match) return match[1];
  }

  return null;
}

function getHostElement(instance: VueComponentInstance): Element | null {
  return instance.vnode?.el ?? null;
}

export function resolveComponent(element: Element): ComponentResult {
  const stack: Array<{ name: string; hostElement: Element | null }> = [];
  const seen = new Set<VueComponentInstance>();

  // Try to find a Vue instance on this element
  let instance = getVueInstance(element);

  // If none found, walk up the DOM
  if (!instance) {
    let current: Element | null = element.parentElement;
    while (current) {
      instance = getVueInstance(current);
      if (instance) break;
      current = current.parentElement;
    }
  }

  if (!instance) return { name: null, hostElement: null, stack: [] };

  // Walk the Vue parent chain building the component stack
  let current: VueComponentInstance | null = instance;
  while (current) {
    if (!seen.has(current)) {
      seen.add(current);
      const name = getComponentName(current);
      if (name) {
        stack.push({
          name,
          hostElement: getHostElement(current),
        });
      }
    }
    current = current.parent;
  }

  const closest = stack.length > 0 ? stack[0] : { name: null, hostElement: null };

  return {
    name: closest.name,
    hostElement: closest.hostElement,
    stack,
  };
}
