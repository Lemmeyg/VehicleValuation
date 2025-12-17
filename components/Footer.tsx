import Link from 'next/link'
import { Facebook, Twitter, Linkedin } from 'lucide-react'

export default function Footer() {
  const footerLinks = {
    company: [
      { name: 'About Us', href: '/about' },
      { name: 'Contact', href: '/contact' },
      { name: 'Careers', href: '/careers' },
    ],
    resources: [
      { name: 'Vehicle Resources', href: '#resources' },
      { name: 'Expert Network', href: '#experts' },
      { name: 'Blog', href: '/blog' },
    ],
    legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Refund Policy', href: '/refund' },
    ],
  }

  return (
    <footer className="bg-slate-950 border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Column */}
          <div className="col-span-1">
            <h3 className="text-xl font-bold text-white mb-4">Vehicle Valuation</h3>
            <p className="text-slate-400 text-sm mb-4">
              Professional vehicle valuation reports backed by comprehensive market data.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-slate-400 hover:text-primary-500 transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-primary-500 transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-primary-500 transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map(link => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-slate-400 hover:text-primary-500 transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              {footerLinks.resources.map(link => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-slate-400 hover:text-primary-500 transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map(link => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-slate-400 hover:text-primary-500 transition-colors text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 text-center">
          <p className="text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} Vehicle Valuation SaaS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
