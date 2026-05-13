import * as RadixTooltip from '@radix-ui/react-tooltip';
import React from 'react';

/**
 * רכיב Tooltip שעוטף ילד יחיד ומראה טקסט עזרה במעבר עכבר.
 * מבוסס על Radix UI - תומך בנגישות, מקלדת, ו-RTL.
 *
 * שימוש:
 * <Tip text="עגן שמאל">
 *     <button>...</button>
 * </Tip>
 */
interface TipProps {
    children: React.ReactElement;
    text: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tip: React.FC<TipProps> = ({ children, text, side = 'bottom' }) => (
    <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
            <RadixTooltip.Content
                side={side}
                sideOffset={6}
                className="bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-md shadow-xl z-[100] select-none data-[state=delayed-open]:animate-in data-[state=closed]:animate-out"
            >
                {text}
                <RadixTooltip.Arrow className="fill-slate-900" />
            </RadixTooltip.Content>
        </RadixTooltip.Portal>
    </RadixTooltip.Root>
);
