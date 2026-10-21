<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const route = ref(location.hash.slice(2) || 'trails');
const onHash = () => { route.value = location.hash.slice(2) || 'trails'; };
onMounted(() => window.addEventListener('hashchange', onHash));
onUnmounted(() => window.removeEventListener('hashchange', onHash));

const heroImg = "/examples/assets/forest.svg";
const tab = ref("easy");
const trails = ref([
  { name: 'Ridge Loop', km: 8.2, level: 'easy', status: 'Open' },
  { name: 'Cedar Falls', km: 12.5, level: 'hard', status: 'Closed' },
  { name: 'Lakeshore', km: 5.1, level: 'easy', status: 'Open' },
  { name: 'Granite Pass', km: 16.0, level: 'hard', status: 'Caution' },
]);
const shown = computed(() => trails.value.filter((t) => t.level === tab.value));
const open = ref(false);
const name = ref('');
const party = ref(2);
const errors = computed(() => (name.value.trim().length < 2 ? 'Tell us who is booking.' : ''));
const submitted = ref(false);
const added = ref(0);
function addTrail() {
  added.value++;
  trails.value.push({ name: 'New trail ' + added.value, km: 3 + added.value, level: tab.value, status: 'Open' });
}
function book() { submitted.value = true; if (!errors.value) { open.value = false; } }
</script>

<template>
  <div class="shell">
    <header class="top">
      <a class="logo" href="#/trails">⛰ Trailhead</a>
      <nav>
        <a href="#/trails" :class="{ on: route === 'trails' }" :aria-current="route === 'trails' ? 'page' : null" data-testid="nav-trails">Trails</a>
        <a href="#/about" :class="{ on: route === 'about' }" :aria-current="route === 'about' ? 'page' : null" data-testid="nav-about">About</a>
      </nav>
      <button class="cta" data-testid="open-dialog" @click="open = true">Book a guide</button>
    </header>

    <section v-if="route === 'trails'" class="page">
      <div class="hero">
        <img :src="heroImg" alt="Forest trail" class="hero-img" />
        <div class="hero-copy"><h1>Find your next trail</h1><p>Conditions updated hourly by rangers.</p></div>
      </div>
      <div class="tabs" role="tablist">
        <button role="tab" :aria-selected="tab === 'easy'" data-testid="tab-easy" @click="tab = 'easy'">Easy</button>
        <button role="tab" :aria-selected="tab === 'hard'" data-testid="tab-hard" @click="tab = 'hard'">Challenging</button>
      </div>
      <ul class="list" data-testid="trail-list">
        <li v-for="t in shown" :key="t.name" class="item">
          <div><strong>{{ t.name }}</strong><span class="km">{{ t.km }} km</span></div>
          <span class="chip" :class="t.status.toLowerCase()">{{ t.status }}</span>
        </li>
      </ul>
      <button class="ghost" data-testid="add-trail" @click="addTrail">+ Add trail</button>
      <details class="faq"><summary>What do the statuses mean?</summary><p>Caution means muddy or icy sections. Closed trails are unsafe.</p></details>
      <div class="map-embed" data-testid="map">Map (excluded from theming)</div>
    </section>
    <section v-else class="page about"><h1>About</h1><p class="muted">Trailhead is a demo for testing Unpolish with Vue scoped styles.</p></section>

    <Teleport to="body">
      <div v-if="open" class="scrim" @click.self="open = false">
        <div class="dialog" role="dialog" aria-modal="true" aria-label="Book a guide" data-testid="dialog">
          <h2>Book a guide</h2>
          <label>Name<input v-model="name" data-testid="name" :aria-invalid="submitted && !!errors" /></label>
          <p v-if="submitted && errors" class="err">{{ errors }}</p>
          <label>Party size<input v-model.number="party" type="number" min="1" /></label>
          <div class="row"><button class="ghost" @click="open = false">Cancel</button><button class="cta" data-testid="book" @click="book">Book</button></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.shell { font-family: Georgia, "Times New Roman", serif; color: #1d2b22; background: #f3f1ea; min-height: 100vh; }
.top { display: flex; align-items: center; gap: 24px; padding: 16px 32px; background: #1f3a2b; color: #eef4ec; }
.logo { color: #f6d58e; font-weight: bold; text-decoration: none; font-size: 20px; }
nav { display: flex; gap: 4px; }
nav a { color: #c9dccd; text-decoration: none; padding: 6px 12px; border-radius: 6px; }
nav a.on { background: #f6d58e; color: #1f3a2b; }
.cta { margin-left: auto; background: #e07a3f; color: white; border: 0; padding: 10px 18px; border-radius: 999px; font: inherit; cursor: pointer; box-shadow: 0 4px 0 #a9512a; }
.page { max-width: 820px; margin: 0 auto; padding: 32px; }
.hero { position: relative; border-radius: 18px; overflow: hidden; height: 220px; }
.hero-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hero-copy { position: absolute; left: 24px; bottom: 20px; background: rgba(255,255,255,.88); padding: 14px 18px; border-radius: 12px; }
.hero h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; }
.hero p { margin: 4px 0 0; color: #5b6b60; }
.tabs { display: flex; gap: 8px; margin: 24px 0 12px; }
.tabs [role=tab] { font: inherit; border: 2px solid #c9c2ad; background: transparent; padding: 6px 14px; border-radius: 999px; cursor: pointer; }
.tabs [role=tab][aria-selected=true] { border-color: #1f3a2b; background: #1f3a2b; color: #fff; }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.item { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 14px 16px; border-radius: 12px; border-left: 4px solid #6aa27a; }
.km { color: #7a857d; margin-left: 10px; font-size: 14px; }
.chip { font-size: 13px; padding: 3px 10px; border-radius: 999px; color: #fff; }
.chip.open { background: #2f9361; }
.chip.closed { background: #c2412d; }
.chip.caution { background: #d99a1e; }
.ghost { font: inherit; background: none; border: 1px dashed #8a947f; padding: 8px 14px; border-radius: 8px; cursor: pointer; margin-top: 12px; }
.faq { margin-top: 20px; background: #e8e3d3; border-radius: 10px; padding: 12px 16px; }
.map-embed { margin-top: 20px; height: 90px; display: grid; place-items: center; border-radius: 12px; background: repeating-linear-gradient(45deg, #9fc7a2 0 12px, #b5d6b7 12px 24px); color: #1f3a2b; font-weight: bold; }
.muted { color: #7a857d; }
</style>

<style>
.scrim { position: fixed; inset: 0; background: rgba(15, 30, 20, .55); display: grid; place-items: center; z-index: 10; }
.dialog { background: #fffdf7; border-radius: 16px; padding: 24px; width: min(360px, 90vw); font-family: Georgia, serif; box-shadow: 0 30px 60px rgba(0,0,0,.3); }
.dialog label { display: block; margin-top: 12px; font-size: 14px; }
.dialog input { display: block; width: 100%; margin-top: 4px; padding: 8px 10px; border: 1px solid #c9c2ad; border-radius: 8px; font: inherit; box-sizing: border-box; }
.dialog input[aria-invalid=true] { border-color: #c2412d; }
.dialog .err { color: #c2412d; font-size: 13px; margin: 4px 0 0; }
.dialog .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.dialog .row .cta { margin-left: 0; }
.dialog .row .ghost { margin-top: 0; }
</style>
