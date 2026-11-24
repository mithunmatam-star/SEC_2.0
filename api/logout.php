<?php
/**
 * POST api/logout.php
 * Requires the X-CSRF-Token header.
 * Destroys the current session and cookie.
 * Response: { "success": true, "data": { "message": "Logged out successfully." }, "error": null }
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/helpers.php';
bootstrap_api();
require_post();
require_csrf();

destroy_current_session();

json_response(true, [
    'message' => 'Logged out successfully.',
]);
