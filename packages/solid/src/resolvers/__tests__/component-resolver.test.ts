// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resolveComponent } from '../component-resolver';

describe('resolveComponent', () => {
  it('returns the closest Solid component and its annotated DOM stack', () => {
    const app = document.createElement('main');
    app.dataset.pointGrabComponent = 'App';
    app.dataset.pointGrabComponentSource = 'src/App.tsx:3:1';

    const card = document.createElement('section');
    card.dataset.pointGrabComponent = 'Card';
    card.dataset.pointGrabComponentSource = 'src/components/Card.tsx:8:1';

    const button = document.createElement('button');
    card.append(button);
    app.append(card);

    expect(resolveComponent(button)).toEqual({
      name: 'Card',
      hostElement: card,
      stack: [
        { name: 'Card', hostElement: card },
        { name: 'App', hostElement: app },
      ],
    });
  });

  it('returns an empty result when no Solid metadata exists', () => {
    expect(resolveComponent(document.createElement('div'))).toEqual({
      name: null,
      hostElement: null,
      stack: [],
    });
  });
});
