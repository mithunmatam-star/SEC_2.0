<?php
/**
 * Teach-Back AI — sample configuration.
 *
 * Copy this file to config/config.php and fill in your own values, OR keep
 * config/config.php and point the environment variables below at your setup.
 *
 * Recommended on XAMPP:
 *   1. Start Apache + MySQL in the XAMPP control panel.
 *   2. Import database/schema.sql in phpMyAdmin.
 *   3. Edit config/config.php (DB_PASS is empty by default on XAMPP).
 *   4. Paste your AI API key.
 */
declare(strict_types=1);

function env_or(string $key, string $fallback): string
{
    $value = getenv($key);
    return ($value === false || $value === '') ? $fallback : $value;
}

define('APP_NAME', 'Teach-Back AI');
define('APP_TIMEZONE', 'UTC');
define('APP_DEBUG', false);

// Database ---------------------------------------------------------------
define('DB_HOST', '127.0.0.1');
define('DB_PORT', '3306');
define('DB_NAME', 'teach_back_ai');
define('DB_USER', 'root');
define('DB_PASS', '');                 // XAMPP's default root password is empty

// Sessions ---------------------------------------------------------------
define('SESSION_NAME', 'TBAISESSID');
define('SESSION_LIFETIME', 0);

// AI provider (OpenAI, Groq, OpenRouter, Together, local llama.cpp, …) -----
define('AI_API_KEY', 'sk-your-key-here');
define('AI_BASE_URL', 'https://api.openai.com/v1');
define('AI_MODEL', 'gpt-4o-mini');
define('AI_TIMEOUT', 90);
define('AI_MAX_TOKENS', 300);
define('AI_EVAL_MAX_TOKENS', 1200);
define('AI_JSON_MODE', true);
define('AI_CA_BUNDLE', '');            // e.g. C:\xampp\apache\bin\curl-ca-bundle.crt
