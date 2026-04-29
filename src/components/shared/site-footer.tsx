import Link from "next/link";
import Image from "next/image";

const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      { label: "Generator", href: "/generate" },
      { label: "Plant library", href: "/#library" },
      { label: "Gallery", href: "/gallery" },
      { label: "Pro dashboard", href: "/dashboard" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "DIY guides", href: "/guides" },
      { label: "Plant encyclopedia", href: "/encyclopedia" },
      { label: "Pricing", href: "/pricing" },
      { label: "API docs", href: "/api-docs" },
      { label: "Help center", href: "/help" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
      { label: "For pros", href: "/#audience" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div className="site-footer-brand">
          <Image
            src="/landing/logo.png"
            alt="Landscaip"
            width={128}
            height={22}
            className="site-footer-logo"
          />
          <p>
            AI landscape design for the front porch, the back fence, and every
            square foot of green in between.
          </p>
          <div className="site-footer-social">
            <a href="https://instagram.com" aria-label="Instagram">
              IG
            </a>
            <a href="https://youtube.com" aria-label="YouTube">
              YT
            </a>
            <a href="https://pinterest.com" aria-label="Pinterest">
              Pi
            </a>
            <a href="https://tiktok.com" aria-label="TikTok">
              TT
            </a>
          </div>
        </div>
        {FOOTER_LINKS.map((col) => (
          <div className="site-footer-col" key={col.heading}>
            <h5>{col.heading}</h5>
            <ul>
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Landscaip, Inc.</span>
        <span className="site-footer-legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/status">Status</Link>
        </span>
      </div>
    </footer>
  );
}
