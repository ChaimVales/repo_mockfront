import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode הוסר כדי לראות התנהגות תואמת לפרודקשן (ללא double-invoke של effects).
// אם תרצה להחזיר - תייבא { StrictMode } מ-'react' ועטוף את <App />.
createRoot(document.getElementById('root')!).render(<App />)
