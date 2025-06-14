import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if a string is a valid UUID
 * @param str String to check
 * @returns True if the string is a valid UUID
 */
export function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function getStorageUrl(url: string | undefined): string {
  if (!url) return '';
  
  // If it's already a full URL, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a relative path, prepend the Supabase storage URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('VITE_SUPABASE_URL is not defined');
    return url;
  }
  
  // Remove any leading slashes
  const cleanPath = url.startsWith('/') ? url.slice(1) : url;
  
  // Construct the full URL
  // Use a CORS proxy or direct URL
  return `${cleanPath}`;
}