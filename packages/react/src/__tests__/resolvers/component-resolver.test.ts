// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { resolveComponent } from '../../resolvers/component-resolver';

describe('resolveComponent', () => {
  it('should return nulls if no fiber is found', () => {
    const el = document.createElement('div');
    const result = resolveComponent(el);
    expect(result).toEqual({ name: null, hostElement: null, stack: [] });
  });

  it('should resolve a simple component', () => {
    const el = document.createElement('div');

    // Create a mock fiber
    const mockFiber = {
      tag: 0, // FUNCTION_COMPONENT
      type: { name: 'MyComponent' },
      return: null,
      stateNode: el,
    };

    (el as any)['__reactFiber$12345'] = mockFiber;

    const result = resolveComponent(el);
    expect(result).toEqual({
      name: 'MyComponent',
      hostElement: el,
      stack: [
        { name: 'MyComponent', hostElement: el }
      ]
    });
  });

  it('should skip non-component fibers', () => {
    const childEl = document.createElement('span');
    const parentEl = document.createElement('div');

    // Child is just a host component (like <div>)
    const childFiber = {
      tag: 5, // HostComponent
      type: 'span',
      return: null, // will be linked below
      stateNode: childEl,
    };

    // Parent is a functional component
    const parentFiber = {
      tag: 0, // FUNCTION_COMPONENT
      type: { displayName: 'ParentComponent' },
      return: null,
      stateNode: parentEl,
    };

    childFiber.return = parentFiber as any;

    (childEl as any)['__reactFiber$12345'] = childFiber;

    const result = resolveComponent(childEl);
    expect(result).toEqual({
      name: 'ParentComponent',
      hostElement: parentEl,
      stack: [
        { name: 'ParentComponent', hostElement: parentEl }
      ]
    });
  });

  it('should collect a stack of components', () => {
    const leafEl = document.createElement('div');
    const midEl = document.createElement('div');
    const rootEl = document.createElement('div');

    const leafFiber = {
      tag: 0,
      type: { name: 'LeafComponent' },
      return: null as any,
      stateNode: leafEl,
    };

    const midFiber = {
      tag: 1, // CLASS_COMPONENT
      type: { name: 'MidComponent' },
      return: null as any,
      stateNode: midEl,
    };

    const rootFiber = {
      tag: 0,
      type: { displayName: 'RootComponent' },
      return: null as any,
      stateNode: rootEl,
    };

    leafFiber.return = midFiber;
    midFiber.return = rootFiber;

    (leafEl as any)['__reactInternalInstance$xyz'] = leafFiber;

    const result = resolveComponent(leafEl);
    expect(result).toEqual({
      name: 'LeafComponent',
      hostElement: leafEl,
      stack: [
        { name: 'LeafComponent', hostElement: leafEl },
        { name: 'MidComponent', hostElement: midEl },
        { name: 'RootComponent', hostElement: rootEl }
      ]
    });
  });

  it('should find host element by traversing returns if stateNode is null', () => {
    const el = document.createElement('div');

    const parentHostFiber = {
      tag: 5, // Host component
      type: 'div',
      return: null,
      stateNode: el,
    };

    const childFiber = {
      tag: 0, // FUNCTION_COMPONENT
      type: { name: 'FragmentChild' },
      return: parentHostFiber as any,
      stateNode: null, // like a Fragment or Context provider
    };

    (el as any)['__reactFiber$abc'] = childFiber;

    const result = resolveComponent(el);
    expect(result).toEqual({
      name: 'FragmentChild',
      hostElement: el, // should find the parentHostFiber's stateNode
      stack: [
        { name: 'FragmentChild', hostElement: el }
      ]
    });
  });

  it('should prevent infinite loops with cyclic fibers', () => {
    const el = document.createElement('div');

    const fiberA: any = {
      tag: 0,
      type: { name: 'ComponentA' },
      stateNode: el,
    };

    const fiberB: any = {
      tag: 0,
      type: { name: 'ComponentB' },
      stateNode: el,
    };

    fiberA.return = fiberB;
    fiberB.return = fiberA; // cycle!

    (el as any)['__reactFiber$123'] = fiberA;

    const result = resolveComponent(el);
    expect(result.stack.length).toBe(2);
    expect(result.name).toBe('ComponentA');
  });

  it('should handle fiber with string type (host component) correctly when searching component name', () => {
    const el = document.createElement('div');

    // This simulates a host component pretending to be a function/class component due to some bug/edge case,
    // or just checking `getComponentName` behavior.
    const fiber = {
      tag: 0,
      type: 'div',
      return: null,
      stateNode: el,
    };

    (el as any)['__reactFiber$123'] = fiber;

    const result = resolveComponent(el);
    // Since getComponentName returns null for string types, it won't be pushed to the stack
    expect(result).toEqual({ name: null, hostElement: null, stack: [] });
  });

});
