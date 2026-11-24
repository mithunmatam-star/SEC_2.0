<?php
/**
 * GET api/dashboard.php
 *
 * Computes dashboard metrics and progress for the logged-in user.
 * Counts only completed sessions with an evaluation for score averages.
 *
 * Response: {
 *   user_name,
 *   total_sessions,
 *   completed_sessions,
 *   average_score,
 *   strongest_topics[],
 *   weakest_topics[],
 *   recent_sessions[],
 *   score_trend: [{session_id, date, overall_score, topic_name}], // latest 20
 *   topic_averages: [{topic_name, avg_score, session_count}],
 *   strong_vs_weak: {strong, middle, weak},
 *   recurring_gaps: [{gap_tag, topic_name, times_repeated}] // only times_repeated >= 2
 * }
 */
declare(strict_types=1);

require_once __DIR__ . '/../config/helpers.php';
bootstrap_api();
$userId = require_auth();

try {
    $pdo = db();

    // User name
    $userStmt = $pdo->prepare('SELECT name FROM users WHERE user_id = ? LIMIT 1');
    $userStmt->execute([$userId]);
    $userName = (string) ($userStmt->fetchColumn() ?: 'Student');

    // Total and completed sessions
    $statsStmt = $pdo->prepare(
        'SELECT COUNT(*) AS total_sessions,
                COALESCE(SUM(status = \'completed\'), 0) AS completed_sessions
         FROM teach_sessions WHERE user_id = ?'
    );
    $statsStmt->execute([$userId]);
    $rawStats = $statsStmt->fetch() ?: ['total_sessions' => 0, 'completed_sessions' => 0];
    $totalSessions = (int) $rawStats['total_sessions'];
    $completedSessions = (int) $rawStats['completed_sessions'];

    // Overall average score from evaluated sessions
    $avgStmt = $pdo->prepare(
        'SELECT AVG(e.overall_score) AS average_score
         FROM evaluations e
         JOIN teach_sessions s ON s.session_id = e.session_id
         WHERE s.user_id = ? AND s.status = \'completed\''
    );
    $avgStmt->execute([$userId]);
    $rawAvg = $avgStmt->fetchColumn();
    $averageScore = $rawAvg !== false && $rawAvg !== null ? round((float) $rawAvg, 1) : null;

    // Topic averages
    $topicStmt = $pdo->prepare(
        'SELECT t.topic_id, t.subject, t.topic_name,
                AVG(e.overall_score) AS avg_score,
                COUNT(*) AS session_count
         FROM evaluations e
         JOIN teach_sessions s ON s.session_id = e.session_id
         JOIN topics t ON t.topic_id = s.topic_id
         WHERE s.user_id = ? AND s.status = \'completed\'
         GROUP BY t.topic_id, t.subject, t.topic_name
         ORDER BY avg_score DESC, t.topic_name ASC'
    );
    $topicStmt->execute([$userId]);
    $topicAverages = [];
    $strongCount = 0;
    $middleCount = 0;
    $weakCount = 0;

    foreach ($topicStmt->fetchAll() as $row) {
        $score = round((float) $row['avg_score'], 1);
        $count = (int) $row['session_count'];
        $item = [
            'topic_id'      => (int) $row['topic_id'],
            'subject'       => $row['subject'],
            'topic_name'    => $row['topic_name'],
            'avg_score'     => $score,
            'session_count' => $count,
        ];
        $topicAverages[] = $item;

        if ($score >= 7.0) {
            $strongCount++;
        } elseif ($score < 6.0) {
            $weakCount++;
        } else {
            $middleCount++;
        }
    }

    // Strongest topics (avg_score >= 7.0) sorted DESC, max 5
    $strongest = array_values(array_filter($topicAverages, static fn (array $t): bool => $t['avg_score'] >= 7.0));
    usort($strongest, static fn (array $a, array $b): int => $b['avg_score'] <=> $a['avg_score']);
    $strongest = array_slice($strongest, 0, 5);

    // Weakest topics (avg_score < 6.0) sorted ASC, max 5
    $weakest = array_values(array_filter($topicAverages, static fn (array $t): bool => $t['avg_score'] < 6.0));
    usort($weakest, static fn (array $a, array $b): int => $a['avg_score'] <=> $b['avg_score']);
    $weakest = array_slice($weakest, 0, 5);

    // Strong vs weak distribution
    $strongVsWeak = [
        'strong' => $strongCount,
        'middle' => $middleCount,
        'weak'   => $weakCount,
    ];

    // Score trend: latest 20 completed sessions with evaluations, chronological
    $trendStmt = $pdo->prepare(
        'SELECT s.session_id,
                COALESCE(s.ended_at, s.started_at) AS date,
                e.overall_score,
                t.topic_name
         FROM evaluations e
         JOIN teach_sessions s ON s.session_id = e.session_id
         JOIN topics t ON t.topic_id = s.topic_id
         WHERE s.user_id = ? AND s.status = \'completed\'
         ORDER BY s.session_id DESC
         LIMIT 20'
    );
    $trendStmt->execute([$userId]);
    $trendRows = array_reverse($trendStmt->fetchAll());
    $scoreTrend = [];
    foreach ($trendRows as $row) {
        $timestamp = strtotime((string) $row['date']);
        $formattedDate = $timestamp ? date('M j', $timestamp) : (string) $row['date'];
        $scoreTrend[] = [
            'session_id'    => (int) $row['session_id'],
            'date'          => $formattedDate,
            'overall_score' => round((float) $row['overall_score'], 1),
            'topic_name'    => (string) $row['topic_name'],
        ];
    }

    // Recent sessions (latest 6)
    $recentStmt = $pdo->prepare(
        'SELECT s.session_id, s.persona, s.status, s.previous_session_id,
                s.started_at, s.ended_at,
                t.subject, t.topic_name, e.overall_score
         FROM teach_sessions s
         JOIN topics t ON t.topic_id = s.topic_id
         LEFT JOIN evaluations e ON e.session_id = s.session_id
         WHERE s.user_id = ?
         ORDER BY s.started_at DESC, s.session_id DESC
         LIMIT 6'
    );
    $recentStmt->execute([$userId]);
    $recent = [];
    foreach ($recentStmt->fetchAll() as $row) {
        $recent[] = [
            'session_id'          => (int) $row['session_id'],
            'subject'             => $row['subject'],
            'topic_name'          => $row['topic_name'],
            'persona'             => $row['persona'],
            'status'              => $row['status'],
            'previous_session_id' => $row['previous_session_id'] !== null ? (int) $row['previous_session_id'] : null,
            'overall_score'       => $row['overall_score'] !== null ? round((float) $row['overall_score'], 1) : null,
            'started_at'          => $row['started_at'],
            'ended_at'            => $row['ended_at'],
        ];
    }

    // Recurring gaps: weak_areas where times_repeated >= 2
    $gapsStmt = $pdo->prepare(
        'SELECT w.gap_tag, t.topic_name, w.times_repeated
         FROM weak_areas w
         JOIN topics t ON t.topic_id = w.topic_id
         WHERE w.user_id = ? AND w.times_repeated >= 2
         ORDER BY w.times_repeated DESC, w.last_seen_at DESC
         LIMIT 10'
    );
    $gapsStmt->execute([$userId]);
    $recurringGaps = [];
    foreach ($gapsStmt->fetchAll() as $row) {
        $recurringGaps[] = [
            'gap_tag'        => (string) $row['gap_tag'],
            'topic_name'     => (string) $row['topic_name'],
            'times_repeated' => (int) $row['times_repeated'],
        ];
    }

    json_response(true, [
        'user_name'          => $userName,
        'total_sessions'     => $totalSessions,
        'completed_sessions' => $completedSessions,
        'average_score'      => $averageScore,
        'strongest_topics'   => $strongest,
        'weakest_topics'     => $weakest,
        'recent_sessions'    => $recent,
        'score_trend'        => $scoreTrend,
        'topic_averages'     => $topicAverages,
        'strong_vs_weak'     => $strongVsWeak,
        'recurring_gaps'     => $recurringGaps,
    ]);
} catch (PDOException $e) {
    app_log('dashboard failed: ' . $e->getMessage());
    fail('We could not load your dashboard right now. Please try again.', 500);
}
