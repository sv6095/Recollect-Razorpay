-- Project Re-Collect Database Schema

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    amount REAL NOT NULL,
    failure_type TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'DETECTED',
    state_version INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    recovery_prob REAL DEFAULT 0.0,
    channel TEXT DEFAULT 'NONE',
    days_overdue INTEGER DEFAULT 0,
    prior_contact_count INTEGER DEFAULT 0,
    has_consent INTEGER DEFAULT 1,
    is_preemptive INTEGER DEFAULT 0,
    is_live_demo_row INTEGER DEFAULT 0,
    payment_link_id TEXT,
    payment_link_url TEXT,
    abort_reason TEXT,
    extra TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS state_transitions (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    from_state TEXT,
    to_state TEXT NOT NULL,
    agent TEXT NOT NULL DEFAULT 'system',
    reasoning TEXT DEFAULT '',
    timestamp TEXT NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    agent TEXT NOT NULL,
    input_summary TEXT DEFAULT '',
    output_json TEXT DEFAULT '{}',
    hard_block INTEGER DEFAULT 0,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS promise_to_pay (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount_promised REAL NOT NULL,
    amount_recovered REAL DEFAULT 0.0,
    due_date TEXT,
    payment_link_id TEXT,
    payment_link_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS dnd_list (
    customer_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    added_by TEXT DEFAULT 'system',
    added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS escalations (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    context_summary TEXT DEFAULT '',
    status TEXT DEFAULT 'open',
    created_at TEXT NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

-- Immutable audit log for every Razorpay webhook received
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,               -- Razorpay event_id (e.g. evt_abc123)
    event_type TEXT NOT NULL,          -- payment.failed | payment_link.paid | subscription.charged
    payload_hash TEXT NOT NULL,        -- SHA256 of raw body (tamper-evidence)
    transaction_id TEXT,               -- internal txn ID resolved from event
    merchant_id TEXT,
    processed_at TEXT NOT NULL,
    status TEXT DEFAULT 'processed'    -- processed | duplicate | failed | skipped
);

-- Message log for agent chat / WhatsApp / email / voice transcripts
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    merchant_id TEXT NOT NULL,
    direction TEXT NOT NULL,           -- outbound | inbound | system
    channel TEXT NOT NULL,             -- WHATSAPP | EMAIL | VOICE | SMS | RETRY | INTERNAL
    sender TEXT,                       -- agent_id | "customer" | "system"
    content TEXT NOT NULL,
    status TEXT DEFAULT 'queued',      -- queued | sent | delivered | read | failed
    metadata TEXT DEFAULT '{}',        -- JSON: sid, delivery_receipts, waveform, etc.
    created_at TEXT NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

-- Aggregate stats view for the dashboard header counters
CREATE VIEW IF NOT EXISTS recovery_stats AS
SELECT
    merchant_id,
    COUNT(*) as total_transactions,
    SUM(amount) as total_at_risk,
    SUM(CASE WHEN state = 'RECOVERED' THEN amount ELSE 0 END) as total_recovered,
    COUNT(CASE WHEN state = 'RECOVERED' THEN 1 END) as count_recovered,
    COUNT(CASE WHEN state = 'ABORTED' THEN 1 END) as count_aborted,
    COUNT(CASE WHEN state = 'WRITTEN_OFF' THEN 1 END) as count_written_off,
    COUNT(CASE WHEN state = 'ESCALATED' THEN 1 END) as count_escalated
FROM transactions
GROUP BY merchant_id;
