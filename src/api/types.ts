// ---------- טיפוסי TypeScript למודלי ה-API ----------

/**
 * ישות גיאוגרפית - אובייקט במערכת ה-GIS שיוצג על המפה
 */
export interface Entity {
    layer: string | null;       // שם השכבה (targets / forces / routes וכו')
    entity_id: string | null;   // מזהה ייחודי של הישות
    name?: string | null;       // שם תצוגה ("כוח א", "מטרה X") - לזיהוי בתוך טקסט וקישור
    geometry: string | null;    // WKT string: POINT / LINESTRING / POLYGON
}

/**
 * בקשה ל-/chat
 */
export interface ChatRequest {
    message: string;                 // ההודעה של המשתמש - חובה
    session_id?: string | null;      // null בהודעה ראשונה, אחר כך מזהה השיחה
    timestamp?: string;              // זמן שליחת ההודעה במחשב המשתמש (ISO 8601)
    unit?: string | null;
    reality?: string | null;
    module?: string | null;
    role?: string | null;
    plan?: string | null;
    case?: string | null;
}

/**
 * תגובה מ-/chat
 */
export interface ChatResponse {
    response: string;                       // טקסט התשובה (Markdown)
    session_id: string;                     // מזהה השיחה - לשמירה לקריאות הבאות
    message_id?: string;                    // מזהה ההודעה הספציפית (חדש)
    timestamp?: string;                     // זמן השרת ב-ISO 8601 (חדש)
    needs_clarification: boolean;           // האם צריך הבהרה מהמשתמש
    clarify_for: string | null;             // השדה שדורש הבהרה
    reasoning_content: string | null;       // chain of thought (לדיבוג)
    entities: Entity[];                     // ישויות למפה
}

/**
 * בקשה ל-/init - איתחול הקשר משתמש (אופציונלי, נקרא פעם אחת)
 */
export interface InitRequest {
    unit?: string | null;
    reality?: string | null;
    module?: string | null;
    role?: string | null;
    plan?: string | null;
    case?: string | null;
}

/**
 * בקשה ל-/feedback - משוב משתמש על תשובת בוט
 */
export interface FeedbackRequest {
    session_id: string;                       // מזהה השיחה
    message_id?: string;                       // מזהה ההודעה הספציפית (אופציונלי)
    sentiment: 'positive' | 'negative';       // חיובי = Like, שלילי = Dislike
    reason?: string;                           // סיבה מהרשימה הסגורה, או "אחר"
    free_text?: string;                        // טקסט חופשי (בעיקר כש-reason="אחר")
    timestamp?: string;                        // זמן ב-ISO 8601
}

/**
 * תקציר שיחה היסטורית - איבר ברשימת השיחות
 */
export interface ConversationSummary {
    session_id: string;                        // מזהה הסשן (לרוב בפורמט "userId:timestamp")
    summary: string;                           // כותרת תיאורית להצגה ברשימה
}

/**
 * תגובת ה-/history - עטיפה עם מספר המשתמש ורשימת שיחותיו
 */
export interface HistoryResponse {
    user_personal_number: string;
    conversations: ConversationSummary[];
}

/**
 * הודעה בודדת בתוך שיחה שמורה
 */
export interface ConversationMessage {
    message_id: string;
    sender: 'user' | 'bot';
    text: string;
    timestamp: string;                         // ISO 8601
}

/**
 * תגובת ה-/history/conversation - שיחה מלאה לתצוגה read-only
 */
export interface ConversationDetail {
    session_id: string;
    summary: string;
    messages: ConversationMessage[];
}
