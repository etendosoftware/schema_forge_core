import { useState, useEffect } from 'react';

/**
 * Fetch an authenticated NEO image by id and expose it as an object URL.
 *
 * The image endpoint (`{neoBase}/image/{id}`) requires a Bearer token, so the
 * blob is fetched manually and wrapped in an object URL that can be fed to an
 * `<img src>`. The object URL is revoked on unmount or when the id/token/base
 * changes, so no blob leaks between rows.
 *
 * `apiBaseUrl` is the entity API base (e.g. `.../neo/<spec>`); the image
 * endpoint hangs off its parent, so the trailing path segment is stripped to
 * derive `{neoBase}`.
 *
 * @param {string|null|undefined} imageId NEO image id (falsy → no fetch)
 * @param {string} token Bearer token
 * @param {string} apiBaseUrl entity API base URL
 * @returns {string|null} object URL, or `null` while loading / when no image
 */
export function useNeoImage(imageId, token, apiBaseUrl) {
  const [imgSrc, setImgSrc] = useState(null);
  const neoBaseUrl = (apiBaseUrl || '').replace(/\/[^/]+$/, '');

  useEffect(() => {
    if (!imageId) return undefined;
    let objectUrl;
    fetch(`${neoBaseUrl}/image/${imageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setImgSrc(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId, token, neoBaseUrl]);

  return imgSrc;
}
