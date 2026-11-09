export const VIEWS = ['bank','review','saved','companies','career','roadmap','community','plan'];
export function readRoute(hash='') {
  try {
    const [path, query=''] = hash.replace(/^#\/?/, '').split('?');
    const [rawView, encoded] = path.split('/');
    const view=rawView||'bank';
    if (!VIEWS.includes(view) && view !== 'question') return {view:'missing'};
    return {view:view||'bank', id:encoded ? decodeURIComponent(encoded) : '', params:Object.fromEntries(new URLSearchParams(query))};
  } catch { return {view:'missing'}; }
}
export function routeHash(view, id='', params={}) {
  const query = new URLSearchParams(Object.entries(params).filter(([,v]) => v && v !== 'all'));
  return `#/${view}${id ? '/'+encodeURIComponent(id) : ''}${query.size ? '?'+query : ''}`;
}
export function shareURL(location, hash) {
  const url = new URL(location);
  url.search = ''; url.hash = hash;
  return url.href;
}
