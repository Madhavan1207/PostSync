import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Postelligence Privacy Policy detailing how we handle user data and social media API integrations.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Last updated: July 23, 2026
        </p>

        <div className="mt-8 space-y-6 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">1. Introduction</h2>
            <p>
              Welcome to <strong>Postelligence</strong> (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). Postelligence is a social media management platform that enables users to schedule, create, and publish content across multiple social media platforms including YouTube, Instagram, Facebook, Threads, LinkedIn, Twitter/X, Pinterest, and Discord.
            </p>
            <p>
              We respect your privacy and are committed to protecting your personal data and account credentials.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">2. Information We Collect</h2>
            <p>We collect information to provide and improve our services:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Account Information:</strong> Email address, name, and profile details provided when you register via Supabase authentication.
              </li>
              <li>
                <strong>Connected Social Media Accounts:</strong> OAuth access tokens, refresh tokens, platform user IDs, account handles, and profile avatars obtained when you connect social media platforms.
              </li>
              <li>
                <strong>Content Data:</strong> Posts, drafts, titles, captions, images, and video media URLs that you create or upload to schedule for publishing.
              </li>
              <li>
                <strong>Analytics Data:</strong> Performance metrics, impression counts, engagement rates, and publishing history for posts published through Postelligence.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">3. How We Use Your Information</h2>
            <p>Your information is used solely to provide social media publishing and management features:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Publishing your content to selected social media networks at scheduled times.</li>
              <li>Displaying analytics dashboards and performance logs for your connected accounts.</li>
              <li>Processing background jobs and automated publishing requests via secure serverless schedulers.</li>
              <li>Maintaining system security and verifying user authorization.</li>
            </ul>
            <p>
              We do <strong>not</strong> sell, rent, or trade your personal data or connected social media information to third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">4. Third-Party API Integrations</h2>
            <p>
              Postelligence connects directly to official platform APIs using standard OAuth 2.0 protocols:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>YouTube API Services:</strong> Uses Google OAuth to upload and publish videos. By using Postelligence to publish to YouTube, you agree to the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">YouTube Terms of Service</a> and the <a href="http://www.google.com/policies/privacy" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">Google Privacy Policy</a>.
              </li>
              <li>
                <strong>Meta APIs (Facebook, Instagram, Threads):</strong> Uses Meta OAuth to publish text, image, and video content and retrieve account metrics.
              </li>
              <li>
                <strong>LinkedIn, Twitter, Pinterest, Discord:</strong> Connects via official OAuth scopes to manage scheduled posts.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">5. Data Retention &amp; Deletion</h2>
            <p>
              You retain full control over your data. You may disconnect any connected social media account at any time from your account settings. Disconnecting an account immediately removes access tokens from our database.
            </p>
            <p>
              To request account deletion or removal of all associated data, contact us at support@postelligence.com or initiate account deletion directly from your settings dashboard.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">6. Security</h2>
            <p>
              We implement industry-standard security measures including HTTPS encryption in transit, secure token storage, and restricted service-role access to safeguard your data against unauthorized access.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or your data, please contact us at:
            </p>
            <p className="font-semibold text-slate-900">support@postelligence.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
