<script>
  const ROOT = import.meta.env.BASE_URL.startsWith('/')
    ? import.meta.env.BASE_URL
    : (location.pathname.match(/^.*\/dist\//) || ['/'])[0];
  let path = $state(location.pathname.slice(ROOT.length).replace(/\/$/, ''));
  function go(p, e) { e?.preventDefault(); history.pushState({}, '', ROOT + p + location.search + location.hash); path = p; }
  $effect(() => { const on = () => (path = location.pathname.slice(ROOT.length)); addEventListener('popstate', on); return () => removeEventListener('popstate', on); });

  let menuOpen = $state(false);
  let items = $state([
    { title: 'API latency', value: '182 ms', state: 'ok' },
    { title: 'Error rate', value: '2.4 %', state: 'bad' },
    { title: 'Queue depth', value: '1,204', state: 'warn' },
  ]);
  let loading = $state(false);
  let query = $state('');
  function refresh() {
    loading = true;
    setTimeout(() => { items = [...items, { title: 'Cache hit ' + (items.length - 2), value: '94 %', state: 'ok' }]; loading = false; }, 400);
  }
  const filtered = $derived(items.filter((i) => i.title.toLowerCase().includes(query.toLowerCase())));
</script>

<div class="app">
  <aside class="rail">
    <div class="brand">Pulse</div>
    <a href={ROOT} class:active={path === ''} aria-current={path === '' ? 'page' : undefined} onclick={(e) => go('', e)} data-testid="nav-home">Overview</a>
    <a href={ROOT + 'alerts'} class:active={path === 'alerts' || path.startsWith('alerts/')} aria-current={path === 'alerts' || path.startsWith('alerts/') ? 'page' : undefined} onclick={(e) => go('alerts', e)} data-testid="nav-alerts">Alerts</a>
  </aside>
  <main>
    <header>
      <input type="search" placeholder="Filter metrics" bind:value={query} data-testid="filter" />
      <div class="menu-wrap">
        <button class="pill" aria-haspopup="menu" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)} data-testid="menu-btn">Workspace ▾</button>
        {#if menuOpen}
          <div class="menu" role="menu" data-testid="menu">
            <button role="menuitem" onclick={() => (menuOpen = false)}>Production</button>
            <button role="menuitem" onclick={() => (menuOpen = false)}>Staging</button>
          </div>
        {/if}
      </div>
    </header>
    {#if path === 'alerts' || path.startsWith('alerts/')}
      <h1>Alerts</h1>
      <p class="empty">No open alerts. <button class="tip" type="button" aria-describedby="tip-1">ⓘ<span role="tooltip" id="tip-1">Alerts fire when a metric is red for 5 minutes.</span></button></p>
    {:else}
      <h1>Overview</h1>
      <div class="grid" data-testid="grid">
        {#each filtered as item (item.title)}
          <article class="card {item.state}">
            <span class="label">{item.title}</span>
            <strong>{item.value}</strong>
            <span class="dot" aria-label={item.state}></span>
          </article>
        {/each}
      </div>
      <button class="primary" onclick={refresh} disabled={loading} aria-busy={loading} data-testid="refresh">{loading ? 'Loading…' : 'Load more'}</button>
    {/if}
  </main>
</div>

<style>
  :global(body) { margin: 0; background: #0f1220; }
  .app { --bg: #0f1220; --panel: #181c30; --text: #e8eaf6; --muted: #8a90b0; --accent: #7c5cff; --ok: #34d399; --bad: #f87171; --warn: #fbbf24;
    display: grid; grid-template-columns: 200px 1fr; min-height: 100vh; color: var(--text); background: var(--bg); font-family: system-ui, sans-serif; }
  .rail { background: var(--panel); padding: 20px 12px; display: flex; flex-direction: column; gap: 4px; border-right: 1px solid #262b45; }
  .brand { font-weight: 800; font-size: 18px; padding: 4px 10px 16px; background: linear-gradient(90deg, #7c5cff, #22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .rail a { color: var(--muted); text-decoration: none; padding: 8px 10px; border-radius: 8px; }
  .rail a.active { background: rgba(124, 92, 255, 0.18); color: #c4b5fd; }
  main { padding: 24px 32px; }
  header { display: flex; gap: 12px; align-items: center; margin-bottom: 20px; }
  input[type=search] { flex: 1; max-width: 320px; background: var(--panel); color: var(--text); border: 1px solid #2b3150; border-radius: 10px; padding: 9px 12px; }
  .menu-wrap { position: relative; margin-left: auto; }
  .pill { background: var(--panel); color: var(--text); border: 1px solid #2b3150; border-radius: 999px; padding: 8px 14px; cursor: pointer; }
  .menu { position: absolute; right: 0; top: calc(100% + 6px); background: #20253f; border-radius: 12px; padding: 6px; display: flex; flex-direction: column; min-width: 160px; box-shadow: 0 20px 40px rgba(0,0,0,.5); }
  .menu button { background: none; border: 0; color: var(--text); text-align: left; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
  .menu button:hover { background: rgba(255,255,255,.06); }
  h1 { font-size: 22px; margin: 0 0 16px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
  .card { position: relative; background: var(--panel); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 10px 30px rgba(0,0,0,.35); border-top: 3px solid var(--ok); }
  .card.bad { border-top-color: var(--bad); }
  .card.warn { border-top-color: var(--warn); }
  .label { color: var(--muted); font-size: 13px; }
  .card strong { font-size: 24px; }
  .dot { position: absolute; top: 16px; right: 16px; width: 10px; height: 10px; border-radius: 50%; background: var(--ok); }
  .bad .dot { background: var(--bad); }
  .warn .dot { background: var(--warn); }
  .primary { background: linear-gradient(135deg, #7c5cff, #5b3df5); color: white; border: 0; border-radius: 10px; padding: 10px 16px; font-weight: 600; cursor: pointer; }
  .primary:disabled { opacity: .6; }
  .empty { color: var(--muted); }
  .tip { position: relative; cursor: help; background: none; border: 0; color: inherit; font: inherit; padding: 0; }
  .tip [role=tooltip] { position: absolute; left: 50%; bottom: 140%; transform: translateX(-50%); background: #fff; color: #111; padding: 6px 10px; border-radius: 8px; font-size: 12px; width: max-content; opacity: 0; pointer-events: none; transition: opacity 120ms ease; }
  .tip:hover [role=tooltip], .tip:focus [role=tooltip] { opacity: 1; }
</style>
