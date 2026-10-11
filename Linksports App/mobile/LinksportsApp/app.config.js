const fs = require('fs');
const path = require('path');

// Read the shared <repo>/.env (same file as backend + web). Variables already set in the
// environment win, so EAS build secrets / CI can override it.
function readRootEnv() {
  const out = {};
  try {
    const file = path.resolve(__dirname, '..', '..', '..', '.env');
    if (!fs.existsSync(file)) return out;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* optional */
  }
  return out;
}

const root = readRootEnv();
const pick = (key) => process.env[key] || root[key] || '';

// app.json stays the base config; this adds the environment-specific values.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra || {}),
    apiUrl: pick('EXPO_PUBLIC_API_URL'),
    siteUrl: pick('EXPO_PUBLIC_SITE_URL'),
  },
});
