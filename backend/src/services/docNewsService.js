const DOC_FEED_URL = 'https://www.doc.govt.nz/news/rss-feed-to-govtnz/';
const RECENT_DOC_DAYS = 30;
const MAX_DOC_CANDIDATES = 16;
const MAX_DOC_HTML_BYTES = 1_000_000;

const decodeEntities = (value = '') => String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
  if (entity.startsWith('#')) {
    const number = entity[1]?.toLowerCase() === 'x'
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(number) && number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
  }
  return {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…',
  }[entity.toLowerCase()] || match;
});

const plainText = (value = '') => decodeEntities(String(value)
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]*>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const docReleaseUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.doc.govt.nz' &&
      url.pathname.startsWith('/news/media-releases/') ? url.toString() : '';
  } catch {
    return '';
  }
};

const tagValue = (xml, tag) => decodeEntities(xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '').trim();

export const parseDocFeed = (xml, now = Date.now()) =>
  [...String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/gi)]
    .map(([, entry]) => ({
      title: tagValue(entry, 'title'),
      description: plainText(tagValue(entry, 'summary')),
      publishedAt: tagValue(entry, 'published'),
      url: docReleaseUrl(entry.match(/<link\b[^>]*\bhref="([^"]+)"/i)?.[1]),
    }))
    .filter((article) => {
      const published = Date.parse(article.publishedAt);
      return article.title && article.url && Number.isFinite(published) &&
        published <= now && published >= now - RECENT_DOC_DAYS * 24 * 60 * 60 * 1000;
    });

export const extractDocArticle = (html = '') => {
  const section = String(html).match(/<div\s+class="pagedoc"[^>]*>([\s\S]*?)<\/doc-content-box>/i)?.[1];
  if (!section) return '';
  const text = plainText(section);
  // A release credited to a minister, partner, or other third party may have
  // different reuse rights from DOC's own text.
  if (/^Date:\s*.{0,100}?\bSource:/i.test(text.slice(0,220))) return '';
  return text
    .replace(/^Date:\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*/i, '')
    .split(/\b(?:For media enquiries|Media contact):/i)[0]
    .trim();
};

export const extractDocImage = (html = '') => {
  const hero = String(html).match(/<section\s+class="doc-main-layout__hero"[^>]*>([\s\S]*?)<\/section>/i)?.[1];
  if (!hero) return null;
  const caption = hero.match(/<doc-image-caption\b([^>]*)>([\s\S]*?)<\/doc-image-caption>/i);
  if (!caption || !/<a\b[^>]*href="\/footer-links\/copyright\/"[^>]*>\s*DOC\s*<\/a>/i.test(caption[2])) {
    return null;
  }
  const img = hero.match(/<img\b(?=[^>]*\bclass="hero__image")[^>]*>/i)?.[0];
  const src = img?.match(/\bsrc="([^"]+)"/i)?.[1];
  if (!src) return null;
  let imageUrl;
  try { imageUrl = new URL(decodeEntities(src), DOC_FEED_URL); }
  catch { return null; }
  if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'www.doc.govt.nz' ||
      !imageUrl.pathname.startsWith('/thumbs/hero/')) return null;
  const credit = plainText(caption[2]).replace(/^Image:\s*/i, '').replace(/\s*\|\s*DOC\s*$/i, '').trim();
  const imageAlt = decodeEntities(caption[1].match(/\bcaption="([^"]+)"/i)?.[1] || '').trim();
  return { imageUrl: imageUrl.toString(), imageCredit: credit ? `${credit} / DOC` : 'DOC', imageAlt };
};

const fetchText = async (url, signal) => {
  const response = await fetch(url, { signal, redirect: 'error',
    headers: { Accept: 'text/html, application/atom+xml, application/xml' } });
  if (!response.ok) throw new Error(`DOC request failed with ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('DOC response has no body');
  const contentLength = Number(response.headers?.get?.('content-length') || 0);
  try {
    if (contentLength > MAX_DOC_HTML_BYTES) {
      await reader.cancel();
      throw new Error('DOC response too large');
    }
    const chunks = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_DOC_HTML_BYTES) {
        await reader.cancel();
        throw new Error('DOC response too large');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { text: new TextDecoder().decode(bytes), finalUrl: response.url || url };
  } finally {
    reader.releaseLock();
  }
};

export const fetchDocArticleByUrl = async (url, signal = AbortSignal.timeout(6_000)) => {
  const safeUrl = docReleaseUrl(url);
  if (!safeUrl) return '';
  const response = await fetchText(safeUrl, signal);
  return docReleaseUrl(response.finalUrl) ? extractDocArticle(response.text) : '';
};

export const fetchDocArticles = async ({ now = Date.now(), isCandidate = () => true, signal } = {}) => {
  const feed = await fetchText(DOC_FEED_URL, signal);
  const candidates = parseDocFeed(feed.text, now).filter(isCandidate).slice(0, MAX_DOC_CANDIDATES);
  const articles = [];
  for (let offset = 0; offset < candidates.length; offset += 4) {
    const batch = await Promise.all(candidates.slice(offset, offset + 4).map(async (candidate) => {
      try {
        const response = await fetchText(candidate.url, signal);
        if (!docReleaseUrl(response.finalUrl)) return null;
        const fullContent = extractDocArticle(response.text);
        if (fullContent.length < 300) return null;
        return { ...candidate, fullContent, ...extractDocImage(response.text),
          source: { name: 'Department of Conservation (CC BY 4.0)' } };
      } catch (error) {
        if (signal?.aborted) throw error;
        console.warn('[news] DOC article unavailable:', error.message);
        return null;
      }
    }));
    articles.push(...batch.filter(Boolean));
  }
  return articles;
};
