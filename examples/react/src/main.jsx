// unpolish:start — lo-fi review themes. Remove with `npx unpolish remove` or delete this block.
import { init as initUnpolish } from 'unpolish';
initUnpolish({ configUrl: `${import.meta.env.BASE_URL}unpolish.config.json` });
// unpolish:end
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
