import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  
  try {
    // Try parsing as ISO string first
    let date = parseISO(dateString);
    
    // If that doesn't work, try regular Date constructor
    if (!isValid(date)) {
      date = new Date(dateString);
    }
    
    // If still invalid, return the original string
    if (!isValid(date)) {
      return dateString;
    }
    
    return format(date, 'MMM d, yyyy, h:mm a');
  } catch {
    return dateString;
  }
}

