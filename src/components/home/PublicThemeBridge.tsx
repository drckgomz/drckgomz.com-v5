'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { PublishedConfiguration } from '@/lib/site/configuration.server';
export default function PublicThemeBridge({ appearance }: { appearance: NonNullable<PublishedConfiguration['appearance']> }) {
  const pathname=usePathname();
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const apply=()=>document.querySelectorAll<HTMLElement>('[data-theme-scope="public"],[data-theme-scope="blog"],[data-theme-scope="projects"]').forEach(node=>{node.dataset.theme=appearance.mode==='system'?(media.matches?'dark':'light'):appearance.mode;});
    apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);
  },[appearance.mode,pathname]);
  const rules=(['light','dark'] as const).map(theme=>{
    const palette=appearance[theme];
    const colors=palette?`--background:${palette.background};--foreground:${palette.foreground};--primary:${palette.primary};--primary-foreground:${palette.primary_foreground};`:'';
    const font={system:'ui-sans-serif,system-ui,sans-serif',serif:'Georgia,serif',mono:'ui-monospace,monospace'}[appearance.font];
    return ['public','blog','projects'].map(scope=>`[data-theme-scope="${scope}"][data-theme="${theme}"]{${colors}--font-body:${font};--text-reading:${appearance.reading_size}px;}`).join('\n');
  }).join('\n');
  // Values originate from the strict server schema (hex colors, enums, bounded number).
  return <style>{rules}</style>;
}
