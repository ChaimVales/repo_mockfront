import React, { useEffect, useState } from 'react';
import { X, MessageSquare, Loader2 } from 'lucide-react';
import { getHistory } from '../../api/zchatApi';
import type { ConversationSummary } from '../../api/types';



interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onConversationClick?: (conversation: ConversationSummary) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
    isOpen,
    onClose,
    onConversationClick,
}) => {
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [userPersonalNumber, setUserPersonalNumber] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        const loadHistory = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getHistory();
                if (!cancelled) {
                    setConversations(data.conversations);
                    setUserPersonalNumber(data.user_personal_number);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'שגיאה בטעינת היסטוריה');
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadHistory();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    return (
        <>
            {/* רקע - לחיצה סוגרת */}
            <div
                onClick={onClose}
                className={`absolute inset-0 z-40 bg-[#0f1419]/30 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            />

            {/* הסיידבר - מחליק מימין עם עיצוב יוקרתי */}
            <aside
                dir="rtl"
                className={`absolute right-0 top-0 bottom-0 z-50 w-72 max-w-[85%] bg-white shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.15)] border-l border-stone-200/60 flex flex-col transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* כותרת - גוון כהה תואם */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-200/70 bg-gradient-to-l from-[#1a1f2e] to-[#0f1419] text-stone-100 flex-shrink-0">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <MessageSquare size={16} className="text-amber-400" strokeWidth={1.5} />
                            <h3 className="font-light text-[15px] tracking-wide">היסטוריית שיחות</h3>
                        </div>
                        {userPersonalNumber && (
                            <span className="text-[10px] text-stone-400 mt-0.5 mr-6 font-mono">
                                {userPersonalNumber}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded-md text-stone-400 hover:text-stone-100 transition-colors"
                        title="סגור"
                    >
                        <X size={16} strokeWidth={1.5} />
                    </button>
                </div>

                {/* תוכן */}
                <div className="flex-1 overflow-y-auto p-2 bg-stone-50/30">
                    {isLoading && (
                        <div className="flex items-center justify-center gap-2 py-12 text-stone-500 text-sm font-light">
                            <Loader2 size={16} className="animate-spin text-amber-600" strokeWidth={1.5} />
                            <span className="tracking-wide">טוען היסטוריה...</span>
                        </div>
                    )}

                    {error && (
                        <div className="px-3 py-3 text-xs text-rose-700 bg-rose-50/80 border border-rose-200/70 rounded-lg font-light">
                            ⚠️ {error}
                        </div>
                    )}

                    {!isLoading && !error && conversations.length === 0 && (
                        <div className="text-center py-12 text-sm text-stone-400 font-light tracking-wide">
                            אין שיחות קודמות
                        </div>
                    )}

                    {!isLoading && !error && conversations.length > 0 && (
                        <ul className="flex flex-col gap-1">
                            {conversations.map((conv) => (
                                <li key={conv.session_id}>
                                    <button
                                        onClick={() => onConversationClick?.(conv)}
                                        className="w-full text-right px-3 py-2.5 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200/70 transition-all flex items-start gap-2.5 group"
                                    >
                                        <MessageSquare
                                            size={14}
                                            className="text-stone-300 group-hover:text-amber-600 mt-0.5 flex-shrink-0 transition-colors"
                                            strokeWidth={1.5}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="truncate text-[13px] text-stone-700 group-hover:text-stone-900 font-light tracking-wide">
                                                {conv.summary}
                                            </div>
                                            <div className="text-[9px] text-stone-400 truncate font-mono mt-1 tracking-wider">
                                                {conv.session_id}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </aside>
        </>
    );
};
