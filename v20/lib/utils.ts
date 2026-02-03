import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// یک تابع هش ساده برای زمانی که crypto.subtle در دسترس نیست (مثل HTTP در موبایل)
async function fallbackSha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  // تبدیل ساده برای محیط توسعه (Simple hash for dev environment)
  // توجه: در پروداکشن واقعی باید همیشه از HTTPS استفاده کنید.
  let hash = 0;
  for (let i = 0; i < msgBuffer.length; i++) {
    const char = msgBuffer[i];
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // تبدیل به رشته هگز برای شبیه‌سازی رفتار SHA-256
  const hex = Math.abs(hash).toString(16).padStart(64, '0'); 
  return hex;
}

export const secureHash = async (text: string) => {
  if (!text) return '';
  try {
    const cleanText = text.trim();
    
    // بررسی وجود crypto.subtle (فقط در HTTPS و Localhost موجود است)
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(cleanText);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
        // استفاده از روش جایگزین برای جلوگیری از کرش در موبایل/HTTP
        console.warn("Crypto API not available (likely non-secure context). Using fallback hash.");
        return await fallbackSha256(cleanText);
    }
  } catch (e) {
    console.error("Hashing failed, using fallback:", e);
    return await fallbackSha256(text.trim());
  }
};

export const generateGhostEmail = (hash: string) => `${hash}@anon.work`;

export const copyToClipboard = async (text: string) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      return new Promise((resolve) => {
        const successful = document.execCommand('copy');
        textArea.remove();
        resolve(successful);
      });
    }
  } catch (err) {
    console.error("Copy failed", err);
    return false;
  }
};