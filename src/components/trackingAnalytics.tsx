import Script from 'next/script';

type TrackingAnalyticsProps = {
  // Sin fallback a env vars globales: cada sitio (tenant o default) debe
  // pasar explícitamente lo suyo. Si no se pasa nada, no se renderiza nada.
  pixelId?: string | null;
  googleTagId?: string | null;
  domainVerification?: string | null;
};

// Se usa una vez por "sitio" (por tenant, desde
// tenant-site/[subdomain]/layout.tsx) para no duplicar el init del pixel ni
// el PageView cuando conviven varios sitios en la misma instancia de Next.
export default function TrackingAnalytics({
  pixelId,
  googleTagId,
  domainVerification,
}: TrackingAnalyticsProps = {}) {
  return (
    <>
      {domainVerification && <meta name="facebook-domain-verification" content={domainVerification} />}

      {pixelId && (
        <>
          <Script id="fb-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{__html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `}} />
          <noscript dangerouslySetInnerHTML={{__html: `
            <img
              height="1" width="1" style="display:none"
              src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"
            />
          `}} />
        </>
      )}

      {googleTagId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${googleTagId}`} strategy="afterInteractive" />
          <Script id="google-tag" strategy="afterInteractive" dangerouslySetInnerHTML={{__html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${googleTagId}');
          `}} />
        </>
      )}
    </>
  )
}
