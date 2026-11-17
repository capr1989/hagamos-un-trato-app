import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Hagamos un Trato — preparación técnica',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
