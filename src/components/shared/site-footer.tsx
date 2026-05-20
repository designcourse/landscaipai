import Link from "next/link";
import Image from "next/image";

const FOOTER_LINKS = [
  {
    heading: "Resources",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
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
          <Link href="/contact">Contact</Link>
        </span>
      </div>
    </footer>
  );
}
