import './globals.css';

export const metadata = { title: 'Atlas — Next.js example' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
