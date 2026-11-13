// frontend/src/features/blog/components/BlogFooter.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const BlogFooter = ({ offlinePreview = false }: { offlinePreview?: boolean }) => {
  const pathname = usePathname();
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugReport, setBugReport] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const reportingConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  const reportingUnavailable = offlinePreview || !reportingConfigured;

  const showSocials = useMemo(
    () => pathname === '/blog' || pathname?.startsWith('/blog/'),
    [pathname]
  );

  const handleSubmitBug = async () => {
    if (!bugReport.trim() || reportingUnavailable || submitting) return;

    try {
      setSubmitting(true);
      const base = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!base) {
        setSubmitMessage('Bug reporting is unavailable in this environment.');
        return;
      }

      const payload = {
        description: bugReport.trim(),
        path: pathname ?? '',
        href: typeof window !== 'undefined' ? window.location.href : '',
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      };

      const resp = await fetch(`${base.replace(/\/+$/, '')}/v1/public/bugs/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) throw new Error('submission-failed');
      setSubmitMessage('Bug report submitted. Thank you.');
      setBugReport('');
    } catch {
      console.error('Bug report submission failed.');
      setSubmitMessage('The report could not be submitted. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full p-4 bg-transparent text-center z-20 sm:block">
      {!offlinePreview && showSocials && (
        <div className="flex justify-center space-x-6 mb-3">
          {/* socials unchanged */}
          <a href="https://www.youtube.com/@drckgomz" target="_blank" rel="noopener noreferrer">
            <img src="https://s3.us-east-1.amazonaws.com/www.drckgomz.com/youtube.png" alt="YouTube" className="w-8 h-8 sm:w-10 sm:h-10 object-contain hover:opacity-60" />
          </a>
          <a href="https://x.com/DrckGomz" target="_blank" rel="noopener noreferrer">
            <img src="https://s3.us-east-1.amazonaws.com/www.drckgomz.com/x.png" alt="X" className="w-8 h-8 sm:w-10 sm:h-10 object-contain hover:opacity-60" />
          </a>
          <a href="https://www.instagram.com/drckgomz/" target="_blank" rel="noopener noreferrer">
            <img src="https://s3.us-east-1.amazonaws.com/www.drckgomz.com/instagram.png" alt="Instagram" className="w-8 h-8 sm:w-10 sm:h-10 object-contain hover:opacity-60" />
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={() => { setSubmitMessage(null); setShowBugModal(true); }}
        className="text-sm text-gray-400 underline transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
      >
        Report a Bug
      </button>

      <Dialog open={showBugModal} onOpenChange={setShowBugModal}>
        <DialogContent className="border-white/15 bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle>Report a Bug</DialogTitle>
            <DialogDescription className="text-white/65">
              {reportingUnavailable
                ? 'Bug reporting is unavailable in offline preview or when the reporting service is not configured.'
                : 'Describe the issue. The report will include this page path and browser details.'}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm text-white/80" htmlFor="blog-bug-report">
            Description
            <textarea
              id="blog-bug-report"
              className="min-h-32 w-full rounded border border-white/15 bg-zinc-900 p-3 text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60"
              placeholder={reportingUnavailable ? 'Unavailable in this preview' : 'Describe the issue…'}
              value={bugReport}
              onChange={(event) => setBugReport(event.target.value)}
              disabled={reportingUnavailable || submitting}
            />
          </label>
          {submitMessage && <p role="status" className="text-sm text-white/75">{submitMessage}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowBugModal(false)} disabled={submitting}>
              Close
            </Button>
            <Button type="button" onClick={handleSubmitBug} disabled={reportingUnavailable || !bugReport.trim() || submitting}>
              {submitting ? 'Submitting…' : 'Submit report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlogFooter;
