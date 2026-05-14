import { BrowserRouter as Router } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import ChatWindow from './components/Chat/ChatWindow';
import MapWindow from './components/Chat/MapWindow';

const AppContent = () => {
  return (
    // רקע יוקרתי - גוון בז' עדין שמרגיש פרימיום, לא טכני
    <div
      className="h-screen w-screen overflow-hidden p-4 bg-[radial-gradient(circle_at_top_left,_#f5f1ea_0%,_#ebe6da_100%)]"
      dir="rtl"
    >
      {/* קונטיינר ראשי - מסגרת מסוגננת עם צל עמוק ופינות מאוד מעוגלות */}
      <div className="h-full w-full rounded-[20px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15),0_8px_20px_-5px_rgba(0,0,0,0.08)] overflow-hidden border border-stone-200/60 bg-white">
        <Tooltip.Provider delayDuration={300} skipDelayDuration={100}>
          <ChatWindow>
            <MapWindow />
          </ChatWindow>
        </Tooltip.Provider>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
