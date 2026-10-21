import Counter from './counter';

export default function Page() {
  return (
    <main className="card">
      <h1>Atlas</h1>
      <p>Server-rendered page with a client counter.</p>
      <Counter />
    </main>
  );
}
