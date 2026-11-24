<?php
/**
 * CLI smoke test for the configured AI provider.
 * Usage: /Applications/XAMPP/xamppfiles/bin/php tools/check_ai.php
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/helpers.php';

$payload = [
    'model'      => AI_MODEL,
    'messages'   => [['role' => 'user', 'content' => 'Say hi']],
    'max_tokens' => 20,
];

$started = microtime(true);
try {
    $response = ai_http_post($payload);
    $elapsed = microtime(true) - $started;
    $status = $response['status'];
    $reply = is_array($response['json']) ? extract_ai_text($response['json']) : '';
    if ($status < 200 || $status >= 300) {
        ai_throw_http_error($status, $response['raw']);
    }
} catch (AiException $e) {
    $elapsed = microtime(true) - $started;
    $status = $e->httpStatus;
    $reply = $e->getMessage();
}

echo 'model=' . AI_MODEL . "\n";
echo 'url=' . ai_chat_endpoint() . "\n";
echo 'http_status=' . $status . "\n";
echo 'elapsed_seconds=' . number_format($elapsed, 2) . "\n";
echo 'reply=' . text_substr($reply, 0, 100) . "\n";
