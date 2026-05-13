import React, { useState, useRef, useEffect } from 'react';
import {
    Minus, Send, MessageSquare, X, Maximize2, Minimize2,
    PanelLeft, PanelRight, PanelTop, PanelBottom,
    MessageCircle, ChevronLeft, Plus, Sparkles, AlertCircle,
    HelpCircle, Lightbulb, Target, Square, Download,
    ThumbsUp, ThumbsDown, Copy, Check, Menu, MoreVertical,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { sendChatMessageStream, sendFeedback, isAbortError } from '../../api/zchatApi';
import { Tip } from '../ui/Tooltip';
import { streamText } from '../../utils/streaming';
import { exportChatAsWord } from '../../utils/chatExport';
import { HistorySidebar } from './HistorySidebar';

// קישור קבוע לקבוצת ה-WhatsApp של פורום המשתמשים
const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/Bamq9l5ehPQ2pAvvRdEDne';

// שם משתמש - בעתיד יגיע מ-context/auth
const USER_NAME = 'משתמש';

// נושאים שניתן לשאול עליהם
const TOPICS: string[] = [
    'מטרות',
    'מטסונים',
    'איתורי אויב',
    'איתורי אירוע',
    'תמ״כ',
    'קווי תיאום',
    'מנחתים',
];

// שאלות לדוגמה - לחיצה ממלאת את האינפוט
const EXAMPLE_QUESTIONS: string[] = [
    'איזה כוחות נמצאים בגזרה של חטיבה 7?',
    'איפה מגד 890?',
    'מה איתורי אויב קיימים באזור של חפ״ק סמג״ד 202?',
    'איזה מנחתים קרובים לחפ״ק מג״ד 12?',
    'מה נמצא ברדיוס 500 מטר מנקודה מסוימת?',
];

// רשימת סיבות סגורה למשוב שלילי (Dislike)
const FEEDBACK_REASONS: string[] = [
    'תשובה לא מדויקת',
    'מידע חסר',
    'תשובה לא רלוונטית',
    'מידע שגוי במפה',
    'חוסר הבנה של השאלה',
    'תשובה חלקית',
];
// תווית "אחר" - מציגה textarea לטקסט חופשי
const FEEDBACK_OTHER = 'אחר';

type DockPosition = 'left' | 'right' | 'top' | 'bottom';

interface Message {
    id: number;
    text: string;
    sender: 'bot' | 'user';
    timestamp?: number;              // Unix ms - זמן יצירת ההודעה (לתצוגה בכרטיס)
    /**
     * הפעולה הנוכחית של הסוכן (מתחלפת בכל אירוע מהשרת).
     * מוצג בבועת הבוט בזמן ההמתנה, לפני שהטקסט עצמו מתחיל להופיע.
     */
    currentAction?: string;
    /** האם נשלח כבר משוב על ההודעה הזו (Like/Dislike) */
    feedbackGiven?: 'positive' | 'negative';
    /**
     * כמה תווים מהטקסט המלא מוצגים כרגע. אם undefined - כל הטקסט מוצג.
     * אם < text.length - יוצג כפתור "המשך" לפתיחת עוד תווים.
     */
    visibleChars?: number;
}

/** הודעה בתור - שומר את הזמן המדויק שהמשתמש לחץ Enter */
interface QueuedMessage {
    text: string;
    timestamp: number;              // נשמר משעה שהמשתמש לחץ Enter, נשלח לשרת בהמשך
}

interface ChatLayoutProps {
    children?: React.ReactNode;
}

// ערכי ברירת מחדל - אליהם חוזרים כשלוחצים X
const DEFAULT_POSITION: DockPosition = 'right';
const DEFAULT_SIZE = 30;
// מסך הפתיחה מוצג כשהמערך ריק - לכן ההתחלה היא מערך ריק
const INITIAL_MESSAGES: Message[] = [];
// גודל מקסימלי של תור ההודעות הממתינות בזמן שהמערכת מייצרת תשובה.
// **כדי להגדיל את התור בעתיד - פשוט שנה את המספר הזה.**
// 1 = שאלה אחת בלבד יכולה לחכות. 3 = עד 3 שאלות בתור. וכו'
const MAX_QUEUE_SIZE = 1;

// ============================================================
// קיטוע תשובות ארוכות
// ============================================================
// כשהבוט מחזיר תשובה ארוכה - מקטעים אותה ומציגים "המשך" לפתיחה הדרגתית.
// **שני המספרים הבאים שולטים על ההתנהגות:**

/** מספר התווים שמוצגים בתחילה. תשובה ארוכה יותר תקוצר עם כפתור "המשך". */
const INITIAL_VISIBLE_CHARS = 300;

/** כמה תווים מתגלים בכל לחיצה על "המשך" (לא הכל בבת אחת!) */
const EXPAND_CHARS_PER_CLICK = 200;

const ChatLayout: React.FC<ChatLayoutProps> = ({ children }) => {
    const [position, setPosition] = useState<DockPosition>(DEFAULT_POSITION);
    const [size, setSize] = useState<number>(DEFAULT_SIZE);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [isMaximized, setIsMaximized] = useState<boolean>(false);

    // סטייט של תוכן השיחה - נשמר במזעור, מתאפס בסגירה
    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [inputText, setInputText] = useState<string>('');
    // האם פאנל המידע פתוח
    const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
    // איזה הודעת בוט מקבלת כרגע משוב Dislike (null = הדיאלוג סגור)
    const [dislikingMessageId, setDislikingMessageId] = useState<number | null>(null);
    // הסיבה שנבחרה בדיאלוג Dislike (אחת מ-FEEDBACK_REASONS או FEEDBACK_OTHER)
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    // טקסט חופשי (כשנבחר "אחר")
    const [otherReasonText, setOtherReasonText] = useState<string>('');
    // איזה הודעה הועתקה לאחרונה ללוח (לאינדיקציה זמנית של "הועתק")
    const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
    // סיידבר ההיסטוריה (רכיב עצמאי - אפשר להסיר בקלות)
    const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
    // רוחב הכותרת כדי לקבוע אם להציג כפתורים inline או בתפריט "עוד" (responsive)
    const headerRef = useRef<HTMLDivElement>(null);
    const [headerWidth, setHeaderWidth] = useState<number>(0);
    // האם המערכת כרגע מייצרת תשובה - בזמן הזה מוצג כפתור עצירה
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    // מזהה השיחה הנוכחית מהשרת - מתחיל null, מתעדכן בתגובה הראשונה
    const [sessionId, setSessionId] = useState<string | null>(null);
    // תור של הודעות שממתינות לשליחה (נשלחות אחרי שהתשובה הנוכחית מסתיימת)
    // נכנס לתור כשהמשתמש לוחץ Enter בזמן ייצור תשובה. שומר גם את הטיימסטמפ המקורי.
    const [queue, setQueue] = useState<QueuedMessage[]>([]);
    // AbortController פעיל לקריאה הנוכחית - כדי לבטל אותה ב-Stop
    const abortControllerRef = useRef<AbortController | null>(null);
    // פונקציית ביטול לסטרימינג של תשובה נוכחי - כדי לעצור גם את ההדפסה ההדרגתית
    const streamCancelRef = useRef<(() => void) | null>(null);
    // ref לאינפוט - כדי להחזיר אליו פוקוס אחרי בחירת שאלה מהפופאפ
    const inputRef = useRef<HTMLInputElement>(null);
    // ref למיכל ההודעות - כדי לבצע גלילה אוטומטית
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    // האם המשתמש כרגע בתחתית הצ'אט? (אם לא - לא נגלול אוטומטית, נכבד את הצפייה שלו)
    const isAtBottomRef = useRef<boolean>(true);

    const isVertical = position === 'left' || position === 'right';
    const chatFirst = position === 'left' || position === 'top';

    const isResizing = useRef<boolean>(false);

    // ---------- שלוש פעולות שונות: סגור / מזער / שחזר ----------

    // X = סגור: מאפס את הכל - מיקום, גודל, הודעות, קלט, וגם השיחה בשרת
    const handleClose = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (streamCancelRef.current) {
            streamCancelRef.current(); // עוצר סטרימינג אם רץ
            streamCancelRef.current = null;
        }
        setIsMinimized(true);
        setPosition(DEFAULT_POSITION);
        setSize(DEFAULT_SIZE);
        setIsMaximized(false);
        setMessages(INITIAL_MESSAGES);
        setInputText('');
        setSessionId(null); // איפוס מזהה השיחה - בפעם הבאה יתחיל שיחה חדשה לגמרי
        setIsGenerating(false);
        setQueue([]); // ניקוי התור
    };

    // מזער: שומר את הכל בדיוק כפי שהיה - מיקום, גודל, הודעות, וטקסט בקלט
    const handleMinimize = () => {
        setIsMinimized(true);
    };

    // פתיחה מחדש - הסטייט כבר תקין (אם נסגר ב-X הוא אופס, אם מוזער הוא שמור)
    const handleRestore = () => {
        setIsMinimized(false);
    };

    // הורדת השיחה כקובץ Word - sync, לא צריך async כי הכל קורה בזיכרון
    const handleExportChat = () => {
        // ממירים את ה-messages למבנה ש-exportChatAsWord מצפה לו
        const exportable = messages.map((m) => ({
            sender: m.sender,
            text: m.text,
            timestamp: m.timestamp,
        }));
        exportChatAsWord(exportable);
    };

    /**
     * שולח משוב לשרת ומסמן את ההודעה כ"קיבלה משוב"
     * @param messageId - מזהה ההודעה
     * @param sentiment - 'positive' (Like) או 'negative' (Dislike)
     * @param reason - סיבה אופציונלית (רק ב-negative)
     * @param freeText - טקסט חופשי (רק כש-reason="אחר")
     */
    const submitFeedback = (
        messageId: number,
        sentiment: 'positive' | 'negative',
        reason: string | null,
        freeText: string | null,
    ) => {
        // מסמן את ההודעה כקיבלה משוב (כדי שהכפתורים יציגו את המצב)
        setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, feedbackGiven: sentiment } : m)),
        );

        // שולח לשרת - fire and forget (לא ממתינים לתשובה)
        sendFeedback({
            session_id: sessionId || '',
            message_id: String(messageId),
            sentiment,
            reason: reason || undefined,
            free_text: freeText || undefined,
            timestamp: new Date().toISOString(),
        }).catch((err) => {
            console.warn('Failed to send feedback:', err);
        });
    };

    /**
     * הרחבת הודעת בוט שמקוטעת - מוסיף עוד EXPAND_CHARS_PER_CLICK תווים לתצוגה.
     * אם זה חורג מהאורך המלא - מציג הכל.
     */
    const expandMessage = (messageId: number) => {
        setMessages((prev) =>
            prev.map((m) => {
                if (m.id !== messageId) return m;
                const currentVisible = m.visibleChars ?? m.text.length;
                const newVisible = Math.min(
                    currentVisible + EXPAND_CHARS_PER_CLICK,
                    m.text.length,
                );
                return { ...m, visibleChars: newVisible };
            }),
        );
    };

    /**
     * העתקת תוכן הודעת בוט ללוח (clipboard) + הצגת אינדיקציה זמנית של "הועתק"
     * האייקון הופך ל-Check למשך 1.5 שניות.
     */
    const handleCopyMessage = async (msg: Message) => {
        try {
            await navigator.clipboard.writeText(msg.text);
            setCopiedMessageId(msg.id);
            // האינדיקציה נעלמת אחרי 1.5 שניות
            setTimeout(() => {
                setCopiedMessageId((current) => (current === msg.id ? null : current));
            }, 1500);
        } catch (err) {
            console.warn('Failed to copy to clipboard:', err);
        }
    };

    /** Like - שליחה מיידית של משוב חיובי, ללא דיאלוג */
    const handleLike = (messageId: number) => {
        submitFeedback(messageId, 'positive', null, null);
    };

    /** Dislike - פתיחת דיאלוג עם רשימת סיבות */
    const handleDislikeClick = (messageId: number) => {
        setDislikingMessageId(messageId);
        setSelectedReason(null);
        setOtherReasonText('');
    };

    /** שליחת ה-Dislike עם הסיבה שנבחרה */
    const handleDislikeSubmit = () => {
        if (!dislikingMessageId) return;
        const isOther = selectedReason === FEEDBACK_OTHER;
        const reason = selectedReason;
        const freeText = isOther ? otherReasonText.trim() || null : null;
        submitFeedback(dislikingMessageId, 'negative', reason, freeText);
        // סגירת הדיאלוג + ניקוי State
        setDislikingMessageId(null);
        setSelectedReason(null);
        setOtherReasonText('');
    };

    /** סגירת דיאלוג ה-Dislike ב-X או ESC - שליחת משוב שלילי בלי סיבה */
    const handleDislikeClose = () => {
        if (dislikingMessageId) {
            // לפי המפרט: גם בלי סיבה - שולחים את ה-Dislike
            submitFeedback(dislikingMessageId, 'negative', null, null);
        }
        setDislikingMessageId(null);
        setSelectedReason(null);
        setOtherReasonText('');
    };

    // צ'אט חדש - מנקה הכל ומפסיק שיחה נוכחית
    const handleNewChat = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (streamCancelRef.current) {
            streamCancelRef.current(); // עוצר סטרימינג אם רץ
            streamCancelRef.current = null;
        }
        setIsGenerating(false);
        setMessages(INITIAL_MESSAGES);
        setInputText('');
        setSessionId(null); // התחלת שיחה חדשה - מאפסים את ה-session_id
        setQueue([]); // ניקוי התור
    };

    /**
     * sendToApi - שולח הודעה ל-API ומפעיל סטרימינג של התשובה
     * @param message - תוכן ההודעה
     * @param timestamp - Unix ms של מתי המשתמש לחץ Enter (נשלח לשרת כ-ISO 8601)
     * (האחריות להוספת הודעת המשתמש לרשימה היא של הקורא - נעשתה כבר ב-queueOrSend)
     */
    const sendToApi = async (message: string, timestamp: number) => {
        setIsGenerating(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // יוצרים בועת בוט ריקה מיד - שתציג בה את ה-actions תוך כדי.
        // visibleChars מוגדר מראש - כשהטקסט יהיה ארוך יותר ממנו, יוצג "המשך"
        const botMsgId = Date.now() + 1;
        setMessages((prev) => [
            ...prev,
            {
                id: botMsgId,
                sender: 'bot',
                text: '',
                currentAction: 'מתחיל...',
                visibleChars: INITIAL_VISIBLE_CHARS,
            },
        ]);

        try {
            await sendChatMessageStream(
                {
                    message,
                    session_id: sessionId,
                    timestamp: new Date(timestamp).toISOString(),
                },
                {
                    // כל action שמגיע - מעדכן את ה-currentAction של בועת הבוט (מתחלף!)
                    onAction: (actionText) => {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId ? { ...m, currentAction: actionText } : m,
                            ),
                        );
                    },
                    // כשהתשובה הסופית מגיעה - מתחילים את הסטרימינג של הטקסט
                    onResponse: async (response) => {
                        setSessionId(response.session_id);
                        // מנקים את ה-currentAction - עכשיו מתחיל הטקסט עצמו
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === botMsgId ? { ...m, currentAction: undefined } : m,
                            ),
                        );

                        // סטרימינג של הטקסט תו-אחר-תו (כמו קודם)
                        await new Promise<void>((resolve) => {
                            streamCancelRef.current = streamText(
                                response.response,
                                (partialText) => {
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m.id === botMsgId ? { ...m, text: partialText } : m,
                                        ),
                                    );
                                },
                                () => {
                                    streamCancelRef.current = null;
                                    resolve();
                                },
                            );
                        });

                        // entities זמינים ב-response.entities לשימוש עתידי במפה
                    },
                },
                controller.signal,
            );
        } catch (error) {
            if (isAbortError(error)) {
                console.log('Request canceled by user');
                // אם בוטל באמצע - נמחק את הבועה הריקה
                setMessages((prev) => prev.filter((m) => m.id !== botMsgId));
            } else {
                const errorMessage = error instanceof Error ? error.message : 'שגיאה בלתי צפויה';
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === botMsgId
                            ? {
                                ...m,
                                currentAction: undefined,
                                text: `⚠️ שגיאה בקבלת תשובה: ${errorMessage}. ודא שה-Mock API רץ על localhost:8000.`,
                            }
                            : m,
                    ),
                );
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    /**
     * queueOrSend - לוגיקה משותפת: או שולח מיד או מוסיף לתור
     * @returns true אם ההודעה התקבלה (נוקה האינפוט), false אם נדחתה (תור מלא)
     *
     * הבדל חשוב בין שני המסלולים:
     * - שליחה מיידית (לא מייצר תשובה): ההודעה מוצגת מיד בצ'אט
     * - הוספה לתור (מייצר תשובה): ההודעה לא מוצגת עדיין -
     *   היא תוצג רק אחרי שהתשובה הקודמת מסתיימת (היררכיה נכונה)
     */
    const queueOrSend = (rawText: string): boolean => {
        const trimmed = rawText.trim();
        if (!trimmed) return false;

        // לוקחים timestamp **עכשיו** - כשהמשתמש לחץ Enter, לא כשההודעה תישלח בפועל
        const timestamp = Date.now();

        // כשהמשתמש שולח הודעה - הוא רוצה לראות אותה. מחזירים מצב ל"בתחתית" כדי שתהיה גלילה.
        isAtBottomRef.current = true;

        if (isGenerating) {
            // מצב 1: מערכת מייצרת תשובה
            if (queue.length >= MAX_QUEUE_SIZE) {
                return false; // תור מלא - דוחים
            }
            // נכנס לתור בלבד - **לא** מציגים את ההודעה עדיין
            // ה-timestamp שמרנו עכשיו ייצא איתה כשהיא תוצג ותישלח
            setQueue((prev) => [...prev, { text: trimmed, timestamp }]);
        } else {
            // מצב 2: המערכת פנויה -> מציגים מיד ושולחים
            const userMsg: Message = {
                id: Date.now(),
                sender: 'user',
                text: trimmed,
                timestamp,
            };
            setMessages((prev) => [...prev, userMsg]);
            sendToApi(trimmed, timestamp);
        }
        return true;
    };

    // שליחת הודעה דרך כפתור - עובד רק כשלא מייצר תשובה
    // (במצב יצירת תשובה הכפתור מתחלף ל-Stop, אז handleSend לא ייקרא)
    const handleSend = () => {
        if (isGenerating) return;
        if (queueOrSend(inputText)) setInputText('');
    };

    // שליחת הודעה דרך Enter - עובד גם בזמן יצירת תשובה (כדי להכניס לתור)
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (queueOrSend(inputText)) setInputText('');
        }
    };

    // עצירת יצירת התשובה - מבטל את ה-request, את הסטרימינג, וגם מנקה את התור
    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (streamCancelRef.current) {
            streamCancelRef.current(); // עוצר את האנימציה אם היא רצה
            streamCancelRef.current = null;
        }
        setIsGenerating(false);
        setQueue([]); // עצירה מנקה גם את ההודעות הממתינות בתור
    };

    // עיבוד התור - כשהתשובה הנוכחית מסתיימת ויש משהו בתור:
    // 1. מציג את הודעת המשתמש (היררכיה נכונה - אחרי תשובת הבוט הקודמת)
    // 2. שולח את ההודעה ל-API עם ה-timestamp המקורי (משעת לחיצת Enter)
    useEffect(() => {
        if (!isGenerating && queue.length > 0) {
            const next = queue[0];
            setQueue((prev) => prev.slice(1)); // מוציאים את הראשון מהתור

            // עכשיו מציגים את הודעת המשתמש - אחרי שתשובת הבוט הקודמת כבר נראית
            const userMsg: Message = {
                id: Date.now(),
                sender: 'user',
                text: next.text,
                timestamp: next.timestamp, // ה-timestamp המקורי משעת לחיצת Enter
            };
            setMessages((prev) => [...prev, userMsg]);

            sendToApi(next.text, next.timestamp);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGenerating, queue]);

    // ניקוי כשהקומפוננטה נסגרת - מבטל קריאות וסטרימינג פתוחים
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (streamCancelRef.current) {
                streamCancelRef.current();
            }
        };
    }, []);

    // ResizeObserver - מתאים את הכותרת לרוחב הצ'אט (responsive)
    useEffect(() => {
        if (!headerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setHeaderWidth(entry.contentRect.width);
        });
        observer.observe(headerRef.current);
        return () => observer.disconnect();
    }, []);

    /**
     * מאזין לגלילה ידנית של המשתמש - מעדכן את isAtBottomRef
     * אם המשתמש גלל למעלה לקרוא הודעות ישנות, נכבד את זה ולא נגלול אוטומטית
     */
    const handleMessagesScroll = () => {
        const container = messagesContainerRef.current;
        if (!container) return;
        // מרחק של 60px מהתחתית עדיין נחשב "בתחתית" - מקל על המשתמש
        const distanceFromBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight;
        isAtBottomRef.current = distanceFromBottom < 60;
    };

    /**
     * אוטו-גלילה לתחתית כשמשתנים ההודעות (הודעה חדשה / סטרימינג מעדכן טקסט)
     * רק אם המשתמש בתחתית - אם הוא גלל למעלה, לא נפריע לו
     */
    useEffect(() => {
        if (!isAtBottomRef.current) return;
        const container = messagesContainerRef.current;
        if (!container) return;
        // גלילה לתחתית בלי אנימציה - מיידית, גם בסטרימינג מהיר
        container.scrollTop = container.scrollHeight;
    }, [messages]);

    // ---------- שינוי גודל ----------
    const startResize = (e: React.MouseEvent) => {
        if (isMaximized) return;
        isResizing.current = true;
        document.body.style.cursor = isVertical ? 'ew-resize' : 'ns-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;

            let newSize: number;
            if (position === 'right') {
                newSize = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
            } else if (position === 'left') {
                newSize = (e.clientX / window.innerWidth) * 100;
            } else if (position === 'top') {
                newSize = (e.clientY / window.innerHeight) * 100;
            } else {
                newSize = ((window.innerHeight - e.clientY) / window.innerHeight) * 100;
            }
            setSize(Math.max(15, Math.min(85, newSize)));
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [position]);

    // ---------- מצב מזוער / סגור - הצ'אט מוצג רק כאייקון צף ----------
    if (isMinimized) {
        return (
            <div className="h-full w-full relative overflow-hidden">
                <div className="h-full w-full">{children}</div>
                <Tip text="פתח את הצ'אט" side="left">
                    <button
                        onClick={handleRestore}
                        className="absolute bottom-6 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 border-4 border-white"
                    >
                        <MessageSquare size={28} />
                    </button>
                </Tip>
            </div>
        );
    }

    // ---------- מצב responsive של הכותרת ----------
    // headerWidth מתעדכן ע"י ResizeObserver. ספים לקביעת מצב התצוגה:
    //   >= 420px : מצב רחב - כל הכפתורים inline
    //   < 420px  : compact - בורר מיקום + פעולות נכנסים לתפריט "עוד"
    //   < 280px  : very compact - גם השם "Zchat" נעלם
    //   < 220px  : ultra compact - הלוגו קטן יותר, ללא נקודת סטטוס
    const isCompact = headerWidth > 0 && headerWidth < 420;
    const isVeryCompact = headerWidth > 0 && headerWidth < 280;
    const isUltraCompact = headerWidth > 0 && headerWidth < 220;

    // ---------- חישוב גודל הצ'אט והמפה ----------
    // מגדירים את שניהם במפורש כדי שהסכום יהיה תמיד בדיוק 100% ולא יהיה כיסוי
    const effectiveSize = isMaximized ? 100 : size;
    const chatStyle: React.CSSProperties = isVertical
        ? { width: `${effectiveSize}%`, height: '100%' }
        : { width: '100%', height: `${effectiveSize}%` };
    const mapStyle: React.CSSProperties = isVertical
        ? { width: `${100 - effectiveSize}%`, height: '100%' }
        : { width: '100%', height: `${100 - effectiveSize}%` };

    // ---------- מיקום ידית שינוי הגודל ----------
    // אזור גרירה רחב (6px) על הגבול - שקוף לחלוטין, רק הסמן משתנה ל"גרירה"
    const resizeHandleClass = {
        left: 'right-0 top-0 bottom-0 w-1.5 cursor-ew-resize',
        right: 'left-0 top-0 bottom-0 w-1.5 cursor-ew-resize',
        top: 'bottom-0 left-0 right-0 h-1.5 cursor-ns-resize',
        bottom: 'top-0 left-0 right-0 h-1.5 cursor-ns-resize',
    }[position];

    // ---------- פאנל הצ'אט ----------
    // dir="rtl" כדי שהכותרת והודעות יוצגו נכון בעברית
    // (הלייאאוט החיצוני הוא LTR כדי שה-flex לא יתהפך)
    const ChatPanel = (
        <div
            dir="rtl"
            style={chatStyle}
            className="relative flex flex-col bg-white overflow-hidden flex-shrink-0"
        >
            {/* אזור גרירה - שקוף לחלוטין, רק הסמן משתנה */}
            {!isMaximized && (
                <div
                    onMouseDown={startResize}
                    className={`absolute z-30 ${resizeHandleClass}`}
                />
            )}

            {/* כותרת - responsive עם ResizeObserver */}
            <div
                ref={headerRef}
                className={`h-12 bg-slate-900 text-white flex items-center justify-between select-none border-b border-blue-400/30 flex-shrink-0 ${isUltraCompact ? 'px-1 gap-0.5' : 'px-2 gap-1'
                    }`}
            >
                {/* צד ימין: כפתור המבורגר + לוגו Zchat - מתכווץ נכון בלי לחפוף */}
                <div className={`flex items-center min-w-0 flex-shrink ${isUltraCompact ? 'gap-1' : 'gap-1.5'}`}>
                    <Tip text="היסטוריית שיחות">
                        <button
                            onClick={() => setIsHistoryOpen(true)}
                            className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                        >
                            <Menu size={isUltraCompact ? 14 : 16} />
                        </button>
                    </Tip>
                    {/* לוגו Z - קטן יותר במצב ultra compact */}
                    <div
                        className={`bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center font-black text-white shadow-md shadow-blue-500/40 flex-shrink-0 ${isUltraCompact ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-sm'
                            }`}
                    >
                        Z
                    </div>
                    {/* שם המותג - מוסתר במצב מצומצם מאוד */}
                    {!isVeryCompact && (
                        <span className="font-bold text-base tracking-tight truncate min-w-0">
                            <span className="text-blue-400">Z</span>chat
                        </span>
                    )}
                    {/* נקודת סטטוס - מוסתרת ב-compact */}
                    {!isCompact && (
                        <div
                            className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0 shadow-[0_0_6px_rgba(34,197,94,0.7)]"
                            title="פעיל"
                        />
                    )}
                </div>

                {/* אמצע: בורר מיקום - inline רק במצב רחב */}
                {!isCompact && !isMaximized && (
                    <div className="flex items-center gap-0.5 bg-slate-800 rounded p-0.5 flex-shrink-0">
                        <Tip text="עגן שמאל">
                            <button
                                onClick={() => setPosition('left')}
                                className={`p-1 rounded ${position === 'left' ? 'bg-blue-600' : 'hover:bg-white/10'}`}
                            >
                                <PanelLeft size={13} />
                            </button>
                        </Tip>
                        <Tip text="עגן ימין">
                            <button
                                onClick={() => setPosition('right')}
                                className={`p-1 rounded ${position === 'right' ? 'bg-blue-600' : 'hover:bg-white/10'}`}
                            >
                                <PanelRight size={13} />
                            </button>
                        </Tip>
                        <Tip text="עגן למעלה">
                            <button
                                onClick={() => setPosition('top')}
                                className={`p-1 rounded ${position === 'top' ? 'bg-blue-600' : 'hover:bg-white/10'}`}
                            >
                                <PanelTop size={13} />
                            </button>
                        </Tip>
                        <Tip text="עגן למטה">
                            <button
                                onClick={() => setPosition('bottom')}
                                className={`p-1 rounded ${position === 'bottom' ? 'bg-blue-600' : 'hover:bg-white/10'}`}
                            >
                                <PanelBottom size={13} />
                            </button>
                        </Tip>
                    </div>
                )}

                {/* צד שמאל: כפתורי חלון */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    {/* כפתורי פעולות מהירות - inline רק במצב רחב */}
                    {!isCompact && (
                        <>
                            <Tip text="מידע ועזרה">
                                <button
                                    onClick={() => setIsInfoOpen(true)}
                                    className="p-1 hover:bg-blue-600 rounded transition-colors"
                                >
                                    <HelpCircle size={15} />
                                </button>
                            </Tip>
                            <Tip text="צ'אט חדש">
                                <button
                                    onClick={handleNewChat}
                                    className="p-1 hover:bg-blue-600 rounded transition-colors"
                                >
                                    <Plus size={15} />
                                </button>
                            </Tip>
                            <Tip text="הורד שיחה כקובץ Word">
                                <button
                                    onClick={handleExportChat}
                                    disabled={messages.length === 0}
                                    className="p-1 hover:bg-blue-600 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                >
                                    <Download size={15} />
                                </button>
                            </Tip>
                            <div className="w-px h-4 bg-white/20 mx-0.5" />
                        </>
                    )}

                    {/* תפריט "עוד" - מופיע רק במצב compact, מכיל את הכפתורים שהוסתרו */}
                    {isCompact && (
                        <>
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <button
                                        title="עוד פעולות"
                                        className="p-1 hover:bg-white/10 rounded transition-colors data-[state=open]:bg-white/10 flex-shrink-0"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        dir="rtl"
                                        align="end"
                                        sideOffset={6}
                                        className="bg-white rounded-lg shadow-2xl border border-slate-200 p-1 z-[100] min-w-[200px]"
                                    >
                                        {/* פעולות שיחה */}
                                        <DropdownMenu.Item
                                            onSelect={() => setIsInfoOpen(true)}
                                            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer outline-none"
                                        >
                                            <HelpCircle size={14} />
                                            <span>מידע ועזרה</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onSelect={handleNewChat}
                                            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer outline-none"
                                        >
                                            <Plus size={14} />
                                            <span>צ'אט חדש</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onSelect={handleExportChat}
                                            disabled={messages.length === 0}
                                            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer outline-none data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed"
                                        >
                                            <Download size={14} />
                                            <span>הורד שיחה כ-Word</span>
                                        </DropdownMenu.Item>

                                        {/* קבוצת מיקום - רק כשלא במסך מלא */}
                                        {!isMaximized && (
                                            <>
                                                <DropdownMenu.Separator className="h-px bg-slate-200 my-1" />
                                                <DropdownMenu.Label className="px-2 py-1 text-[10px] text-slate-400 font-semibold">
                                                    עגן ל-
                                                </DropdownMenu.Label>
                                                <DropdownMenu.Item
                                                    onSelect={() => setPosition('left')}
                                                    className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer outline-none ${position === 'left' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'}`}
                                                >
                                                    <PanelLeft size={14} />
                                                    <span>שמאל</span>
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Item
                                                    onSelect={() => setPosition('right')}
                                                    className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer outline-none ${position === 'right' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'}`}
                                                >
                                                    <PanelRight size={14} />
                                                    <span>ימין</span>
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Item
                                                    onSelect={() => setPosition('top')}
                                                    className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer outline-none ${position === 'top' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'}`}
                                                >
                                                    <PanelTop size={14} />
                                                    <span>למעלה</span>
                                                </DropdownMenu.Item>
                                                <DropdownMenu.Item
                                                    onSelect={() => setPosition('bottom')}
                                                    className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer outline-none ${position === 'bottom' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'}`}
                                                >
                                                    <PanelBottom size={14} />
                                                    <span>למטה</span>
                                                </DropdownMenu.Item>
                                            </>
                                        )}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                            <div className="w-px h-4 bg-white/20 mx-0.5" />
                        </>
                    )}

                    {/* כפתורי חלון - תמיד מוצגים */}
                    <Tip text="מזער (זוכר מיקום וגודל)">
                        <button
                            onClick={handleMinimize}
                            className="p-1 hover:bg-white/10 rounded"
                        >
                            <Minus size={15} />
                        </button>
                    </Tip>
                    <Tip text={isMaximized ? 'שחזר גודל' : 'מסך מלא'}>
                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="p-1 hover:bg-white/10 rounded"
                        >
                            {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        </button>
                    </Tip>
                    <Tip text="סגור (איפוס תצוגה)">
                        <button
                            onClick={handleClose}
                            className="p-1 hover:bg-red-500 rounded"
                        >
                            <X size={15} />
                        </button>
                    </Tip>
                </div>
            </div>

            {/* כפתור קישור קבוע - פורום המשתמשים ב-WhatsApp */}
            <div className="px-3 pt-3 flex-shrink-0">
                <Tip text="לחץ להצטרפות לקבוצת ה-WhatsApp">
                    <a
                        href={WHATSAPP_GROUP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center justify-center gap-2 w-full px-3 py-2 bg-[#25D366] hover:bg-[#1da851] active:bg-[#168a42] text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg active:shadow-sm active:translate-y-px transition-all duration-150 ring-1 ring-[#1da851]/30"
                    >
                        <MessageCircle size={16} strokeWidth={2.5} className="flex-shrink-0" />
                        <span>הצטרף לפורום המשתמשים</span>
                        <ChevronLeft
                            size={15}
                            className="opacity-80 group-hover:-translate-x-0.5 transition-transform flex-shrink-0"
                        />
                    </a>
                </Tip>
            </div>

            {/* תוכן הצ'אט - מסך פתיחה כשאין הודעות, אחרת רשימת ההודעות */}
            <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 p-4 overflow-y-auto bg-slate-50/30 flex flex-col gap-3"
            >
                {messages.length === 0 ? (
                    // ---------- מסך פתיחה ----------
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-2 py-6 gap-5">
                        {/* לוגו גדול עם אפקט זוהר */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl blur-2xl opacity-40" />
                            <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center font-black text-white text-4xl shadow-xl shadow-blue-500/30">
                                Z
                                <Sparkles
                                    size={14}
                                    className="absolute top-2 left-2 text-white/80 animate-pulse"
                                />
                            </div>
                        </div>

                        {/* הודעת ברוכים הבאים */}
                        <div className="space-y-1.5">
                            <h2 className="text-xl font-bold text-slate-800">
                                שלום {USER_NAME}, ברוכים הבאים ל־
                                <span className="text-blue-600">Z</span>
                                <span className="text-slate-800">chat</span>
                            </h2>
                            <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                                מערכת מבוססת בינה מלאכותית
                                <br />
                                לקבלת מידע מבצעי בזמן אמת
                            </p>
                        </div>

                        {/* הודעת Beta */}
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-lg max-w-xs text-right">
                            <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs leading-relaxed">
                                המערכת נמצאת בגרסת <span className="font-bold">Beta</span> וייתכנו
                                אי־דיוקים במידע המוצג.
                            </p>
                        </div>

                        {/* רמז למשתמש - גם להתחיל וגם לרמוז על אייקון העזרה */}
                        <p className="text-xs text-slate-400 mt-2">
                            הקלד שאלה למטה כדי להתחיל,
                            <br />
                            או לחץ על <HelpCircle size={12} className="inline-block align-middle text-slate-500" /> בכותרת לדוגמאות ונושאים
                        </p>
                    </div>
                ) : (
                    // ---------- רשימת ההודעות ----------
                    messages.map((msg) => {
                        // האם זו בועת בוט במצב "סוכן עובד" - תוצג בלי מסגרת
                        const isAgentWorking = msg.sender === 'bot' && msg.currentAction && !msg.text;

                        return (
                            <div
                                key={msg.id}
                                className={
                                    isAgentWorking
                                        ? // מצב "סוכן עובד" - בלי מסגרת, בלי רקע, רק טקסט אפור
                                        'self-start text-slate-500 text-xs italic px-2'
                                        : // בועה רגילה - עם רקע, מסגרת, צל
                                        `p-3 rounded-2xl shadow-sm max-w-[90%] text-sm leading-relaxed ${msg.sender === 'bot'
                                            ? 'bg-white border border-slate-200 rounded-tr-none self-start text-slate-700'
                                            : 'bg-blue-600 rounded-tl-none self-end text-white'
                                        }`
                                }
                            >
                                {/* בועת בוט במצב "סוכן עובד" - מציג action מתחלף */}
                                {isAgentWorking ? (
                                    <div className="flex items-center gap-2 text-slate-500 py-1">
                                        {/* ספינר עדין מסתובב */}
                                        <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                        <span>{msg.currentAction}</span>
                                    </div>
                                ) : (() => {
                                // לוגיקת קיטוע: אם visibleChars מוגדר וקטן מהאורך - מקטעים
                                const hasMore =
                                    msg.visibleChars !== undefined &&
                                    msg.visibleChars < msg.text.length;
                                const displayText = hasMore
                                    ? msg.text.slice(0, msg.visibleChars)
                                    : msg.text;
                                return (
                                    <div>
                                        <div className="whitespace-pre-wrap">{displayText}</div>
                                        {hasMore && (
                                            <button
                                                onClick={() => expandMessage(msg.id)}
                                                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors flex items-center gap-1"
                                            >
                                                ⤵ המשך
                                                <span className="text-[10px] text-slate-400 font-normal">
                                                    ({msg.text.length - (msg.visibleChars ?? 0)} תווים נוספים)
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* תאריך ושעת השליחה - מוצג בכרטיס הודעת המשתמש */}
                            {msg.sender === 'user' && msg.timestamp && (
                                <div className="text-[10px] text-white/70 mt-1 text-left font-mono">
                                    {new Date(msg.timestamp).toLocaleTimeString('he-IL', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                    {' · '}
                                    {new Date(msg.timestamp).toLocaleDateString('he-IL', {
                                        day: '2-digit',
                                        month: '2-digit',
                                    })}
                                </div>
                            )}

                                {/* כפתורי פעולה (Like / Dislike / Copy) - רק על הודעות בוט שכבר יש להן טקסט */}
                                {msg.sender === 'bot' && msg.text && !msg.currentAction && (
                                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
                                        <Tip text="תשובה טובה">
                                            <button
                                                onClick={() => handleLike(msg.id)}
                                                disabled={msg.feedbackGiven !== undefined}
                                                className={`p-1 rounded transition-colors disabled:cursor-default ${msg.feedbackGiven === 'positive'
                                                    ? 'text-emerald-600 bg-emerald-50'
                                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-40'
                                                    }`}
                                            >
                                                <ThumbsUp size={14} />
                                            </button>
                                        </Tip>
                                        <Tip text="תשובה לא טובה">
                                            <button
                                                onClick={() => handleDislikeClick(msg.id)}
                                                disabled={msg.feedbackGiven !== undefined}
                                                className={`p-1 rounded transition-colors disabled:cursor-default ${msg.feedbackGiven === 'negative'
                                                    ? 'text-red-600 bg-red-50'
                                                    : 'text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40'
                                                    }`}
                                            >
                                                <ThumbsDown size={14} />
                                            </button>
                                        </Tip>
                                        {/* כפתור העתקה - מעתיק את הטקסט המלא של ההודעה ללוח */}
                                        <Tip text={copiedMessageId === msg.id ? 'הועתק!' : 'העתק תשובה'}>
                                            <button
                                                onClick={() => handleCopyMessage(msg)}
                                                className={`p-1 rounded transition-colors ${copiedMessageId === msg.id
                                                    ? 'text-blue-600 bg-blue-50'
                                                    : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                                                    }`}
                                            >
                                                {copiedMessageId === msg.id ? (
                                                    <Check size={14} />
                                                ) : (
                                                    <Copy size={14} />
                                                )}
                                            </button>
                                        </Tip>
                                        {msg.feedbackGiven && (
                                            <span className="text-[10px] text-slate-400 mr-1">
                                                תודה על המשוב
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* אזור הקלט - שדה טקסט + כפתור שליחה/עצירה לפי מצב */}
            <div className="p-3 bg-white border-t border-slate-100 flex-shrink-0">
                <div className="flex gap-2 items-center bg-slate-100 rounded-xl px-2 py-1">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        placeholder="כתוב שאלה לקבלת תמונת מצב עדכנית"
                        className="flex-1 bg-transparent border-none py-2 text-sm outline-none text-slate-800 min-w-0"
                    />

                    {/* כפתור דינמי: שליחה כשלא מייצר, עצירה כשמייצר - עם Radix Tooltip */}
                    {isGenerating ? (
                        <Tip text="עצור את יצירת התשובה" side="top">
                            <button
                                onClick={handleStop}
                                className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 flex-shrink-0"
                            >
                                <Square size={14} fill="currentColor" />
                            </button>
                        </Tip>
                    ) : (
                        <Tip text="שלח שאלה" side="top">
                            <button
                                onClick={handleSend}
                                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!inputText.trim()}
                            >
                                <Send size={16} />
                            </button>
                        </Tip>
                    )}
                </div>
            </div>

            {/* ---------- סיידבר היסטוריית שיחות (רכיב עצמאי) ---------- */}
            {/* לבטל את הפיצ'ר? פשוט הסר את 3 השורות הבאות + ה-state isHistoryOpen + הכפתור בכותרת */}
            <HistorySidebar
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                onConversationClick={(conversation) => {
                    // לעתיד: טעינת תוכן השיחה לפי session_id (יתווסף עם הראוט השני)
                    console.log('Selected conversation:', conversation);
                    setIsHistoryOpen(false);
                }}
            />

            {/* ---------- פופאפ מידע - Radix Dialog עם נגישות מלאה ---------- */}
            {/* יתרונות על פני div רגיל: Esc סוגר, focus trap, aria attributes, מקלדת */}
            <Dialog.Root open={isInfoOpen} onOpenChange={setIsInfoOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                    <Dialog.Content
                        dir="rtl"
                        className="fixed left-1/2 top-1/2 z-[90] w-[90vw] max-w-md max-h-[85vh] -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden focus:outline-none"
                    >
                        {/* כותרת */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-l from-blue-50 to-white flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <HelpCircle size={18} className="text-blue-600" />
                                <Dialog.Title className="font-bold text-slate-800">
                                    מידע ועזרה
                                </Dialog.Title>
                            </div>
                            <Tip text="סגור">
                                <button
                                    onClick={() => setIsInfoOpen(false)}
                                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </Tip>
                        </div>

                        {/* תיאור נסתר ל-screen readers (נגישות) */}
                        <Dialog.Description className="sr-only">
                            מידע על נושאים שניתן לשאול עליהם ושאלות לדוגמה לשימוש במערכת
                        </Dialog.Description>

                        {/* תוכן */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-5">
                            {/* נושאים */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <Target size={15} className="text-blue-600" />
                                    <h4 className="font-semibold text-sm text-slate-800">נושאים שניתן לשאול עליהם</h4>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {TOPICS.map((topic, i) => (
                                        <span
                                            key={i}
                                            className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium"
                                        >
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            </section>

                            {/* שאלות לדוגמה */}
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <Lightbulb size={15} className="text-amber-500" />
                                    <h4 className="font-semibold text-sm text-slate-800">שאלות לדוגמה</h4>
                                </div>
                                <p className="text-[11px] text-slate-500 mb-2">לחץ על שאלה כדי להעתיק אותה לאינפוט</p>
                                <div className="flex flex-col gap-2">
                                    {EXAMPLE_QUESTIONS.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setInputText(q);
                                                setIsInfoOpen(false);
                                                // מחכים שRadix Dialog יסיים לסגור (וייתן פוקוס לכפתור ❓)
                                                // ואז מעבירים פוקוס לאינפוט כדי שאפשר ללחוץ Enter לשליחה
                                                setTimeout(() => {
                                                    inputRef.current?.focus();
                                                }, 50);
                                            }}
                                            className="group text-right text-xs px-3 py-2 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg text-slate-700 hover:text-blue-700 transition-all shadow-sm flex items-start gap-2"
                                        >
                                            <ChevronLeft size={12} className="text-slate-300 group-hover:text-blue-500 mt-0.5 flex-shrink-0" />
                                            <span className="flex-1">{q}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* ---------- פופאפ Dislike - בחירת סיבה למשוב שלילי ---------- */}
            <Dialog.Root
                open={dislikingMessageId !== null}
                onOpenChange={(open) => {
                    // סגירה (open=false) מטריגרת שליחת משוב שלילי בלי סיבה
                    if (!open) handleDislikeClose();
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm" />
                    <Dialog.Content
                        dir="rtl"
                        className="fixed left-1/2 top-1/2 z-[90] w-[90vw] max-w-md max-h-[85vh] -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden focus:outline-none"
                    >
                        {/* כותרת */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-l from-red-50 to-white flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <ThumbsDown size={18} className="text-red-500" />
                                <Dialog.Title className="font-bold text-slate-800">
                                    מה לא היה טוב בתשובה?
                                </Dialog.Title>
                            </div>
                            <Tip text="סגור (ישלח משוב ללא סיבה)">
                                <button
                                    onClick={handleDislikeClose}
                                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </Tip>
                        </div>

                        <Dialog.Description className="sr-only">
                            בחירת סיבה למשוב שלילי על תשובת הבוט
                        </Dialog.Description>

                        {/* רשימת הסיבות */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            <p className="text-xs text-slate-500 mb-3">
                                בחר סיבה (אופציונלי) - המשוב יעזור לנו לשפר את המערכת
                            </p>

                            <div className="flex flex-col gap-2">
                                {FEEDBACK_REASONS.map((reason) => (
                                    <button
                                        key={reason}
                                        onClick={() => setSelectedReason(reason)}
                                        className={`text-right text-sm px-3 py-2 rounded-lg border transition-all ${selectedReason === reason
                                            ? 'border-red-500 bg-red-50 text-red-700 font-medium'
                                            : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/50 text-slate-700'
                                            }`}
                                    >
                                        {reason}
                                    </button>
                                ))}

                                {/* אופציית "אחר" - לוחצים ונפתח textarea */}
                                <button
                                    onClick={() => setSelectedReason(FEEDBACK_OTHER)}
                                    className={`text-right text-sm px-3 py-2 rounded-lg border transition-all ${selectedReason === FEEDBACK_OTHER
                                        ? 'border-red-500 bg-red-50 text-red-700 font-medium'
                                        : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/50 text-slate-700'
                                        }`}
                                >
                                    {FEEDBACK_OTHER} - פרט בטקסט חופשי
                                </button>

                                {/* textarea מופיע רק כש"אחר" נבחר */}
                                {selectedReason === FEEDBACK_OTHER && (
                                    <textarea
                                        value={otherReasonText}
                                        onChange={(e) => setOtherReasonText(e.target.value)}
                                        placeholder="ספר לנו מה לא היה טוב..."
                                        rows={3}
                                        className="w-full text-sm px-3 py-2 mt-1 border border-slate-300 rounded-lg outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200 resize-none"
                                        autoFocus
                                    />
                                )}
                            </div>
                        </div>

                        {/* כפתורי פעולה */}
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                            <button
                                onClick={handleDislikeClose}
                                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                            >
                                דלג (שלח ללא סיבה)
                            </button>
                            <button
                                onClick={handleDislikeSubmit}
                                disabled={
                                    selectedReason === FEEDBACK_OTHER && !otherReasonText.trim()
                                }
                                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                                שלח משוב
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );

    // ---------- הלייאאוט הראשי - 2 פאנלים שמתחלקים ב-100% ----------
    // dir="ltr" על הקונטיינר מונע מ-RTL להפוך את סדר ה-flex (לא משפיע על טקסט בפנים)
    return (
        <div
            dir="ltr"
            className={`h-full w-full flex ${isVertical ? 'flex-row' : 'flex-col'} overflow-hidden`}
        >
            {chatFirst && ChatPanel}

            {/* הפאנל השני - המפה. גודל מפורש כדי שהצ'אט לא יכסה אותה */}
            {!isMaximized && (
                <div style={mapStyle} className="overflow-hidden flex-shrink-0">
                    {children}
                </div>
            )}

            {!chatFirst && ChatPanel}
        </div>
    );
};

export default ChatLayout;
