<?php
/**
 * POST api/login.php
 * Body: { email, password }
 *
 * Authenticates a user.
 * Rate limited using login_attempts:
 * - Block with 429 when the same email has >= 5 failed attempts in 15 minutes
 * - Block with 429 when the same IP has >= 20 failed attempts in 15 minutes
 * Inserts a row on every failed login (including unknown emails).
 * Deletes that email's rows on success.
 * Occasionally purges rows older than 1 day.
 * Returns: { user: { user_id, name }, csrf_token }
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/helpers.php';
bootstrap_api();
require_post();
require_csrf();

$data = read_json_body();
$email = require_email($data, 'email');

$password = $data['password'] ?? null;
if (!is_string($password) || $password === '') {
    fail('Password is required.', 422);
}

$ip = substr((string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);

try {
    $pdo = db();

    // Check rate limit: >= 5 failed attempts for this email in 15 minutes
    $emailCountStmt = $pdo->prepare(
        'SELECT COUNT(*) FROM login_attempts
         WHERE email = ? AND attempted_at > (NOW() - INTERVAL 15 MINUTE)'
    );
    $emailCountStmt->execute([$email]);
    if ((int) $emailCountStmt->fetchColumn() >= 5) {
        fail('Too many failed login attempts for this email. Please wait 15 minutes and try again.', 429);
    }

    // Check rate limit: >= 20 failed attempts for this IP in 15 minutes
    $ipCountStmt = $pdo->prepare(
        'SELECT COUNT(*) FROM login_attempts
         WHERE ip_address = ? AND attempted_at > (NOW() - INTERVAL 15 MINUTE)'
    );
    $ipCountStmt->execute([$ip]);
    if ((int) $ipCountStmt->fetchColumn() >= 20) {
        fail('Too many failed login attempts from your IP address. Please wait 15 minutes and try again.', 429);
    }

    // Look up user
    $find = $pdo->prepare('SELECT user_id, name, email, password FROM users WHERE email = ? LIMIT 1');
    $find->execute([$email]);
    $user = $find->fetch();

    if (!$user || !password_verify($password, (string) $user['password'])) {
        // Record failed attempt for both known and unknown emails
        $record = $pdo->prepare('INSERT INTO login_attempts (email, ip_address) VALUES (?, ?)');
        $record->execute([$email, $ip]);
        fail('Invalid email or password.', 401);
    }

    // Login successful: delete this email's failed attempt rows
    $clear = $pdo->prepare('DELETE FROM login_attempts WHERE email = ?');
    $clear->execute([$email]);

    // Occasionally purge login_attempts older than 1 day (~5% of successful logins)
    if (random_int(1, 20) === 1) {
        $pdo->query('DELETE FROM login_attempts WHERE attempted_at < (NOW() - INTERVAL 1 DAY)');
    }

    // Regenerate session id and CSRF token to prevent session fixation
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['user_id'];
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

    json_response(true, [
        'user' => [
            'user_id' => (int) $user['user_id'],
            'name'    => $user['name'],
        ],
        'csrf_token' => $_SESSION['csrf_token'],
    ]);
} catch (PDOException $e) {
    app_log('login failed: ' . $e->getMessage());
    fail('We could not log you in right now. Please try again.', 500);
}
