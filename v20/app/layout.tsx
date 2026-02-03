import type { Metadata } from "next";
import "./globals.css";
// وارد کردن کامپوننت چت
import SupportChatWidget from '../components/ui/SupportChatWidget';

export const metadata: Metadata = {
  title: "Nobel Mind Platform",
  description: "Anonymous Freelance Marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* محتوای صفحات مختلف سایت */}
        {children}
        
        {/* ویجت چت که در تمام صفحات نمایش داده می‌شود */}
        <SupportChatWidget />
      </body>
    </html>
  );
}