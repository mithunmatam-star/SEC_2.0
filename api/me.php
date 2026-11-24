<?php
/**
 * GET api/me.php
 * Returns the currently authenticated user and CSRF token, or a 401 response.
 * Response: { "success": true, "data": { "user": { "user_id": 1, "name": "...", "email": "..." }, "csrf_token": "..." }, "error": null }
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/helpers.php';
bootstrap_api();

$token = csrf_token();
header('X-CSRF-Token: ' . $token);

$userId = current_user_id();
if ($userId === null) {
    json_response(false, null, 'You need to log in to do that.', 401);
}

try {
    $pdo = db();
    $stmt = $pdo->prepare('SELECT user_id, name, email FROM users WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        destroy_current_session();
        fail('Your account could not be found. Please log in again.', 401);
    }

    json_response(true, [
        'user' => [
            'user_id' => (int) $user['user_id'],
            'name'    => $user['name'],
            'email'   => $user['email'],
        ],
        'csrf_token' => $token,
    ]);
} catch (PDOException $e) {
    app_log('me failed: ' . $e->getMessage());
    fail('We could not load your account. Please try again.', 500);
}
