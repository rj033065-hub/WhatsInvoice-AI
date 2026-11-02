import type { Metadata } from 'next';
import './globals.css';
import { RouteTransition } from '@/components/motion/RouteTransition';
import { SmoothScroll } from '@/components/motion/SmoothScroll';

export const metadata: Metadata = {
  title: 'WhatsInvoice AI — Invoice from WhatsApp Messages',
  description:
    'Turn messy customer WhatsApp messages into accurate, editable, printable invoices in seconds.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-background text-text antialiased">
        <SmoothScroll>
          <RouteTransition>{children}</RouteTransition>
        </SmoothScroll>
      </body>
    </html>
  );
}
