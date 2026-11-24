# Teach-Back AI — Reverse Tutor

Teach-Back AI is a full-stack study tool built on the Feynman technique: instead of the AI lecturing you, **you teach an AI student**, then receive a structured evaluation of your explanation. Knowledge gaps are tracked automatically, and weak topics can be re-taught and compared side-by-side with previous attempts.

Stack: **PHP 8 + MariaDB (PDO) + Vanilla JS + Chart.js (CDN)** on **XAMPP (macOS & Windows)**.

---

## Required Software

1. **XAMPP** (macOS or Windows) with PHP 8.0+ and MariaDB/MySQL.
   - On macOS: XAMPP is installed at `/Applications/XAMPP/xamppfiles`.
   - PHP binary: `/Applications/XAMPP/xamppfiles/bin/php`.
   - Web root: `/Applications/XAMPP/xamppfiles/htdocs`.
   - PHP configuration: `/Applications/XAMPP/xamppfiles/etc/php.ini`.
2. **Web Browser** (Chrome, Firefox, Safari, Edge).
3. **AI API Key** from any OpenAI-compatible provider (OpenAI, OpenRouter, Groq, Together AI, Ollama, LM Studio).

---

## Installation & Setup on macOS XAMPP

### 1. Enable cURL in php.ini
Ensure the PHP cURL extension is enabled in your XAMPP configuration:
1. Open `/Applications/XAMPP/xamppfiles/etc/php.ini` in a text editor.
2. Locate the line:
   ```ini
   ;extension=curl
   ```
3. Remove the leading semicolon `;` (uncomment it):
   ```ini
   extension=curl
   ```
4. Also ensure `AllowOverride All` is set for `/Applications/XAMPP/xamppfiles/htdocs` in `/Applications/XAMPP/xamppfiles/etc/httpd.conf` so `.htaccess` protection works.
5. Restart Apache via the XAMPP Application Manager (or `/Applications/XAMPP/xamppfiles/xampp restart`).

### 2. Place Project in htdocs
Clone or copy this folder into the XAMPP web root:
```bash
cp -R /path/to/SEC_2 /Applications/XAMPP/xamppfiles/htdocs/teach-back-ai
```
Or create a symlink / work directory inside:
`/Applications/XAMPP/xamppfiles/htdocs/teach-back-ai`

### 3. Import Database Schema
1. Start MySQL/MariaDB in the XAMPP Application Manager.
2. Open **phpMyAdmin** in your browser at <http://localhost/phpmyadmin/>.
3. Click the **Import** tab.
4. Select `database/schema.sql` from the project directory and click **Go**.
   *(Alternatively, run from terminal: `/Applications/XAMPP/xamppfiles/bin/mysql -u root < database/schema.sql`)*
5. The `teach_back_ai` database will be created with all 7 tables:
   - `users`, `topics`, `teach_sessions`, `messages`, `evaluations`, `weak_areas`, `login_attempts`.

### 4. Configure config.php
1. Open `config/config.php` (copied from `config/config.sample.php` if not already present).
2. Set your database credentials and AI API credentials:
   ```php
   define('DB_HOST', '127.0.0.1');
   define('DB_PORT', '3306');
   define('DB_NAME', 'teach_back_ai');
   define('DB_USER', 'root');
   define('DB_PASS', '');

   define('AI_API_KEY', 'sk-your-openai-or-groq-key-here');
   define('AI_BASE_URL', 'https://api.openai.com/v1');
   define('AI_MODEL', 'gpt-4o-mini');
   ```
   *(Note: Any OpenAI-compatible provider works, e.g. Groq with `https://api.groq.com/openai/v1` and model `llama-3.3-70b-versatile`).*
3. You can also configure these settings via environment variables (e.g. in Apache vhost or system shell: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `DB_NAME`, `DB_USER`, `DB_PASS`).

### 5. Run the Application
Open your browser and navigate to:
<http://localhost/teach-back-ai/>

---

## How to Test Each Feature

1. **Registration & Auth**:
   - Go to `register.html`. Register a new account (e.g. `test@example.com` / `Password123!`).
   - Confirm it redirects to `login.html?registered=1` with a success notice.
   - Log in with your email and password. Confirm it issues a new session and takes you to `dashboard.html`.
2. **Start a Teaching Session**:
   - Navigate to `teach.html`.
   - Enter a Subject (e.g., `Computer Science`) and Topic (e.g., `Binary Search Trees`).
   - Select an AI student persona (`Beginner`, `Curious Kid`, `Skeptic`, or `Professor`).
   - Click **Start teaching session**.
   - The AI student initiates the conversation with an opening question matching the persona.
3. **Chat & Persistence**:
   - Respond to the AI student. Press **Enter** to send (or **Shift + Enter** for newline).
   - Verify character counter (0 / 2000) and that the Send button disables during generation.
   - Refresh the page at `teach.html?session_id=<id>`. Verify the full conversation history reloads.
4. **AI Error & Retry**:
   - If an AI call fails (or test with an invalid key), your user message remains saved in the chat window, and an error notice appears with a **Retry** button.
   - Clicking **Retry** invokes `chat.php` with `{ retry: true }` without re-saving duplicate messages.
5. **Early Discard**:
   - If you click **End & evaluate** with fewer than 3 teaching messages, a dialog informs you that at least 3 messages are required.
   - Click **Discard session** to delete the incomplete session and return cleanly to setup.
6. **Evaluation & Scoring**:
   - Explain your topic through at least 3 messages.
   - Click **End & evaluate**.
   - The evaluator analyzes your explanation, checks factual accuracy, clarity, completeness, and concrete examples, and generates score badges, knowledge gaps, misconceptions, missing concepts, and recommendations.
   - Overall score is computed by PHP as the average of the 4 scores rounded to 1 decimal.
7. **Re-teach Mode**:
   - If an evaluation scores below 6.0 (or via history), click **Re-teach this topic**.
   - It redirects to `teach.html?reteach=<id>`, pre-filling the subject and topic in read-only mode.
   - Teach the lesson again. Upon evaluation, a side-by-side comparison table displays:
     - Improved scores in **green**
     - Unchanged scores in **grey**
     - Declined scores in **red**
8. **Dashboard & Charts**:
   - View `dashboard.html`.
   - Verify Chart.js renders the Score Trend line chart, Topic Averages bar chart, Strong vs Weak doughnut chart, and recurring gaps as text (e.g., "Time complexity missed in 3 sessions").
9. **History & Pagination**:
   - View `history.html` to browse past sessions.
   - Filter by All / Completed / Active.
   - Open detail modal to review full transcripts and evaluations.
   - Click "Continue" for active sessions or "Re-teach" for completed weak sessions (< 6.0).

---

## Optional Demo Data Seed

To populate sample sessions and trend charts for testing:
1. Register an account through `register.html`.
2. Look up your `user_id` in MySQL:
   ```sql
   SELECT user_id, email FROM users;
   ```
3. Open `database/seed.sql` and change line 17 to your ID:
   ```sql
   SET @uid = 1; -- change to your registered user_id
   ```
4. Import `database/seed.sql` in phpMyAdmin or via terminal:
   ```bash
   /Applications/XAMPP/xamppfiles/bin/mysql -u root teach_back_ai < database/seed.sql
   ```
5. Reload `dashboard.html` to view the seeded metrics and comparison graphs.

---

## Common Errors & Troubleshooting

| Symptom / Error | Likely Cause | Solution |
| :--- | :--- | :--- |
| **cURL disabled** (`The PHP cURL extension is not enabled`) | `extension=curl` is commented out in `php.ini`. | Open `/Applications/XAMPP/xamppfiles/etc/php.ini`, remove `;` before `extension=curl`, and restart Apache. |
| **401 from AI API** (`AI service rejected the API key`) | `AI_API_KEY` is missing, expired, or invalid. | Verify `AI_API_KEY` in `config/config.php` or check your provider account credits. |
| **DB connection refused** (`Database connection failed`) | MySQL is stopped or port/credentials mismatch. | Ensure MySQL is running in XAMPP; verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` in `config/config.php`. |
| **Blank page / PHP errors** | PHP version < 8.0, syntax error, or unhandled exception. | Teach-Back AI requires PHP 8.0+. Check `/Applications/XAMPP/xamppfiles/logs/php_error_log` for stack traces. |
| **CSRF failures** (`session expired or form out of date`, 403) | Missing or invalid `X-CSRF-Token` header, or PHP session cannot write to `session.save_path`. | The app auto-fallbacks to system temp for sessions. Ensure cookies are enabled on `localhost` and refresh the page. |
| **Invalid AI JSON** (`AI evaluator returned an invalid report`) | AI model returned conversational markdown instead of raw JSON. | The backend automatically strips code fences and retries once. Ensure `AI_JSON_MODE` is enabled or use a reliable model like `gpt-4o-mini`. |
| **Rate-limit lockout** (`Too many failed login attempts`, 429) | More than 5 failed logins for an email or 20 for an IP in 15 minutes. | Wait 15 minutes, or clear rows from `login_attempts` in phpMyAdmin: `DELETE FROM login_attempts;`. |
| **.htaccess ignored / 403 missing** | Apache `AllowOverride` is set to `None` in `httpd.conf`. | Edit `/Applications/XAMPP/xamppfiles/etc/httpd.conf`, set `AllowOverride All` for the `htdocs` directory block, and restart Apache. |

---

## Security Architecture

- **Prepared Statements**: 100% of SQL queries use PDO prepared statements with bound parameters.
- **CSRF Protection**: All state-changing POST requests validate `X-CSRF-Token` via constant-time `hash_equals()`.
- **Session Hardening**: Sessions configured with `HttpOnly`, `SameSite=Lax`, `use_strict_mode=1`, and `session_regenerate_id(true)` upon authentication.
- **Tenant Isolation**: All session, chat, and evaluation queries enforce `WHERE user_id = ?`. Queries for unauthorized IDs return 404 (never leaking existence).
- **DOM Safety**: All dynamic student/AI content is inserted via `textContent` — never raw `innerHTML`.
- **Rate Limiting**: Failed authentication attempts are logged and throttled by IP and email.
# SEC_2.0
