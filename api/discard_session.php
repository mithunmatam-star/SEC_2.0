<?php
/**
 * POST api/discard_session.php
 * Body: { session_id }
 *
 * Discards an active teaching session that the user wishes to abandon.
 * Active sessions only; completed sessions return 409.
 * Messages and related records cascade on delete.
 * Response: { "success": true, "data": { "message": "Session discarded successfully." }, "error": null }
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/helpers.php';
bootstrap_api();
require_post();
$userId = require_auth();
require_csrf();

$data = read_json_body();
$sessionId = require_id($data, 'session_id');

try {
    $pdo = db();

    // Verify session belongs to user
    $find = $pdo->prepare(
        'SELECT session_id, status FROM teach_sessions WHERE session_id = ? AND user_id = ? LIMIT 1'
    );
    $find->execute([$sessionId, $userId]);
    $session = $find->fetch();

    if (!$session) {
        fail('That teaching session could not be found.', 404);
    }
    if ($session['status'] !== 'active') {
        fail('Only active sessions can be discarded. Completed sessions cannot be deleted.', 409);
    }

    // Delete session (messages cascade via foreign key)
    $delete = $pdo->prepare('DELETE FROM teach_sessions WHERE session_id = ? AND user_id = ?');
    $delete->execute([$sessionId, $userId]);

    json_response(true, [
        'message' => 'Session discarded successfully.',
    ]);
} catch (PDOException $e) {
    app_log('discard_session failed: ' . $e->getMessage());
    fail('We could not discard the session right now. Please try again.', 500);
}
