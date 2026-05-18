/**
 * Inline script that runs synchronously during HTML parse, before any landing
 * content paints. If the user is in a standalone (installed PWA) context,
 * redirect to /login — the landing page is marketing-only and shouldn't be
 * shown to users who already installed the app.
 *
 * Renders nothing visible. Place at the very top of the landing page render.
 */
export function PwaLandingGuard() {
  const script = `(function(){try{var s=window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches;var iosStandalone=window.navigator&&window.navigator.standalone===true;if(s||iosStandalone){window.location.replace('/login');}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
