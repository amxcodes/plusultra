const requiredEnv = [
    'VITE_TMDB_API_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_TURNSTILE_SITE_KEY',
];

const missing = requiredEnv.filter((key) => !process.env[key]);
const malformed = requiredEnv.filter((key) => {
    const value = process.env[key];
    return Boolean(value) && value !== value.trim();
});

if (missing.length > 0) {
    console.error(`Missing desktop build env values: ${missing.join(', ')}`);
    console.error('Add these as GitHub Actions repository secrets before publishing a desktop release.');
    process.exit(1);
}

if (malformed.length > 0) {
    console.error(`Desktop build env values contain leading or trailing whitespace: ${malformed.join(', ')}`);
    console.error('Trim the secret values in GitHub Actions before publishing a desktop release.');
    process.exit(1);
}

console.info('Desktop build env validated.');
