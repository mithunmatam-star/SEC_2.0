
<?php
/**
 * POST api/register.php
 *
 * Body:
 * {
 *   "name": "Student Name",
 *   "email": "student@example.com",
 *   "password": "password123",
 *   "confirm_password": "password123"
 * }
 *
 * Registers a new user.
 * Validates input, checks duplicate email,
 * hashes password and inserts the account.
 */

// Load application helpers
require_once __DIR__ . '/../config/helpers.php';

// Initialize API
bootstrap_api();

// Request validation
require_post();
require_csrf();

// Read JSON request
$data = read_json_body();

// ============================================================
// NAME VALIDATION
// ============================================================

$name = require_string(
    $data,
    'name',
    'Full name',
    1,
    100
);

// Remove extra spaces
$name = preg_replace('/\s+/u', ' ', trim($name)) ?? trim($name);

// ============================================================
// EMAIL VALIDATION
// ============================================================

$email = require_email($data, 'email');

// ============================================================
// PASSWORD VALIDATION
// ============================================================

$password = $data['password'] ?? null;

if (!is_string($password) || $password === '') {
    fail('Password is required.', 422);
}

$passwordBytes = strlen($password);

if ($passwordBytes < 8) {
    fail('Password must be at least 8 characters.', 422);
}

if ($passwordBytes > 72) {
    fail('Password must not exceed 72 bytes.', 422);
}

// ============================================================
// CONFIRM PASSWORD VALIDATION
// ============================================================

$confirm = $data['confirm_password'] ?? null;

if (!is_string($confirm) || $confirm === '') {
    fail('Please confirm your password.', 422);
}

if (!hash_equals($password, $confirm)) {
    fail('The two passwords do not match.', 422);
}

// ============================================================
// DATABASE REGISTRATION
// ============================================================

try {

    // Connect to database
    $pdo = db();

    // Check whether email already exists
    $check = $pdo->prepare(
        'SELECT user_id FROM users WHERE email = ? LIMIT 1'
    );

    $check->execute([$email]);

    if ($check->fetch()) {
        fail(
            'An account with that email already exists. Try logging in instead.',
            409
        );
    }

    // Hash password securely
    $hash = password_hash($password, PASSWORD_DEFAULT);

    if ($hash === false) {
        fail('Unable to secure your password. Please try again.', 500);
    }

    // Insert new user
    $insert = $pdo->prepare(
        'INSERT INTO users (name, email, password)
         VALUES (?, ?, ?)'
    );

    $insert->execute([
        $name,
        $email,
        $hash
    ]);

    // Successful registration
    json_response(
        true,
        [
            'message' => 'Account created successfully. You can now log in.'
        ],
        null,
        201
    );

} catch (PDOException $e) {

    // Duplicate email protection
    if ($e->getCode() === '23000') {
        fail(
            'An account with that email already exists. Try logging in instead.',
            409
        );
    }

    // Record database error
    app_log('Register failed: ' . $e->getMessage());

    fail(
        'We could not create your account right now. Please try again.',
        500
    );

}
