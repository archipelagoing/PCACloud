const API = 'https://www.kaggle.com/api/v1/datasets';
export const MAX_BYTES = 5 * 1024 * 1024;

export function datasetRef(value) {
  let ref = value.trim();
  if (/^(www\.)?kaggle\.com\//i.test(ref)) ref = `https://${ref}`;
  if (/^https?:/i.test(ref)) {
    const url = new URL(ref);
    if (url.protocol !== 'https:' || !['www.kaggle.com', 'kaggle.com'].includes(url.hostname)) throw new Error('Use a kaggle.com dataset link.');
    ref = url.pathname.replace(/^\/datasets\//, '').replace(/\/$/, '');
  }
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(ref)) throw new Error('Enter a Kaggle dataset URL or owner/dataset-name.');
  return ref;
}

async function limitedFetch(url, limit, fetcher) {
  let response;
  try { response = await fetcher(url, { credentials: 'omit', signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error('Kaggle could not be reached. Try again, or download the CSV from Kaggle and upload it here.'); }
  if (!response.ok) throw new Error(`Kaggle returned ${response.status}. Use a public dataset that does not require sign-in or accepting competition rules.`);
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new Error('This download is too large. Choose a CSV under 5 MB.'); }
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('This download is too large. Choose a CSV under 5 MB.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (bytes[0] === 80 && bytes[1] === 75) throw new Error('Kaggle returned a ZIP archive. Unzip it and upload the CSV here.');
  const text = new TextDecoder().decode(bytes);
  if (/^\s*</.test(text)) throw new Error('Kaggle returned a sign-in or verification page. Download the CSV on Kaggle, then upload it here.');
  return text;
}

export async function listCSVFiles(ref, fetcher = fetch) {
  ref = datasetRef(ref);
  const files = []; let token = '';
  for (let page = 0; page < 10; page++) {
    const suffix = token ? `?pageToken=${encodeURIComponent(token)}` : '';
    const data = JSON.parse(await limitedFetch(`${API}/list/${ref}${suffix}`, MAX_BYTES, fetcher));
    if (data.errorMessage) throw new Error(data.errorMessage);
    for (const file of data.datasetFiles || []) if (/\.csv$/i.test(file.name) && Number(file.totalBytes) <= MAX_BYTES) files.push(file.name);
    token = data.nextPageToken; if (!token) return files;
  }
  throw new Error('This dataset has too many files to browse. Download your chosen CSV on Kaggle and upload it here.');
}

export async function downloadCSV(ref, filename, fetcher = fetch) {
  ref = datasetRef(ref);
  if (!filename || !/\.csv$/i.test(filename) || filename.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Choose a CSV file.');
  return limitedFetch(`${API}/download/${ref}/${filename.split('/').map(encodeURIComponent).join('/')}`, MAX_BYTES, fetcher);
}
