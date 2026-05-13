// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { motion } from 'framer-motion';
// import { X, Minus, Send } from 'lucide-react';

// const ChatContainer = () => {
//     const navigate = useNavigate();
//     const [isMinimized, setIsMinimized] = useState(false);

//     return (
//         <motion.div
//             drag
//             initial={{ opacity: 0, scale: 0.9 }}
//             animate={{
//                 opacity: 1,
//                 scale: 1,
//                 width: isMinimized ? '200px' : '400px',
//                 height: isMinimized ? '60px' : '500px'
//             }}
//             className="fixed bottom-6 right-6 bg-white border border-gray-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col z-50"
//         >
//             <div className="p-4 bg-gray-50 border-b flex justify-between items-center cursor-grab active:cursor-grabbing">
//                 <span className="font-bold">צאט מערכת</span>
//                 <div className="flex gap-2">
//                     <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-gray-200 rounded"><Minus size="{16}" /></button>
//                     <button onClick={() => navigate('/')} className="p-1 hover:bg-red-50 text-red-500 rounded"><X size="{16}" /></button>
//                 </div>
//             </div>

//             {!isMinimized && (
//                 <>
//                     <div className="flex-1 p-4 overflow-y-auto bg-white">
//                         <div className="bg-blue-50 p-3 rounded-lg text-sm mb-2 max-w-[80%]">שלום! איך אפשר לעזור?</div>
//                     </div>
//                     <div className="p-4 border-t flex gap-2">
//                         <input className="flex-1 border rounded-md px-3 py-1 outline-none focus:border-blue-500" placeholder="הקלד הודעה..." />
//                         <button className="bg-blue-600 text-white p-2 rounded-md"><Send size="{16}" /></button>
//                     </div>
//                 </>
//             )}
//         </motion.div>
//     );
// };

// export default ChatContainer;