/**
 * Parse product name, price, image from HTML (JSON-LD + meta).
 * Same logic as extension background for consistency.
 */
function parseProductFromHtml(html, pageUrl) {
  const result = { name: '', price: '', image: '', url: pageUrl || '' };
  const baseUrl = pageUrl ? new URL(pageUrl).origin : '';

  function resolveUrl(url) {
    if (!url || url.startsWith('data:')) return url;
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  let match;
  const ldJsonRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = ldJsonRegex.exec(html)) !== null) {
    try {
      const raw = match[1].replace(/<!--[\s\S]*?-->/g, '').trim();
      const json = JSON.parse(raw);
      const items = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json];
      for (const item of items) {
        if (!item || item['@type'] !== 'Product') continue;
        if (item.name && !result.name) result.name = String(item.name).trim();
        if (item.image) {
          const img = Array.isArray(item.image) ? item.image[0] : item.image;
          if (img && typeof img === 'string' && !result.image) result.image = resolveUrl(img);
          else if (img && img.url && !result.image) result.image = resolveUrl(img.url);
        }
        const offers = item.offers;
        if (offers) {
          const offer = Array.isArray(offers) ? offers[0] : offers;
          if (offer && offer.price !== undefined && !result.price) result.price = String(offer.price).trim().replace(/,/g, '');
          if (offer && offer.lowPrice !== undefined && !result.price) result.price = String(offer.lowPrice).trim().replace(/,/g, '');
        }
      }
    } catch (_) {}
  }

  const metaRegex = /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
  const metaByProp = {};
  while ((match = metaRegex.exec(html)) !== null) {
    metaByProp[match[1].toLowerCase()] = (match[2] || '').trim();
  }
  if (!result.name && metaByProp['og:title']) result.name = metaByProp['og:title'];
  if (!result.image && metaByProp['og:image']) result.image = resolveUrl(metaByProp['og:image']);
  if (!result.price && metaByProp['product:price:amount']) result.price = metaByProp['product:price:amount'].replace(/,/g, '');
  if (!result.price && metaByProp['twitter:data1']) {
    const priceMatch = metaByProp['twitter:data1'].match(/[\d,]+\.?\d*/);
    if (priceMatch) result.price = priceMatch[0].replace(/,/g, '');
  }

  return result;
}

module.exports = { parseProductFromHtml };
