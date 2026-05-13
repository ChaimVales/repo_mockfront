import axios from 'axios';

// ---------- קונפיגורציית ה-Axios Client ----------
// כתובת ה-API: לוקח מ-ENV אם הוגדר, אחרת ברירת מחדל ל-localhost:8000
const API_BASE_URL =
    (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
    'http://localhost:8000';

// כותרות ה-Auth - ה-Mock API מקבל כל ערך לא-ריק
// בעתיד יוחלפו בערכים אמיתיים מ-localStorage / context
const API_KEY = 'dev-api-key';
const USER_PERSONAL_NUMBER = 'user_123';

/**
 * מופע axios משותף לכל הקריאות ל-API
 * כולל:
 * - baseURL
 * - headers חובה לאימות
 * - timeout של 30 שניות
 */
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'api-key': API_KEY,
        'user-personal-number': USER_PERSONAL_NUMBER,
    },
});
