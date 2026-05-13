import React from 'react'
import { Map, MapPin, Compass } from 'lucide-react'

const MapWindow: React.FC = () => {
    return (
        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
            {/* רקע דקורטיבי - רשת עדינה שמדמה מפה */}
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />

            {/* מרכז התוכן */}
            <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
                <div className="relative">
                    <div className="w-24 h-24 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-blue-500">
                        <Map size={42} className="text-blue-600" />
                    </div>
                    <MapPin
                        size={28}
                        className="absolute -top-2 -right-2 text-red-500 drop-shadow-lg"
                        fill="currentColor"
                    />
                </div>

                <div>
                    <h2 className="text-3xl font-bold text-slate-700">אזור המפה</h2>
                    <p className="text-slate-500 text-sm mt-2 max-w-xs">
                        כאן תוצג המפה האינטראקטיבית עם המיקומים והמסלולים
                    </p>
                </div>

                <div className="flex items-center gap-2 text-slate-400 text-xs mt-2">
                    <Compass size={14} />
                    <span>Workspace</span>
                </div>
            </div>
        </div>
    )
}

export default MapWindow;
