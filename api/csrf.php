<?php
/**
 * GET api/csrf.php
 * Returns the current CSRF token without requiring authentication.
 * Response: { "success": true, "data": { "csrf_token": "..." }, "error": null }
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/helpers.php';
bootstrap_api();

$token = csrf_token();
header('X-CSRF-Token: ' . $token);

json_response(true, [
    'csrf_token' => $token,
]);
