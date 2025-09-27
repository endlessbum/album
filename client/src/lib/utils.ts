import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function createWebSocketUrl(path: string = "/ws"): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  
  // Always use window.location.host if available, don't try to be clever
  // In Replit and similar environments, the host includes the proper domain/port
  const host = window.location.host;
  
  if (!host) {
    console.warn("No host available for WebSocket connection");
    // Fallback with explicit port if needed
    const port = window.location.port || (protocol === "wss:" ? "443" : "80");
    return `${protocol}//localhost:${port}${path}`;
  }
  
  return `${protocol}//${host}${path}`;
}
