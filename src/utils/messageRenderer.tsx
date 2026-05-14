import React, { useState } from 'react';
import { MapPin, Check } from 'lucide-react';
import type { Entity } from '../api/types';

/**
 * ============================================================
 * messageRenderer - עיבוד טקסט הודעה עם זיהוי אינטראקטיבי
 * ============================================================
 *
 * מזהה שני סוגים של "נתונים מובלעים" בתוך טקסט הבוט והופך אותם
 * לבועות לחיצות:
 *
 *   1. **שמות ישויות** (כוח א, מטרה X, מנחת אלפא וכו') - מ-entities array.
 *      לחיצה כרגע: console.log + אנימציה. בעתיד: callback למפה.
 *
 *   2. **קואורדינטות** (נ.צ - לדוגמה "32.0853, 34.7818").
 *      לחיצה: העתקה ללוח (clipboard).
 *
 * ⚠️ ====== הערה חשובה: ======
 * **החיבור למפה לא ממומש כרגע**. לחיצה על EntityChip רק:
 *   1. מציגה אנימציה ויזואלית קצרה
 *   2. רושמת console.log עם פרטי הישות
 * בעתיד יתווסף callback `onEntityClick` ל-ChatWindow שדרכו המפה
 * תקבל את האירועים. CoordChip לעומת זאת **כן** מועתק ללוח (עובד מלא).
 * ============================================================
 */

// ============================================================
// תבניות וקבועים - קל לערוך/להוסיף
// ============================================================

/**
 * תבנית קואורדינטות - שני מספרים עשרוניים מופרדים בפסיק.
 * מתאים: "32.0853, 34.7818" / "32.08,34.77"
 * לא מתאים: "10:30, 11:45" (שעות) / "300, 450" (ללא נקודה עשרונית)
 */
const COORD_PATTERN = /(\d+\.\d+\s*,\s*\d+\.\d+)/g;

/** צבעי chip לפי שכבת הישות (layer) */
type ColorPalette = { bg: string; text: string; border: string; hover: string };
// פלטה מאופקת - גוונים יוקרתיים, פחות "צעקניים", מתאימים לרקע לבן עדין
const LAYER_COLORS: Record<string, ColorPalette> = {
    targets: { bg: 'bg-rose-50/70', text: 'text-rose-800', border: 'border-rose-200/80', hover: 'hover:bg-rose-100/80 hover:border-rose-300' },
    forces: { bg: 'bg-slate-100/80', text: 'text-slate-800', border: 'border-slate-300/70', hover: 'hover:bg-slate-200/80 hover:border-slate-400' },
    'landing-pads': { bg: 'bg-teal-50/70', text: 'text-teal-800', border: 'border-teal-200/80', hover: 'hover:bg-teal-100/80 hover:border-teal-300' },
    areas: { bg: 'bg-amber-50/70', text: 'text-amber-800', border: 'border-amber-200/80', hover: 'hover:bg-amber-100/80 hover:border-amber-300' },
    routes: { bg: 'bg-violet-50/70', text: 'text-violet-800', border: 'border-violet-200/80', hover: 'hover:bg-violet-100/80 hover:border-violet-300' },
};
const DEFAULT_COLORS: ColorPalette = { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200', hover: 'hover:bg-stone-200 hover:border-stone-400' };

// ============================================================
// CoordChip - בועה לחיצה של קואורדינטות (העתקה ללוח)
// ============================================================

const CoordChip: React.FC<{ text: string }> = ({ text }) => {
    const [copied, setCopied] = useState(false);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(text.trim());
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            console.warn('Failed to copy coordinates:', err);
        }
    };

    return (
        <code
            onClick={handleClick}
            title={copied ? 'הועתק!' : 'לחץ להעתקת הקואורדינטות'}
            className={`inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded font-mono text-[0.85em] cursor-pointer transition-all select-text border tracking-wider ${copied
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-stone-100/80 text-stone-700 border-stone-300/70 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-800'
                }`}
        >
            <span>{text.trim()}</span>
            {copied && <Check size={11} strokeWidth={3} />}
        </code>
    );
};

// ============================================================
// EntityChip - בועה לחיצה של ישות (כרגע: console.log, בעתיד: מפה)
// ============================================================

interface EntityChipProps {
    entity: Entity;
    label: string;
}

const EntityChip: React.FC<EntityChipProps> = ({ entity, label }) => {
    const [clicked, setClicked] = useState(false);
    const colors = (entity.layer && LAYER_COLORS[entity.layer]) || DEFAULT_COLORS;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setClicked(true);
        setTimeout(() => setClicked(false), 600);

        // ⚠️ TODO: החיבור האמיתי למפה לא ממומש כרגע.
        // בעתיד כאן יקרא callback `onEntityClick(entity)` שיועבר
        // מ-App.tsx → ChatWindow → renderMessageText → כאן.
        console.log('🗺️ Entity clicked (not connected to map yet):', entity);
    };

    return (
        <button
            onClick={handleClick}
            title={`${entity.layer || 'ישות'} • לחיצה תפתח במפה (לא מחובר עדיין)`}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md font-medium text-[0.9em] cursor-pointer transition-all border ${colors.bg} ${colors.text} ${colors.border} ${colors.hover} ${clicked ? 'scale-95' : ''}`}
        >
            <MapPin size={11} strokeWidth={2.5} />
            <span>{label}</span>
        </button>
    );
};

// ============================================================
// renderMessageText - הפונקציה הציבורית
// ============================================================

/** מבריח (escape) תווים מיוחדים בתוך regex */
const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** סוג פנימי לחלקים שמופיעים בתוך הטקסט המעובד */
type Part = string | React.ReactNode;

/**
 * עובר על מערך של Parts ומחלף כל מחרוזת לחלקים לפי regex + map.
 */
const splitParts = (
    parts: Part[],
    pattern: RegExp,
    transform: (match: string, key: string) => React.ReactNode,
): Part[] => {
    const result: Part[] = [];
    parts.forEach((part, partIdx) => {
        if (typeof part !== 'string') {
            result.push(part);
            return;
        }
        const subParts = part.split(pattern);
        subParts.forEach((sub, subIdx) => {
            // אינדקסים אי-זוגיים בתוצאה של split עם capture group = ההתאמות
            const isMatch = subIdx % 2 === 1;
            if (isMatch && sub) {
                result.push(transform(sub, `m-${partIdx}-${subIdx}`));
            } else if (sub) {
                result.push(sub);
            }
        });
    });
    return result;
};

/**
 * מקבל טקסט גולמי + רשימת ישויות, ומחזיר ReactNode עם:
 *   - שמות ישויות מודגשות כ-chips צבעוניים לחיצים
 *   - קואורדינטות מודגשות כ-chips של קוד (לחיצה מעתיקה ללוח)
 */
export const renderMessageText = (text: string, entities?: Entity[]): React.ReactNode => {
    let parts: Part[] = [text];

    // שלב 1: זיהוי שמות ישויות (אם יש entities עם name)
    const namedEntities = (entities ?? []).filter(
        (e): e is Entity & { name: string } => Boolean(e.name),
    );
    if (namedEntities.length > 0) {
        // ממוין מאורך לקצר - כדי שהתאמות ארוכות יעדיפו על קצרות (avoiding partial)
        const sorted = [...namedEntities].sort((a, b) => b.name.length - a.name.length);
        const entityPattern = new RegExp(
            `(${sorted.map((e) => escapeRegex(e.name)).join('|')})`,
            'g',
        );
        parts = splitParts(parts, entityPattern, (match, key) => {
            const matchedEntity = namedEntities.find((e) => e.name === match)!;
            return <EntityChip key={key} entity={matchedEntity} label={match} />;
        });
    }

    // שלב 2: זיהוי קואורדינטות בחלקי הטקסט שנותרו
    parts = splitParts(parts, COORD_PATTERN, (match, key) => (
        <CoordChip key={key} text={match} />
    ));

    // עוטפים מחרוזות שנותרו ב-Fragment עם key לזיהוי תקין
    return parts.map((part, i) => {
        if (typeof part === 'string') {
            return <React.Fragment key={`s-${i}`}>{part}</React.Fragment>;
        }
        return part;
    });
};
