import axios from 'axios';
import { apiClient } from './client';
import type { ChatRequest, ChatResponse, ConversationDetail, Entity, FeedbackRequest, HistoryResponse, InitRequest } from './types';

// ============================================================
// קונפיגורציה - שנה כאן את ה-URL וההגדרות
// ============================================================
const API_BASE_URL =
    (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
    'http://localhost:8000';

const API_KEY = 'dev-api-key';
const USER_PERSONAL_NUMBER = 'user_123';

// ============================================================
// טיפוסים לסטרימינג
// ============================================================

/** event שמגיע מהשרת בסטרימינג */
export type StreamEvent =
    | { type: 'action'; text: string }
    | {
        type: 'response';
        text: string;
        session_id: string;
        message_id?: string;             // מזהה ההודעה (חדש)
        timestamp?: string;              // זמן השרת (ISO 8601) - חדש
        entities: Entity[];
        needs_clarification?: boolean;
        clarify_for?: string | null;
    };

/** Handlers לקריאה כל פעם שאירוע מגיע */
export interface StreamHandlers {
    onAction: (text: string) => void;
    onResponse: (response: ChatResponse) => void;
}

// ============================================================
// API לא-סטרימינג (משאיר לתאימות לאחור)
// ============================================================

/**
 * שולח הודעה לצ'אט (ראוט /chat - תגובה אחת ב-JSON)
 */
export async function sendChatMessage(
    request: ChatRequest,
    signal?: AbortSignal,
): Promise<ChatResponse> {
    const { data } = await apiClient.post<ChatResponse>('/chat', request, { signal });
    return data;
}

// ============================================================
// API סטרימינג (ראוט /chat/stream - SSE)
// ============================================================

/**
 * שולח הודעה לראוט הסטרימינג ומקבל events בזמן אמת.
 * מעביר כל event ל-handler המתאים:
 *   onAction: כל פעם שהסוכן מבצע פעולה
 *   onResponse: כשהתשובה הסופית מגיעה
 *
 * @returns Promise שמסתיים כשהסטרימינג הסתיים (או נזרק AbortError בביטול)
 */
export async function sendChatMessageStream(
    request: ChatRequest,
    handlers: StreamHandlers,
    signal?: AbortSignal,
): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': API_KEY,
            'user-personal-number': USER_PERSONAL_NUMBER,
        },
        body: JSON.stringify(request),
        signal,
    });

    if (!response.ok) {
        throw new Error(`Stream request failed: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
        throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // SSE events מופרדים ב-"\n\n"
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || ''; // החלק האחרון אולי חתוך - שמור לאיטרציה הבאה

            for (const part of parts) {
                if (!part.startsWith('data: ')) continue;
                const payload = part.slice(6).trim();

                if (payload === '[DONE]') {
                    return; // סוף שידור
                }

                try {
                    const event = JSON.parse(payload) as StreamEvent;
                    if (event.type === 'action') {
                        handlers.onAction(event.text);
                    } else if (event.type === 'response') {
                        const chatResponse: ChatResponse = {
                            response: event.text,
                            session_id: event.session_id,
                            message_id: event.message_id,        // העברת המזהה
                            timestamp: event.timestamp,          // העברת זמן השרת
                            entities: event.entities,
                            needs_clarification: event.needs_clarification ?? false,
                            clarify_for: event.clarify_for ?? null,
                            reasoning_content: null,
                        };
                        handlers.onResponse(chatResponse);
                    }
                } catch (e) {
                    console.warn('Failed to parse stream event:', payload, e);
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

// ============================================================
// /init - איתחול הקשר משתמש
// ============================================================

export async function initUserContext(context: InitRequest): Promise<void> {
    await apiClient.post('/init', context);
}

// ============================================================
// /feedback - שליחת משוב על תשובת בוט
// ============================================================

/**
 * שולח משוב משתמש (Like/Dislike + סיבה אופציונלית) לשרת.
 * השרת מחזיר 204 No Content בהצלחה.
 */
export async function sendFeedback(feedback: FeedbackRequest): Promise<void> {
    await apiClient.post('/feedback', feedback);
}

// ============================================================
// /history - היסטוריית שיחות
// ============================================================

/**
 * מקבל מהשרת אובייקט עם user_personal_number ורשימת השיחות שלו.
 */
export async function getHistory(): Promise<HistoryResponse> {
    const { data } = await apiClient.get<HistoryResponse>('/history');
    return data;
}

/**
 * מקבל מהשרת שיחה מלאה לפי session_id (לתצוגה read-only).
 * מחזיר את כל ההודעות בסדר כרונולוגי.
 */
export async function getConversation(sessionId: string): Promise<ConversationDetail> {
    const { data } = await apiClient.get<ConversationDetail>('/history/conversation', {
        params: { session_id: sessionId },
    });
    return data;
}

// ============================================================
// עוזרים
// ============================================================

/** מזהה בקשות שבוטלו ע"י Stop (גם axios וגם fetch) */
export function isAbortError(error: unknown): boolean {
    if (axios.isCancel(error)) return true;
    if (error instanceof Error && error.name === 'CanceledError') return true;
    if (error instanceof Error && error.name === 'AbortError') return true;
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    return false;
}
