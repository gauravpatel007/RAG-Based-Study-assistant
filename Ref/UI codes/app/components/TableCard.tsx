'use client';

import React from 'react';
import { cn } from "@/app/lib/utils";

export type TableStatus = 'EMPTY' | 'OCCUPIED' | 'SENT_TO_KITCHEN' | 'WAITING_PAYMENT';

interface TableCardProps {
  id: string;
  number: number;
  seats: number;
  status: TableStatus;
}

const TableCard: React.FC<TableCardProps> = ({ id, number, seats, status }) => {
  const getStatusStyles = (status: TableStatus) => {
    switch (status) {
      case 'EMPTY':
        return 'bg-tertiary-container text-on-tertiary-container';
      case 'OCCUPIED':
        return 'bg-secondary-container text-on-secondary-container';
      case 'SENT_TO_KITCHEN':
        return 'bg-tertiary-container text-on-tertiary-container opacity-80'; // Info variant
      case 'WAITING_PAYMENT':
        return 'bg-error-container text-on-error-container';
      default:
        return 'bg-surface-container text-on-surface';
    }
  };

  const getStatusLabel = (status: TableStatus) => {
    return status.replace(/_/g, ' ');
  };

  return (
    <div 
      onClick={() => console.log(`tableId: ${id}`)}
      className={cn(
        "bg-surface-container-low p-6 rounded-xl flex flex-col items-center justify-center gap-4 cursor-pointer",
        "hover:bg-surface-bright transition-all duration-200 aspect-square text-center",
        "shadow-sm hover:shadow-md active:scale-[0.98]"
      )}
    >
      <div className="text-headline-md font-bold text-primary font-headline">
        T-{number}
      </div>
      <div className="text-body-md text-on-surface-variant font-body">
        {seats} {seats === 1 ? 'Seat' : 'Seats'}
      </div>
      <div className={cn(
        "px-3 py-1 rounded-full text-label-sm font-medium uppercase tracking-wider",
        getStatusStyles(status)
      )}>
        {getStatusLabel(status)}
      </div>
    </div>
  );
};

export default TableCard;
