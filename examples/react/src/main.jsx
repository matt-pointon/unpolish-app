import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
// Bundled integration: import the harness once, then init with the repo config.
import '../../../unpolish/unpolish.js';
import config from '../unpolish.config.json';

createRoot(document.getElementById('root')).render(<App />);
window.Unpolish.init({ config });
