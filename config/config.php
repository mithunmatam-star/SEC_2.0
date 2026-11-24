
<?php

/**
 * Teach-Back AI — Main Configuration
 */

// ============================================================
// ENVIRONMENT VARIABLE HELPER
// ============================================================

function env_or(string $key, string $fallback): string
{
    $value = getenv($key);

    return ($value === false || $value === '')
        ? $fallback
        : $value;
}

// ============================================================
// APPLICATION SETTINGS
// ============================================================

define('APP_NAME', 'Teach-Back AI');

define('APP_TIMEZONE', env_or('APP_TIMEZONE', 'Asia/Kolkata'));

define('APP_DEBUG', env_or('APP_DEBUG', '0') === '1');

date_default_timezone_set(APP_TIMEZONE);

// Show errors only in debug mode; log them otherwise
error_reporting(E_ALL);
ini_set('display_errors', APP_DEBUG ? '1' : '0');
ini_set('log_errors', '1');

// ============================================================
// DATABASE SETTINGS — XAMPP MYSQL / MARIADB
// ============================================================

define('DB_HOST', env_or('DB_HOST', '127.0.0.1'));

define('DB_PORT', (int) env_or('DB_PORT', '3306'));

// Must match the database imported from database/schema.sql
define('DB_NAME', env_or('DB_NAME', 'teach_back_ai_rebuild'));

define('DB_USER', env_or('DB_USER', 'root'));

// Default XAMPP root password is usually empty
define('DB_PASS', env_or('DB_PASS', ''));

// ============================================================
// SESSION SETTINGS
// ============================================================

define('SESSION_NAME', 'TBAISESSID');

define('SESSION_LIFETIME', (int) env_or('SESSION_LIFETIME', '0'));

// ============================================================
// AI API SETTINGS
// ============================================================

// Set your API key through an environment variable.
// Never commit or share your API key publicly.

define('AI_API_KEY', env_or('AI_API_KEY', 'vapi-7V9owYgPrb3DlBOneM8jOnTMZ_tEhdNwnBSUW6YPTX8zln5ScKkYwxnhe7YAJVRg'));

define(
    'AI_BASE_URL',
    rtrim(env_or('AI_BASE_URL', 'https://integrate.api.nvidia.com/v1'), '/')
);

define('AI_MODEL', env_or('AI_MODEL', 'nvidia/nemotron-3.5-bolt-e4b'));

// ============================================================
// AI REQUEST SETTINGS
// ============================================================

define('AI_TIMEOUT', (int) env_or('AI_TIMEOUT', '90'));

define('AI_MAX_TOKENS', (int) env_or('AI_MAX_TOKENS', '600'));

define('AI_EVAL_MAX_TOKENS', (int) env_or('AI_EVAL_MAX_TOKENS', '1500'));

define('AI_JSON_MODE', env_or('AI_JSON_MODE', '1') === '1');

// ============================================================
// SSL CERTIFICATE SETTINGS
// ============================================================

// On XAMPP/Windows, if cURL reports an SSL certificate error, download
// cacert.pem and set this to its full path (e.g. C:/xampp/php/extras/ssl/cacert.pem)
define('AI_CA_BUNDLE', env_or('AI_CA_BUNDLE', ''));