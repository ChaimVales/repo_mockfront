import React from 'react'
import { Compass, Sparkles } from 'lucide-react'


const BACKGROUND_IMAGE_URL =
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1600&q=85&auto=format&fit=crop';

const MapWindow: React.FC = () => {
    return (
        <div className="h-full w-full relative overflow-hidden bg-stone-900">

            <img
                src={BACKGROUND_IMAGE_URL}
                alt="רקע"
                className="absolute inset-0 w-full h-full object-cover select-none"
                draggable={false}
            />

            {/* שכבת overlay - גרדיאנט כהה עדין לעומק ולקריאות הבאנרים */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#0f1419]/30 via-transparent to-[#0f1419]/10 pointer-events-none" />

            {/* באנר עליון-ימני - אזור התצוגה */}
            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg ring-1 ring-stone-200/80 px-3 py-2 pointer-events-none">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-600" strokeWidth={1.8} />
                    <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-stone-800 tracking-wide leading-tight">
                            אזור התצוגה
                        </span>
                        <span className="text-[9px] text-stone-500 tracking-wider mt-0.5 font-light uppercase">
                            Premium
                        </span>
                    </div>
                </div>
            </div>

            {/* באנר תחתון-שמאלי - Workspace */}
            <div className="absolute bottom-3 left-3 bg-[#0f1419]/85 backdrop-blur-sm text-stone-100 rounded-lg shadow-lg px-3 py-1.5 pointer-events-none">
                <div className="flex items-center gap-1.5">
                    <Compass size={12} strokeWidth={1.5} className="text-amber-400" />
                    <span className="text-[10px] tracking-[0.2em] uppercase font-light">
                        Workspace
                    </span>
                </div>
            </div>
        </div>
    )
}

export default MapWindow;
