const MUSIC_API_URL = 'https://api.musicapi.com/public/search';

function authorization() {
  if (process.env.MUSICAPI_API_KEY) return process.env.MUSICAPI_API_KEY;
  if (process.env.MUSICAPI_CLIENT_ID && process.env.MUSICAPI_CLIENT_SECRET) {
    return `Basic ${Buffer.from(`${process.env.MUSICAPI_CLIENT_ID}:${process.env.MUSICAPI_CLIENT_SECRET}`).toString('base64')}`;
  }
  return null;
}

async function search({ query, source = 'spotify' }) {
  const token = authorization();
  if (!token) return { configured: false, tracks: [] };
  const response = await fetch(MUSIC_API_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'track', track: query, sources: [source] })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `MusicAPI respondió ${response.status}.`);
  const rawTracks = data.tracks || data.results || [];
  const tracks = rawTracks.map(track => track.data ? { ...track.data, source: track.source || track.data.source } : track);
  return { configured: true, tracks };
}

module.exports = { search };