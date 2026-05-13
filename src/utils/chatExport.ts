/**
 * ============================================================
 * ייצוא שיחת צ'אט כקובץ Word
 * ============================================================
 *
 * הקובץ הזה הוא **נקודת השליטה היחידה** של ייצוא השיחה.
 * כדי לשנות את הפורמט בעתיד - תערוך רק את הקובץ הזה.
 *
 * ההיום: יוצר קובץ HTML עם סיומת .doc (Word פותח אותו ישירות).
 * בעתיד תוכל להחליף ל-docx אמיתי על-ידי שימוש בספריית `docx`
 * (npm install docx) - ה-API החיצוני יישאר זהה.
 *
 * ה-API הציבורי:
 *   exportChatAsWord(messages) -> מוריד קובץ מיד
 */

// ============================================================
// הגדרות - שנה כאן כדי להתאים את הפורמט והסגנון
// ============================================================

/** קידומת לשם הקובץ. לדוגמה: "Zchat-conversation_2026-05-12_14-30.doc" */
export const EXPORT_FILENAME_PREFIX = 'Zchat-conversation';

/** סיומת הקובץ - doc / docx. כרגע HTML שמוכר ל-Word, אז .doc */
export const EXPORT_FILE_EXTENSION = 'doc';

/** האם לכלול חותמת זמן בכל הודעה (אם קיימת) */
export const EXPORT_INCLUDE_TIMESTAMPS = true;

/** כותרת המסמך */
export const EXPORT_DOCUMENT_TITLE = 'תיעוד שיחה - Zchat';

/** תוויות לתפקידים בייצוא */
export const EXPORT_USER_LABEL = 'משתמש';
export const EXPORT_BOT_LABEL = 'מערכת Zchat';

// ============================================================
// טיפוסים - מבנה הקלט שהפונקציה מצפה לקבל
// ============================================================

/** הודעת מקור לייצוא - בלי תלות ב-Message של הצ'אט */
export interface ExportableMessage {
    sender: 'user' | 'bot';
    text: string;
    timestamp?: number;
}

// ============================================================
// הלוגיקה הפנימית
// ============================================================

/** מנקה תווים מיוחדים שיכולים לשבור את ה-HTML */
const escapeHtml = (text: string): string =>
    text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

/**
 * generateContent - בונה את גוף ה-HTML של הקובץ
 *
 * **בעתיד**: כדי לעבור ל-docx אמיתי, החלף את הפונקציה הזו ב-:
 *   import { Document, Paragraph } from 'docx';
 *   const doc = new Document({...});
 *   return await Packer.toBlob(doc);
 *
 * ה-`exportChatAsWord` למטה לא צריך להשתנות.
 */
const generateContent = (messages: ExportableMessage[]): string => {
    const generatedAt = new Date().toLocaleString('he-IL');

    const messagesHtml = messages
        .map((msg) => {
            const label = msg.sender === 'user' ? EXPORT_USER_LABEL : EXPORT_BOT_LABEL;
            const timestamp =
                EXPORT_INCLUDE_TIMESTAMPS && msg.timestamp
                    ? new Date(msg.timestamp).toLocaleString('he-IL')
                    : '';
            const bgColor = msg.sender === 'user' ? '#d6e4f5' : '#f5f5f5';
            const align = msg.sender === 'user' ? 'right' : 'right'; // RTL - שניהם מימין

            return `
                <div style="margin: 12px 0; padding: 12px; background: ${bgColor}; border-radius: 8px; text-align: ${align};">
                    <div style="font-weight: bold; margin-bottom: 4px; color: #1e40af;">
                        ${label}
                        ${timestamp ? `<span style="font-weight: normal; font-size: 11px; color: #666; margin-right: 8px;">${timestamp}</span>` : ''}
                    </div>
                    <div style="white-space: pre-wrap;">${escapeHtml(msg.text)}</div>
                </div>
            `;
        })
        .join('');

    return `
        <html dir="rtl" lang="he">
            <head>
                <meta charset="UTF-8">
                <title>${EXPORT_DOCUMENT_TITLE}</title>
            </head>
            <body style="font-family: 'Arial', sans-serif; padding: 30px; max-width: 800px; margin: 0 auto;">
                <h1 style="text-align: center; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px;">
                    ${EXPORT_DOCUMENT_TITLE}
                </h1>
                <p style="text-align: center; color: #666; font-size: 12px;">
                    הופק בתאריך: ${generatedAt}
                </p>
                <p style="text-align: center; color: #666; font-size: 12px;">
                    מספר הודעות: ${messages.length}
                </p>
                <hr style="margin: 20px 0;">
                ${messagesHtml || '<p style="text-align: center; color: #888;">השיחה ריקה</p>'}
            </body>
        </html>
    `;
};

/** בונה שם קובץ עם חותמת זמן */
const buildFilename = (): string => {
    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19); // למשל "2026-05-12T14-30-42"
    return `${EXPORT_FILENAME_PREFIX}_${timestamp}.${EXPORT_FILE_EXTENSION}`;
};

// ============================================================
// ה-API הציבורי
// ============================================================

/**
 * מייצא את השיחה כקובץ Word ומוריד אותו לדפדפן.
 *
 * @param messages - מערך ההודעות לייצוא
 *
 * הערה: פונקציה **סינכרונית** - הכל קורה בזיכרון, אין I/O.
 * הדפדפן מטפל בהורדה אוטומטית.
 */
export const exportChatAsWord = (messages: ExportableMessage[]): void => {
    const content = generateContent(messages);
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);

    // יצירת לינק זמני וקליק עליו - הדרך הסטנדרטית להוריד קובץ ב-browser
    const link = document.createElement('a');
    link.href = url;
    link.download = buildFilename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // ניקוי - משחרר את ה-URL מהזיכרון
    URL.revokeObjectURL(url);
};
