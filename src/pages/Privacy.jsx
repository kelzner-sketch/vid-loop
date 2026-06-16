import React from 'react';
import { useTabNav } from '@/components/TabNavigator';
import { ChevronLeft } from 'lucide-react';

export default function Privacy() {
  const { pop, canGoBack } = useTabNav();

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-md"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        {canGoBack && (
          <button
            onClick={pop}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
        )}
        <h1 className="text-lg font-heading font-light lowercase tracking-tight text-foreground">
          privacy policy
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p className="text-foreground">Last updated: June 16, 2026</p>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">1. Information We Collect</h2>
            <p>
              Vid‑Loop is a camera‑first app. We do not require an account to use the core features.
              If you choose to create an account, we collect your email address and any preferences you set within the app.
            </p>
            <p>
              Video clips you record are stored on our servers to enable gallery access and sharing.
              We do not access, view, or process your video content beyond what is needed to deliver the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">2. Camera & Microphone</h2>
            <p>
              Vid‑Loop accesses your device camera to provide live video effects.
              All processing happens locally on your device. No camera feed is transmitted to our servers
              unless you explicitly record a clip and choose to save it to your gallery.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and maintain the Vid‑Loop service</li>
              <li>Save and sync your clips and preferences (account holders only)</li>
              <li>Process payments for Vid‑Loop Pro subscriptions</li>
              <li>Send essential service updates</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">4. Data Sharing</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties.
              We may share data with service providers (hosting, payment processing) solely to operate the app.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">5. Data Retention</h2>
            <p>
              Video clips are retained until you delete them from your gallery.
              Account data is retained until you delete your account. You can delete your account
              and all associated data from the Settings page at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">6. Your Rights</h2>
            <p>
              You have the right to access, update, or delete your personal data.
              Contact us at the email below for any privacy‑related requests.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">7. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of any changes
              by posting the new policy on this page.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-medium text-foreground">8. Contact</h2>
            <p>
              If you have questions about this privacy policy, contact us at{' '}
              <a href="mailto:kthedizzlest@gmail.com" className="text-accent hover:underline">
                kthedizzlest@gmail.com
              </a>.
            </p>
          </section>

          <div className="h-16" />
        </div>
      </div>
    </div>
  );
}