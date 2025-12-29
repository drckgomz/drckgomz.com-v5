// frontend/src/features/blog/components/BlogFooter.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

const BlogFooter = () => {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugReport, setBugReport] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showSocials = useMemo(
    () => ['/BlogHome', '/blog/'].some((p) => pathname === p || pathname?.startsWith(p)),
    [pathname]
  );

  useEffect(() => {
    try {
      setIsAdmin(localStorage.getItem('isAdmin') === 'true');
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const handleSubmitBug = async () => {
    if (!bugReport.trim()) {
      alert('Please describe the bug.');
      return;
    }

    try {
      setSubmitting(true);
      const base = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!base) throw new Error('API base URL is not configured');

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

      if (!resp.ok) {
        const msg = await resp.text().catch(() => '');
        throw new Error(msg || 'Failed to submit bug report');
      }

      alert('🐞 Bug report submitted. Thank you!');
      setBugReport('');
      setShowBugModal(false);
    } catch (err: any) {
      console.error('Bug report error:', err?.message || err);
      alert('❌ Failed to send bug report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full p-4 bg-transparent text-center z-20 sm:block">
      {showSocials && (
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

      <button onClick={() => setShowBugModal(true)} className="text-sm text-gray-400 hover:text-white underline">
        Report a Bug
      </button>

      {showBugModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 p-6 rounded-lg max-w-md w-full shadow-lg text-white">
            <h2 className="text-xl font-semibold mb-4">Report a Bug</h2>
            <textarea
              className="w-full h-32 p-2 rounded bg-gray-800 border border-gray-700 text-white"
              placeholder="Describe the issue..."
              value={bugReport}
              onChange={(e) => setBugReport(e.target.value)}
            />
            <div className="flex justify-center mt-4 space-x-2">
              <button
                onClick={() => setShowBugModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitBug}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogFooter;
