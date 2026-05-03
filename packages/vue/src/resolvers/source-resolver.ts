interface VueComponentInstance {
  type: {
    __name?: string;
    name?: string;
    __file?: string;
  };
  parent: VueComponentInstance | null;
}

interface SourceResult {
  filePath: string | null;
  line: number | null;
  column: number | null;
}

function getVueInstance(element: Element): VueComponentInstance | null {
  const vueParent = (element as Record<string, unknown>).__vueParentComponent as
    VueComponentInstance | undefined;
  if (vueParent) return vueParent;

  const vnode = (element as Record<string, unknown>).__vnode as
    { component?: VueComponentInstance } | undefined;
  if (vnode?.component) return vnode.component;

  const vnodeDirect = (element as Record<string, unknown>)._vnode as
    { component?: VueComponentInstance } | undefined;
  if (vnodeDirect?.component) return vnodeDirect.component;

  return null;
}

export function resolveSource(element: Element): SourceResult {
  let instance = getVueInstance(element);

  // Walk up DOM if no instance on this element
  if (!instance) {
    let current: Element | null = element.parentElement;
    while (current) {
      instance = getVueInstance(current);
      if (instance) break;
      current = current.parentElement;
    }
  }

  if (!instance) return { filePath: null, line: null, column: null };

  // Vue dev mode exposes __file on the component type
  const file = instance.type?.__file ?? null;
  if (!file) return { filePath: null, line: null, column: null };

  // Vue does not provide line/column info at runtime by default
  return { filePath: file, line: null, column: null };
}
