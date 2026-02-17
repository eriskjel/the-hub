import Script from "next/script";

const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
`;

export default function ThemeInitializer() {
    return (
        <Script id="theme-initializer" strategy="beforeInteractive">
            {themeInitScript}
        </Script>
    );
}
