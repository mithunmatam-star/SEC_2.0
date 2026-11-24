<?php
/**
 * GET api/history.php?page=&per_page=   → paginated sessions list
 * GET api/history.php?session_id=       → single session + messages + evaluation + comparison
 *
 * Ordered by message_id ASC for messages.
 * Filtered by logged-in user_id. Returns 404 for other users' sessions.
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/helpers.php';
bootstrap_api();
$userId = require_auth();

try {
    $pdo = db();

    // Single session detail
    if (isset($_GET['session_id'])) {
        $sessionId = filter_var($_GET['session_id'], FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1],
        ]);
        if ($sessionId === false) {
            fail('A valid session_id is required.', 422);
        }

        $stmt = $pdo->prepare(
            'SELECT s.session_id, s.persona, s.status, s.previous_session_id,
                    s.started_at, s.ended_at,
                    t.topic_id, t.subject, t.topic_name,
                    e.overall_score
             FROM teach_sessions s
             JOIN topics t ON t.topic_id = s.topic_id
             LEFT JOIN evaluations e ON e.session_id = s.session_id
             WHERE s.session_id = ? AND s.user_id = ?
             LIMIT 1'
        );
        $stmt->execute([$sessionId, $userId]);
        $session = $stmt->fetch();

        if (!$session) {
            fail('That teaching session could not be found.', 404);
        }

        // Fetch messages: MUST be ordered by message_id ASC, never sent_at
        $msgStmt = $pdo->prepare(
            'SELECT m.message_id, m.sender, m.content, m.sent_at
             FROM messages m
             JOIN teach_sessions s ON s.session_id = m.session_id
             WHERE m.session_id = ? AND s.user_id = ?
             ORDER BY m.message_id ASC'
        );
        $msgStmt->execute([$sessionId, $userId]);
        $messages = [];
        foreach ($msgStmt->fetchAll() as $row) {
            $messages[] = [
                'message_id' => (int) $row['message_id'],
                'sender'     => (string) $row['sender'],
                'content'    => (string) $row['content'],
                'sent_at'    => (string) $row['sent_at'],
            ];
        }

        // Fetch evaluation if present
        $evaluation = null;
        $evalRow = fetch_evaluation($pdo, $sessionId, $userId);
        if ($evalRow) {
            $evaluation = evaluation_payload($evalRow);
        }

        // Fetch comparison if previous_session_id is set
        $previousSessionId = $session['previous_session_id'] !== null
            ? (int) $session['previous_session_id']
            : null;
        $comparison = null;
        if ($evaluation && $previousSessionId) {
            $prevEval = fetch_previous_evaluation($pdo, $previousSessionId, $userId);
            $comparison = build_evaluation_comparison($evaluation, $prevEval, $previousSessionId);
        }

        json_response(true, [
            'session' => [
                'session_id'          => (int) $session['session_id'],
                'topic_id'            => (int) $session['topic_id'],
                'subject'             => (string) $session['subject'],
                'topic_name'          => (string) $session['topic_name'],
                'persona'             => (string) $session['persona'],
                'status'              => (string) $session['status'],
                'previous_session_id' => $previousSessionId,
                'started_at'          => (string) $session['started_at'],
                'ended_at'            => $session['ended_at'] !== null ? (string) $session['ended_at'] : null,
                'overall_score'       => $session['overall_score'] !== null ? round((float) $session['overall_score'], 1) : null,
            ],
            'messages'   => $messages,
            'evaluation' => $evaluation,
            'comparison' => $comparison,
        ]);
    }

    // Paginated list
    $page = isset($_GET['page']) ? max(1, (int) $_GET['page']) : 1;
    $perPage = isset($_GET['per_page']) ? max(1, min(100, (int) $_GET['per_page'])) : 20;
    $offset = ($page - 1) * $perPage;

    $totalStmt = $pdo->prepare('SELECT COUNT(*) FROM teach_sessions WHERE user_id = ?');
    $totalStmt->execute([$userId]);
    $total = (int) $totalStmt->fetchColumn();

    $listStmt = $pdo->prepare(
        'SELECT s.session_id, t.subject, t.topic_name, s.persona, s.status,
                s.started_at, s.ended_at, e.overall_score, s.previous_session_id
         FROM teach_sessions s
         JOIN topics t ON t.topic_id = s.topic_id
         LEFT JOIN evaluations e ON e.session_id = s.session_id
         WHERE s.user_id = ?
         ORDER BY s.started_at DESC, s.session_id DESC
         LIMIT ? OFFSET ?'
    );
    // Explicitly bind integers for LIMIT and OFFSET
    $listStmt->bindValue(1, $userId, PDO::PARAM_INT);
    $listStmt->bindValue(2, $perPage, PDO::PARAM_INT);
    $listStmt->bindValue(3, $offset, PDO::PARAM_INT);
    $listStmt->execute();

    $sessions = [];
    foreach ($listStmt->fetchAll() as $row) {
        $sessions[] = [
            'session_id'          => (int) $row['session_id'],
            'subject'             => (string) $row['subject'],
            'topic_name'          => (string) $row['topic_name'],
            'persona'             => (string) $row['persona'],
            'status'              => (string) $row['status'],
            'started_at'          => (string) $row['started_at'],
            'ended_at'            => $row['ended_at'] !== null ? (string) $row['ended_at'] : null,
            'overall_score'       => $row['overall_score'] !== null ? round((float) $row['overall_score'], 1) : null,
            'previous_session_id' => $row['previous_session_id'] !== null ? (int) $row['previous_session_id'] : null,
        ];
    }

    json_response(true, [
        'sessions' => $sessions,
        'total'    => $total,
    ]);
} catch (PDOException $e) {
    app_log('history failed: ' . $e->getMessage());
    fail('We could not load your history right now. Please try again.', 500);
}
