/**
 * ============================================================
 * סימולציית סטרימינג של תשובות מהשרת
 * ============================================================
 *
 * בעתיד יוחלף בסטרימינג אמיתי (Server-Sent Events / WebSockets / fetch chunked).
 * הקובץ הזה הוא **נקודת השליטה היחידה** - כדי להחליף לסטרימינג אמיתי
 * מאוחר יותר, פשוט תחליף את הפונקציה streamText להתחבר ל-API אמיתי
 * שמחזיר נתונים בחלקים, מבלי לגעת בקוד אחר.
 *
 * ה-API של הפונקציה ישאר זהה:
 *   streamText(fullText, onUpdate, onComplete) -> cancelFn
 */

// ============================================================
// הגדרות - שנה את הערכים האלה כדי להתאים את ההתנהגות
// ============================================================

/** מספר תווים שמתווספים בכל "פעימה" של הסטרימינג */
export const STREAM_CHARS_PER_TICK = 5;

/** זמן בין פעימה לפעימה (מילישניות). נמוך יותר = חלק יותר */
export const STREAM_INTERVAL_MS = 100;

/** האם לאפשר סטרימינג? שים false כדי להציג את התשובה מיד */
export const STREAM_ENABLED = true;

// ============================================================
// הלוגיקה - בדרך כלל אין צורך לגעת
// ============================================================

/**
 * מציג טקסט בהדרגה, חלק אחר חלק, ומחזיר פונקציית ביטול.
 *
 * @param fullText - הטקסט המלא שיוצג עד הסוף
 * @param onUpdate - נקרא בכל עדכון עם הטקסט החלקי הנוכחי
 * @param onComplete - נקרא כשהסטרימינג הסתיים (טבעי או דרך ביטול)
 *                     מקבל פרמטר wasCancelled = האם הופסק על-ידי ביטול
 * @returns פונקציה לביטול הסטרימינג באמצע (מפסיקה גם את הטיימר וגם מסיימת את ה-promise)
 */
export const streamText = (
    fullText: string,
    onUpdate: (partialText: string) => void,
    onComplete: (wasCancelled: boolean) => void,
): (() => void) => {
    let cancelled = false;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let currentLength = 0;

    /** מסיים את הסטרימינג בצורה בטוחה (פעם אחת בלבד) */
    const finish = (wasCancelled: boolean) => {
        if (done) return;
        done = true;
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        onComplete(wasCancelled);
    };

    // אם סטרימינג מבוטל - מציגים מיד את הטקסט המלא
    if (!STREAM_ENABLED) {
        onUpdate(fullText);
        finish(false);
        return () => { };
    }

    // לולאת פעימות - כל פעימה מוסיפה כמה תווים
    const tick = () => {
        if (cancelled || done) return;
        currentLength = Math.min(currentLength + STREAM_CHARS_PER_TICK, fullText.length);
        onUpdate(fullText.slice(0, currentLength));
        if (currentLength >= fullText.length) {
            finish(false); // הסתיים טבעית
        } else {
            timer = setTimeout(tick, STREAM_INTERVAL_MS);
        }
    };

    // מתחילים את הסטרימינג
    timer = setTimeout(tick, STREAM_INTERVAL_MS);

    // מחזירים פונקציית ביטול
    return () => {
        cancelled = true;
        finish(true);
    };
};
