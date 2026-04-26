const requiredEnv = [
    'VITE_TMDB_API_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_TURNSTILE_SITE_KEY',
];

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
    console.error(`Missing desktop build env values: ${missing.join(', ')}`);
    console.error('Add these as GitHub Actions repository secrets before publishing a desktop release.');
    process.exit(1);
}

console.info('Desktop build env validated.');
