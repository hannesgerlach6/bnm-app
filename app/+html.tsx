import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no"
        />

        {/* PWA – Theme & Branding */}
        <meta name="theme-color" content="#0A3A5A" />
        <meta name="application-name" content="BNM" />
        <meta name="description" content="BNM – Betreuung neuer Muslime. Mentoring-Programm für Konvertierte." />

        {/* PWA – iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BNM" />

        {/* PWA – Android Chrome */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* PWA – Windows */}
        <meta name="msapplication-TileColor" content="#0A3A5A" />

        {/* Web App Manifest */}
        <link rel="manifest" href="/manifest.json" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root { height: 100%; margin: 0; padding: 0; overflow: hidden; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
          input, textarea, select { font-size: 16px !important; } /* Verhindert Auto-Zoom auf iOS */
          * { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
          /* Smooth scroll für Mobile Web */
          [data-testid="scroll-view"] { -webkit-overflow-scrolling: touch; }
          /* PWA safe areas */
          #root { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
