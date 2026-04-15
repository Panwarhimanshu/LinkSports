import Link from 'next/link';
import { Trophy, Users, Briefcase, Search, Star, Shield, ArrowRight, CheckCircle } from 'lucide-react';
import Logo from '@/components/shared/Logo';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/listings" className="text-sm font-medium text-gray-600 hover:text-gray-900">Opportunities</Link>
            <Link href="/jobs" className="text-sm font-medium text-gray-600 hover:text-gray-900">Jobs</Link>
            <Link href="/search" className="text-sm font-medium text-gray-600 hover:text-gray-900">Network</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2">Login</Link>
            <Link href="/auth/register" className="btn-primary text-sm">Join Free</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-blue-700/50 border border-blue-500/50 rounded-full px-4 py-1.5 text-sm font-medium text-blue-200 mb-6">
              <Star className="w-4 h-4" />
              India's First Sports Professional Network
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              No talent goes undiscovered because of their{' '}
              <span className="text-yellow-400">pincode.</span>
            </h1>
            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              Connect athletes, coaches, and sports organizations. Build your Sports CV, discover trials, tournaments, and job opportunities across India.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/auth/register?role=athlete" className="flex items-center justify-center gap-2 bg-white text-brand font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors">
                I'm an Athlete <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/auth/register?role=organization" className="flex items-center justify-center gap-2 bg-blue-600 border border-blue-400 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-500 transition-colors">
                I'm an Organization <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '1M+', label: 'Athletes Across India' },
              { value: '500K+', label: 'Coaches & Trainers' },
              { value: '10K+', label: 'Sports Academies' },
              { value: '₹50', label: 'Per Listing Only' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-brand">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Everything You Need in Sports</h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">From building your sports identity to landing your next opportunity — LinkSports has it all.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: 'Sports CV & Profiles', desc: 'Build a professional digital identity with achievements, media, and career history. Download as PDF.', color: 'bg-blue-50 text-blue-600' },
              { icon: Search, title: 'Find Trials & Tournaments', desc: 'Discover and apply to trials, events, and tournaments across India. Never miss an opportunity.', color: 'bg-green-50 text-green-600' },
              { icon: Briefcase, title: 'Sports Job Board', desc: 'Find coaching positions, PE teacher jobs, and sports professional roles with one-click apply.', color: 'bg-purple-50 text-purple-600' },
              { icon: Shield, title: 'Verified Organizations', desc: 'All academies and clubs are document-verified. Trust who you connect with.', color: 'bg-orange-50 text-orange-600' },
              { icon: Trophy, title: 'Professional Networking', desc: 'Connect with coaches, athletes, and organizations. Build meaningful sports relationships.', color: 'bg-red-50 text-red-600' },
              { icon: Star, title: 'CWG 2030 Ready', desc: 'Building digital scouting infrastructure for India\'s Commonwealth Games 2030 in Ahmedabad.', color: 'bg-yellow-50 text-yellow-600' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="card p-6">
                <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Athletes / For Organizations */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">For Athletes & Coaches</h2>
              <p className="text-gray-500 mb-6">Create your free Sports CV, get discovered by scouts and academies, and apply to trials across India.</p>
              <ul className="space-y-3 mb-8">
                {[
                  'Free profile creation — always',
                  'PDF Sports CV download',
                  'Custom shareable profile URL',
                  'Apply to trials with one click',
                  'Connect with coaches and academies',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=athlete" className="btn-primary inline-flex items-center gap-2">
                Create Free Profile <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">For Organizations</h2>
              <p className="text-gray-500 mb-6">Post trials, tournaments, and jobs. Access India's largest searchable sports talent database.</p>
              <ul className="space-y-3 mb-8">
                {[
                  'Post trials, events, tournaments for ₹50',
                  'Advanced athlete search with filters',
                  'Applicant management dashboard',
                  'Export applicant data to CSV',
                  'Verified organization badge',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-brand flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=organization" className="btn-primary inline-flex items-center gap-2">
                Register Organization <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Start Your Sports Journey?</h2>
          <p className="text-blue-100 mb-8">Join thousands of athletes, coaches, and organizations building their sports careers on LinkSports.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register" className="bg-white text-brand font-semibold px-8 py-3 rounded-xl hover:bg-blue-50 transition-colors">
              Get Started Free
            </Link>
            <Link href="/listings" className="bg-blue-600 border border-blue-400 text-white font-semibold px-8 py-3 rounded-xl hover:bg-blue-500 transition-colors">
              Browse Opportunities
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="hover:opacity-90 transition-opacity mb-4 block">
                <Logo className="scale-75 origin-left" />
              </Link>
              <p className="text-xs leading-relaxed">India's Sports Networking Platform. Linking Athletes to Opportunities.</p>
            </div>
            {[
              { title: 'Platform', links: ['Find Trials', 'Job Board', 'Search Athletes', 'Organizations'] },
              { title: 'Company', links: ['About Us', 'Privacy Policy', 'Terms of Service', 'Contact'] },
              { title: 'Sports', links: ['Cricket', 'Football', 'Kabaddi', 'Athletics', 'All Sports'] },
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="text-white font-medium mb-3 text-sm">{title}</h4>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}><a href="#" className="text-xs hover:text-white transition-colors">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs">© 2026 LinkSports.in. All rights reserved.</p>
            <p className="text-xs">Made with ❤️ for India's sports ecosystem</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
