import React from 'react';
import { cn } from "@/app/lib/utils";

const SessionHealthBar = () => {
  return (
    <div className={cn(
      "bg-surface-container-low p-4 xl:p-6 rounded-xl flex items-center justify-between mb-6 shadow-sm",
      "font-body"
    )}>
      <div className="flex flex-col">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Revenue</span>
        <span className="text-headline-lg font-bold text-primary font-headline">$0</span>
      </div>
      <div className="flex flex-col text-center">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Orders</span>
        <span className="text-headline-lg font-bold text-primary font-headline">0</span>
      </div>
      <div className="flex flex-col text-end">
        <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Avg</span>
        <span className="text-headline-lg font-bold text-primary font-headline">$0</span>
      </div>
    </div>
  );
};

export default SessionHealthBar;
