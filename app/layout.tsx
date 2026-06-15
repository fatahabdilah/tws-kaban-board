import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { TooltipProvider } from '@/components/ui/tooltip';

const neueMontreal = localFont({
  src: [
    { path: '../public/fonts/NeueMontreal-Light.otf', weight: '300' },
    { path: '../public/fonts/NeueMontreal-Regular.otf', weight: '400' },
    { path: '../public/fonts/NeueMontreal-Medium.otf', weight: '500' },
    { path: '../public/fonts/NeueMontreal-Bold.otf', weight: '700' },
  ],
  variable: '--font-neue-montreal',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kanban — Board',
  description: 'Trello-like Kanban board',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${neueMontreal.variable} h-full antialiased`}>
      <body className="min-h-screen" suppressHydrationWarning>
        <ToastProvider>
          <ConfirmProvider>
            <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
