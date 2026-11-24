-- ============================================================
-- Teach-Back AI — optional demo seed
-- ============================================================
-- HOW TO USE
--   1. Import database/schema.sql first.
--   2. Register a real account through the app (register.html).
--   3. Find that account's user_id (SELECT user_id, email FROM users;).
--   4. Change @uid below to that id, then import this file.
--   5. Reload the dashboard.
--
-- This file intentionally does NOT insert a users row or a fake password
-- hash. Passwords must be created by the application with password_hash().
-- Run it once on a test account; re-running adds another set of sessions.
-- ============================================================
USE teach_back_ai_rebuild;

SET @uid = 1; -- <<< CHANGE THIS to your registered user_id

-- Make the intent obvious if the user id is wrong, instead of silently
-- creating orphan-looking demo data.
SELECT CONCAT('Seeding demo data for user_id ', @uid, ' (', COALESCE((SELECT email FROM users WHERE user_id = @uid), 'NOT FOUND'), ')') AS seed_target;

SET @now = NOW();

-- ------------------------------------------------------------
-- Topic 1: Computer Science / Binary search trees
-- ------------------------------------------------------------
INSERT INTO topics (user_id, subject, topic_name)
VALUES (@uid, 'Computer Science', 'Binary search trees')
ON DUPLICATE KEY UPDATE topic_id = LAST_INSERT_ID(topic_id);
SET @topic_bst = LAST_INSERT_ID();

-- Session 1: an older attempt that scored below 6.
SET @start1 = DATE_SUB(@now, INTERVAL 14 DAY);
SET @end1 = DATE_ADD(@start1, INTERVAL 12 MINUTE);

INSERT INTO teach_sessions
  (user_id, topic_id, persona, status, previous_session_id, started_at, ended_at)
VALUES
  (@uid, @topic_bst, 'skeptic', 'completed', NULL, @start1, @end1);
SET @s1 = LAST_INSERT_ID();

INSERT INTO messages (session_id, sender, content, sent_at) VALUES
  (@s1, 'ai', 'Before we start, what is the main idea behind a binary search tree?', DATE_ADD(@start1, INTERVAL 20 SECOND)),
  (@s1, 'user', 'A binary search tree is a tree where each node has at most two children. The left side is smaller than the node and the right side is larger.', DATE_ADD(@start1, INTERVAL 2 MINUTE)),
  (@s1, 'ai', 'Okay, but why is that ordering useful when I want to find a value?', DATE_ADD(@start1, INTERVAL 140 SECOND)),
  (@s1, 'user', 'Because you can skip half of the tree at each step. If the value is bigger you go right, otherwise left.', DATE_ADD(@start1, INTERVAL 4 MINUTE)),
  (@s1, 'ai', 'How do you know it really skips half? Could it ever be slow?', DATE_ADD(@start1, INTERVAL 260 SECOND)),
  (@s1, 'user', 'You compare with the root and move down one level each time. I think it is fast because the tree is sorted.', DATE_ADD(@start1, INTERVAL 6 MINUTE)),
  (@s1, 'ai', 'What happens if the tree is shaped like a long chain?', DATE_ADD(@start1, INTERVAL 380 SECOND)),
  (@s1, 'user', 'Then it would be slower, but normally we keep the tree balanced.', DATE_ADD(@start1, INTERVAL 8 MINUTE)),
  (@s1, 'ai', 'Can you give me a simple example of inserting a value?', DATE_ADD(@start1, INTERVAL 500 SECOND)),
  (@s1, 'user', 'Insert 5 at the root, then 3 goes left, 7 goes right, and 4 goes right of 3. I did not really talk about deletion or the exact complexity.', DATE_ADD(@start1, INTERVAL 10 MINUTE));

INSERT INTO evaluations
  (session_id, accuracy, clarity, completeness, examples, overall_score,
   gaps, misconceptions, missing_concepts, suggestions, summary, created_at)
VALUES
  (@s1, 5, 6, 4, 3, 4.5,
   '["Time complexity was not explained","Balanced vs unbalanced trees were only mentioned","Deletion was not covered"]',
   '["The explanation implied a binary search tree is always O(log n), even without balancing"]',
   '["O(log n) average search complexity","O(n) worst-case complexity","Tree balancing","Deletion cases"]',
   '["Explain why an unbalanced tree can degrade to a linked list","State the average and worst-case time complexity","Walk through one insertion and one deletion"]',
   'The core ordering idea is correct, but the explanation is incomplete and the performance claim is too broad. Time complexity and balancing need another pass.',
   @end1);

-- Session 2: a re-teach of the same topic with a better result.
SET @start2 = DATE_SUB(@now, INTERVAL 5 DAY);
SET @end2 = DATE_ADD(@start2, INTERVAL 15 MINUTE);

INSERT INTO teach_sessions
  (user_id, topic_id, persona, status, previous_session_id, started_at, ended_at)
VALUES
  (@uid, @topic_bst, 'beginner', 'completed', @s1, @start2, @end2);
SET @s2 = LAST_INSERT_ID();

INSERT INTO messages (session_id, sender, content, sent_at) VALUES
  (@s2, 'ai', 'I am new to trees. What is a binary search tree in plain words?', DATE_ADD(@start2, INTERVAL 20 SECOND)),
  (@s2, 'user', 'It is a tree of nodes. Each node can have a left child and a right child. Every left descendant is smaller and every right descendant is larger than the node.', DATE_ADD(@start2, INTERVAL 2 MINUTE)),
  (@s2, 'ai', 'Why does that help me find something faster?', DATE_ADD(@start2, INTERVAL 140 SECOND)),
  (@s2, 'user', 'At every node you compare once, then discard one whole side. If the tree is balanced, the height is about log base 2 of n, so search is O(log n) on average. In the worst case, if it becomes a chain, it is O(n).', DATE_ADD(@start2, INTERVAL 4 MINUTE)),
  (@s2, 'ai', 'Can you show me a tiny example with numbers?', DATE_ADD(@start2, INTERVAL 260 SECOND)),
  (@s2, 'user', 'Start with 8. Insert 4, which goes left. Insert 12, which goes right. Insert 6: it is less than 8 so go left, then greater than 4 so go right. The tree is 8 with children 4 and 12, and 4 has a right child 6.', DATE_ADD(@start2, INTERVAL 6 MINUTE)),
  (@s2, 'ai', 'What keeps the height small in real code?', DATE_ADD(@start2, INTERVAL 380 SECOND)),
  (@s2, 'user', 'Balanced variants such as AVL trees or red-black trees rotate nodes after inserts and deletes. That keeps the height logarithmic. A plain BST does not guarantee that.', DATE_ADD(@start2, INTERVAL 8 MINUTE)),
  (@s2, 'ai', 'What about deleting a node with two children?', DATE_ADD(@start2, INTERVAL 500 SECOND)),
  (@s2, 'user', 'You replace it with its in-order successor, the smallest value in its right subtree, and then delete that successor from its old position. I should still practise the four balancing rotations, but the core search and delete cases make sense now.', DATE_ADD(@start2, INTERVAL 10 MINUTE));

INSERT INTO evaluations
  (session_id, accuracy, clarity, completeness, examples, overall_score,
   gaps, misconceptions, missing_concepts, suggestions, summary, created_at)
VALUES
  (@s2, 7, 8, 6, 6, 6.8,
   '["Balancing rotations were named but not demonstrated"]',
   '[]',
   '["Detailed AVL or red-black rotation cases"]',
   '["Walk through one left rotation","Compare average and worst-case complexity in the same breath"]',
   'This re-teach is much clearer: the ordering rule, the comparison search, an insertion example, and the average versus worst-case complexity are all present. Balancing details remain the main gap.',
   @end2);

-- ------------------------------------------------------------
-- Topic 2: Biology / Cellular respiration (active example)
-- ------------------------------------------------------------
INSERT INTO topics (user_id, subject, topic_name)
VALUES (@uid, 'Biology', 'Cellular respiration')
ON DUPLICATE KEY UPDATE topic_id = LAST_INSERT_ID(topic_id);
SET @topic_bio = LAST_INSERT_ID();

SET @start3 = DATE_SUB(@now, INTERVAL 1 DAY);
INSERT INTO teach_sessions
  (user_id, topic_id, persona, status, previous_session_id, started_at, ended_at)
VALUES
  (@uid, @topic_bio, 'kid', 'active', NULL, @start3, NULL);
SET @s3 = LAST_INSERT_ID();

INSERT INTO messages (session_id, sender, content, sent_at) VALUES
  (@s3, 'ai', 'What is cellular respiration? Pretend I am ten.', DATE_ADD(@start3, INTERVAL 20 SECOND)),
  (@s3, 'user', 'It is how cells get energy from food. They break down sugar and store the energy in a molecule called ATP.', DATE_ADD(@start3, INTERVAL 2 MINUTE)),
  (@s3, 'ai', 'Where does the sugar come from, and why do we breathe?', DATE_ADD(@start3, INTERVAL 140 SECOND)),
  (@s3, 'user', 'Sugar comes from food. We breathe oxygen because it is used at the end of the process, in the mitochondria, to help make a lot of ATP. Carbon dioxide is released.', DATE_ADD(@start3, INTERVAL 4 MINUTE));

-- ------------------------------------------------------------
-- Recurring weak-area tags for the dashboard demo.
-- The real app creates these automatically during evaluation.
-- ------------------------------------------------------------
INSERT INTO weak_areas (user_id, topic_id, gap_tag, times_repeated, last_seen_at)
VALUES
  (@uid, @topic_bst, 'time complexity', 3, @now),
  (@uid, @topic_bst, 'tree balancing', 2, @now),
  (@uid, @topic_bst, 'deletion', 2, @now)
ON DUPLICATE KEY UPDATE
  times_repeated = GREATEST(times_repeated, VALUES(times_repeated)),
  last_seen_at = VALUES(last_seen_at);

SELECT 'Seed complete. Reload the dashboard.' AS result;
