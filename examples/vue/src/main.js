// unpolish:start — lo-fi review themes. Remove with `npx unpolish remove` or delete this block.
import { init as initUnpolish } from 'unpolish';
initUnpolish({ configUrl: `${import.meta.env.BASE_URL}unpolish.config.json` });
// unpolish:end
import { createApp } from 'vue';
import App from './App.vue';
createApp(App).mount('#app');
