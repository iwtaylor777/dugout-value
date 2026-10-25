"use client";

/**
 * Google Analytics 4 with Consent Mode v2.
 *
 * - Loads only on the production hosts (www.dugoutvalue.com, dugoutvalue.com), so local builds
 *   and Vercel previews never send data.
 * - Visitors whose browser time zone is in Europe (EEA, UK, Switzerland) see a small banner and
 *   GA is not loaded at all until they accept ("basic" consent mode). Declining is remembered.
 * - Everyone else is measured without a banner. As a backstop, the consent default is also
 *   "denied" for EEA/UK/CH by Google's own IP geolocation, so a European visitor with a
 *   non-European time zone sends no cookies either.
 * - No advertising features: ad_storage, ad_user_data and ad_personalization stay denied.
 *
 * The Measurement ID can be overridden with NEXT_PUBLIC_GA_ID.
 */

import Script from "next/script";
import Link from "next/link";
import { useSyncExternalStore } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-73XXLBN1TM";
const PRODUCTION_HOSTS = ["www.dugoutvalue.com", "dugoutvalue.com"];
const CONSENT_KEY = "dv_analytics_consent"; // "granted" | "denied"

/** EEA + UK + Switzerland, as ISO 3166-1 alpha-2 codes, for Google's region-scoped consent default. */
const CONSENT_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
];

/** True when the browser's time zone places the visitor in Europe (a client-side proxy for EEA/UK/CH). */
function inConsentRegion(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return tz.startsWith("Europe/") || tz === "Atlantic/Reykjavik" || tz === "Atlantic/Canary" || tz === "Atlantic/Madeira" || tz === "Atlantic/Azores" || tz === "Atlantic/Faroe";
  } catch {
    return false;
  }
}

let sessionChoice: string | null = null; // used when localStorage is unavailable (private mode)
function readConsent(): string | null {
  try { return window.localStorage.getItem(CONSENT_KEY) ?? sessionChoice; } catch { return sessionChoice; }
}
function writeConsent(value: "granted" | "denied") {
  sessionChoice = value;
  try { window.localStorage.setItem(CONSENT_KEY, value); } catch { /* private mode: choice lasts this page only */ }
  listeners.forEach(listener => listener());
}

type Mode = "off" | "load" | "ask";

// A tiny external store: the mode depends on the host, the saved choice and the time zone, which are only known in
// the browser. The server snapshot is "off", so nothing analytics-related is in the static HTML.
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function currentMode(): Mode {
  if (!PRODUCTION_HOSTS.includes(window.location.hostname)) return "off";
  const saved = readConsent();
  if (saved === "denied") return "off";
  return saved === "granted" || !inConsentRegion() ? "load" : "ask";
}

export function Analytics() {
  const mode = useSyncExternalStore(subscribe, currentMode, () => "off" as Mode);
  const accept = () => writeConsent("granted");
  const decline = () => writeConsent("denied");

  // Granted if this visitor accepted the banner; otherwise the region-scoped default decides.
  const accepted = mode === "load" && readConsent() === "granted";

  return <>
    {mode === "load" && <>
      <Script id="ga-consent" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
        gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', region: ${JSON.stringify(CONSENT_REGIONS)} });
        ${accepted ? "gtag('consent', 'update', { analytics_storage: 'granted' });" : ""}
        gtag('set', 'ads_data_redaction', true);
        gtag('js', new Date());
        gtag('config', '${GA_ID}', { allow_google_signals: false, allow_ad_personalization_signals: false });
      `}</Script>
      <Script id="ga-loader" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
    </>}
    {mode === "ask" && <div className="consent-banner" role="dialog" aria-live="polite" aria-label="Analytics consent">
      <p>Dugout Value uses Google Analytics to count visits and see which pieces people read. No ads, no tracking across sites. <Link href="/privacy">Privacy</Link></p>
      <div className="consent-actions">
        <button type="button" onClick={decline}>Decline</button>
        <button type="button" className="consent-accept" onClick={accept}>Accept</button>
      </div>
    </div>}
  </>;
}

/** Send a custom GA4 event if analytics is loaded; a no-op otherwise. */
export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag === "function") w.gtag("event", name, params);
}
