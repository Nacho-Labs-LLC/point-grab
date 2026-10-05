import { createSignal } from 'solid-js';

function CounterCard() {
  const [count, setCount] = createSignal(0);

  return (
    <section class="card">
      <h2>Counter card</h2>
      <p>Pick this paragraph to capture Solid source metadata.</p>
      <button type="button" onClick={() => setCount(count() + 1)}>
        Count: {count()}
      </button>
    </section>
  );
}

const App = () => (
  <main>
    <h1>Point Grab + Solid</h1>
    <p>Hold the configured key and select an element.</p>
    <CounterCard />
  </main>
);

export default App;
