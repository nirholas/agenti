import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
}

const BASE_TITLE = 'Lyra Web3 Playground';
const BASE_DESCRIPTION = 'Learn blockchain development with interactive examples. Compile and deploy Solidity smart contracts directly in your browser.';
const BASE_URL = 'https://lyra.works';

/**
 * SEO component for dynamic page titles and meta tags
 * Updates document title and meta description on mount
 */
export function useSEO({ title, description, path }: SEOProps) {
  useEffect(() => {
    // Update document title
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description || BASE_DESCRIPTION);
    }

    // Update canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonical && path) {
      canonical.href = `${BASE_URL}${path}`;
    }

    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    
    if (ogTitle) ogTitle.setAttribute('content', title ? `${title} | ${BASE_TITLE}` : BASE_TITLE);
    if (ogDescription) ogDescription.setAttribute('content', description || BASE_DESCRIPTION);
    if (ogUrl && path) ogUrl.setAttribute('content', `${BASE_URL}${path}`);

    // Update Twitter tags
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    const twitterUrl = document.querySelector('meta[name="twitter:url"]');
    
    if (twitterTitle) twitterTitle.setAttribute('content', title || BASE_TITLE);
    if (twitterDescription) twitterDescription.setAttribute('content', description || BASE_DESCRIPTION);
    if (twitterUrl && path) twitterUrl.setAttribute('content', `${BASE_URL}${path}`);

    // Cleanup - restore defaults on unmount
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title, description, path]);
}

export default useSEO;
