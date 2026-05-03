import type { PointGrabOptions, ToolbarState } from './types';

export interface PointGrabState {
  active: boolean;
  frozen: boolean;
  hoveredElement: Element | null;
  options: PointGrabOptions;
  toolbar: ToolbarState;
}

export type StateListener = (state: PointGrabState, key: keyof PointGrabState) => void;

export interface Store {
  state: PointGrabState;
  subscribe(listener: StateListener): () => void;
}

export function createStore(initialOptions: PointGrabOptions): Store {
  const listeners = new Set<StateListener>();

  const raw: PointGrabState = {
    active: false,
    frozen: false,
    hoveredElement: null,
    options: initialOptions,
    toolbar: {
      visible: initialOptions.showToolbar,
      themeMode: initialOptions.themeMode,
      history: [],
      pendingAction: null,
    },
  };

  const state = new Proxy(raw, {
    set(target, prop, value) {
      const key = prop as keyof PointGrabState;
      if (target[key] === value) return true;

      Reflect.set(target, key, value);
      listeners.forEach((fn) => fn(state, key));
      return true;
    },
  });

  return {
    state,
    subscribe(listener: StateListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
