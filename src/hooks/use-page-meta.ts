import { useEffect } from 'react';

interface PageMetaOptions {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
}

/**
 * Hook to dynamically update page meta tags for SEO and social sharing
 */
export function usePageMeta(options: PageMetaOptions) {
  useEffect(() => {
    const { title, description, ogTitle, ogDescription, ogImage, ogType = 'website' } = options;

    // Update document title
    const originalTitle = document.title;
    document.title = title;

    // Helper to set or create meta tag
    const setMetaTag = (property: string, content: string, isProperty = true) => {
      const selector = isProperty ? `meta[property="${property}"]` : `meta[name="${property}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement | null;
      
      if (!meta) {
        meta = document.createElement('meta');
        if (isProperty) {
          meta.setAttribute('property', property);
        } else {
          meta.setAttribute('name', property);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    // Set description
    if (description) {
      setMetaTag('description', description, false);
    }

    // Set Open Graph tags
    setMetaTag('og:title', ogTitle || title);
    setMetaTag('og:type', ogType);
    
    if (ogDescription || description) {
      setMetaTag('og:description', ogDescription || description || '');
    }
    
    if (ogImage) {
      setMetaTag('og:image', ogImage);
    }

    // Set Twitter card tags
    setMetaTag('twitter:card', ogImage ? 'summary_large_image' : 'summary', false);
    setMetaTag('twitter:title', ogTitle || title, false);
    
    if (ogDescription || description) {
      setMetaTag('twitter:description', ogDescription || description || '', false);
    }
    
    if (ogImage) {
      setMetaTag('twitter:image', ogImage, false);
    }

    // Cleanup on unmount
    return () => {
      document.title = originalTitle;
    };
  }, [options.title, options.description, options.ogTitle, options.ogDescription, options.ogImage, options.ogType]);
}
