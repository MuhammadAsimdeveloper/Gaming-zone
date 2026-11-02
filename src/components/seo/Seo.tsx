import { useEffect } from 'react';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../../config/site';
import { trackPageView } from '../../lib/analytics';

interface SeoProps {
  title: string;
  description?: string;
  path: string;
  image?: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function Seo({
  title,
  description = SITE_DESCRIPTION,
  path,
  image = '/og-cover.png',
  noIndex = false,
  type = 'website',
  jsonLd,
}: SeoProps) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonical = absoluteUrl(path);
    const imageUrl = absoluteUrl(image);
    const safeDescription = description.length > 180 ? `${description.slice(0, 177)}...` : description;

    document.title = fullTitle;
    setMeta('name', 'description', safeDescription);
    setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    setCanonical(canonical);

    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', safeDescription);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', imageUrl);

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', safeDescription);
    setMeta('name', 'twitter:image', imageUrl);

    const existing = document.getElementById('neonrift-structured-data');
    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'neonrift-structured-data';
      script.textContent = JSON.stringify(jsonLd);
      existing?.remove();
      document.head.appendChild(script);
    } else {
      existing?.remove();
    }

    trackPageView(path, fullTitle);
  }, [title, description, path, image, noIndex, type, jsonLd]);

  return null;
}
