// Common disposable/temporary email domains to block
// Source: https://github.com/disposable/disposable-email-domains
const DISPOSABLE_DOMAINS = [
    // Popular temp mail services
    'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'temp-mail.org',
    'mailinator.com', 'trashmail.com', 'throwaway.email', 'maildrop.cc',
    'getnada.com', 'fakeinbox.com', 'yopmail.com', 'mintemail.com',
    'sharklasers.com', 'guerrillamail.info', 'grr.la', 'guerrillamail.net',
    'spam4.me', 'mailnesia.com', 'mytemp.email', 'temp-mail.io',
    'emailondeck.com', 'mailtemporaire.fr', 'mailcatch.com', 'mohmal.com',
    'tempmailo.com', 'tempsky.com', 'mail-temp.com', 'mailforspam.com'
];

/**
 * Checks if an email domain is a known disposable/temporary email service
 */
export const isDisposableEmail = (email: string): boolean => {
    const domain = email.split('@')[1]?.toLowerCase().trim();
    if (!domain) return false;
    return DISPOSABLE_DOMAINS.includes(domain);
};

/**
 * Validates email format using standard regex
 */
export const isValidEmailFormat = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Full email validation: checks format and blocks disposable emails
 */
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
    if (!email || !email.trim()) {
        return { valid: false, error: 'Email is required' };
    }

    if (!isValidEmailFormat(email)) {
        return { valid: false, error: 'Please enter a valid email address' };
    }

    if (isDisposableEmail(email)) {
        return { valid: false, error: 'Temporary email addresses are not allowed' };
    }

    return { valid: true };
};
