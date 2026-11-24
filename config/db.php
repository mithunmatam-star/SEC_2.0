<?php
/**
 * PDO database connection (singleton).
 *
 * Usage: $pdo = db();
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        DB_HOST,
        DB_PORT,
        DB_NAME
    );

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        // The endpoint bootstrap logs the technical detail and returns a
        // generic JSON error, so users never see credentials or SQL.
        error_log('[teach-back-ai] DB connection failed: ' . $e->getMessage());
        throw new RuntimeException('Database connection failed.', 0, $e);
    }

    return $pdo;
}
