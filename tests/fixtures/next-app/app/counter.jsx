'use client';
import { useState } from 'react';

export default function Counter() {
  const [n, setN] = useState(0);
  return <button data-testid="count" onClick={() => setN(n + 1)}>Clicked {n}</button>;
}
