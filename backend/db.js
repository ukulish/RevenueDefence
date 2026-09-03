const Database = require("better-sqlite3");
const path = require("path");

/* =========================================================
   DATABASE SETUP
========================================================= */

const DB_PATH = path.join(
  __dirname,
  "revenue_defence.db"
);

const db = new Database(DB_PATH);

db.pragma("foreign_keys = ON");

/* =========================================================
   HELPERS
========================================================= */

function now() {
  return new Date()
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

/* =========================================================
   CUSTOMERS TABLE
========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    risk TEXT NOT NULL DEFAULT 'Low',
    score REAL NOT NULL DEFAULT 0,
    days_overdue INTEGER NOT NULL DEFAULT 0,
    payment_history REAL NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL
  );
`);

/* =========================================================
   RECOVERY ACTIONS TABLE
========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS recovery_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL,
    risk TEXT NOT NULL,
    priority TEXT NOT NULL,
    action TEXT NOT NULL,
    channel TEXT NOT NULL,
    expected_recovery REAL NOT NULL DEFAULT 0,
    reasoning TEXT,
    status TEXT NOT NULL DEFAULT 'Recommended',
    created_at TEXT NOT NULL,

    FOREIGN KEY (customer_id)
      REFERENCES customers(id)
      ON DELETE CASCADE
  );
`);

/* =========================================================
   SEED SIX CUSTOMERS
========================================================= */

const insertCustomer = db.prepare(`
  INSERT OR IGNORE INTO customers (
    id,
    name,
    amount,
    risk,
    score,
    days_overdue,
    payment_history,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedCustomers = [
  [
    "CUST-001",
    "Acme Corporation",
    12500,
    "High",
    92,
    34,
    42,
  ],
  [
    "CUST-002",
    "TechNova Solutions",
    8750,
    "Medium",
    68,
    18,
    67,
  ],
  [
    "CUST-003",
    "GlobalMart",
    5240,
    "Low",
    31,
    3,
    94,
  ],
  [
    "CUST-004",
    "Vertex Systems",
    3890,
    "Medium",
    61,
    14,
    72,
  ],
  [
    "CUST-005",
    "Nova Industries",
    15600,
    "High",
    84,
    27,
    48,
  ],
  [
    "CUST-006",
    "BluePeak Retail",
    4250,
    "Low",
    24,
    2,
    96,
  ],
];

const seedTransaction = db.transaction(() => {
  for (const customer of seedCustomers) {
    insertCustomer.run(
      customer[0],
      customer[1],
      customer[2],
      customer[3],
      customer[4],
      customer[5],
      customer[6],
      now()
    );
  }
});

seedTransaction();

/* =========================================================
   CUSTOMER QUERIES
========================================================= */

const getAllCustomersStatement = db.prepare(`
  SELECT
    id,
    name,
    amount,
    risk,
    score,
    days_overdue AS daysOverdue,
    payment_history AS paymentHistory
  FROM customers
  ORDER BY id ASC
`);

const getCustomerByIdStatement = db.prepare(`
  SELECT
    id,
    name,
    amount,
    risk,
    score,
    days_overdue AS daysOverdue,
    payment_history AS paymentHistory
  FROM customers
  WHERE id = ?
`);

const getCustomerByNameStatement = db.prepare(`
  SELECT
    id,
    name,
    amount,
    risk,
    score,
    days_overdue AS daysOverdue,
    payment_history AS paymentHistory
  FROM customers
  WHERE LOWER(name) = LOWER(?)
  LIMIT 1
`);

/* =========================================================
   CUSTOMER FUNCTIONS
========================================================= */

function getAllCustomers() {
  return getAllCustomersStatement.all();
}

function getCustomerById(id) {
  return getCustomerByIdStatement.get(id);
}

function getCustomerByName(name) {
  return getCustomerByNameStatement.get(name);
}

function findCustomer(identifier) {
  if (!identifier) {
    return null;
  }

  const value = String(identifier).trim();

  return (
    getCustomerById(value) ||
    getCustomerByName(value) ||
    null
  );
}

/* =========================================================
   RECOVERY ACTION HELPERS
========================================================= */

const recoveryActionColumns = `
  id,
  customer_id AS customerId,
  risk,
  priority,
  action,
  channel,
  expected_recovery AS expectedRecovery,
  reasoning,
  status,
  created_at AS createdAt
`;

/* =========================================================
   ACTIVE RECOVERY ACTIONS
========================================================= */

const getActiveRecoveryActionsStatement = db.prepare(`
  SELECT
    ${recoveryActionColumns}
  FROM recovery_actions
  WHERE customer_id = ?
    AND status != 'Recovered'
  ORDER BY
    CASE
      WHEN status = 'In Progress' THEN 0
      WHEN status = 'Recommended' THEN 1
      ELSE 2
    END,
    id DESC
`);

const getActiveRecoveryActionStatement = db.prepare(`
  SELECT
    ${recoveryActionColumns}
  FROM recovery_actions
  WHERE customer_id = ?
    AND status != 'Recovered'
  ORDER BY
    CASE
      WHEN status = 'In Progress' THEN 0
      WHEN status = 'Recommended' THEN 1
      ELSE 2
    END,
    id DESC
  LIMIT 1
`);

/* =========================================================
   GET ALL RECOVERY ACTIONS
========================================================= */

const getRecoveryActionsStatement = db.prepare(`
  SELECT
    ${recoveryActionColumns}
  FROM recovery_actions
  ORDER BY
    CASE
      WHEN status = 'In Progress' THEN 0
      WHEN status = 'Recommended' THEN 1
      WHEN status = 'Recovered' THEN 2
      ELSE 3
    END,
    id DESC
`);

/* =========================================================
   GET ACTION BY ID
========================================================= */

const getRecoveryActionByIdStatement = db.prepare(`
  SELECT
    ${recoveryActionColumns}
  FROM recovery_actions
  WHERE id = ?
`);

/* =========================================================
   INSERT RECOVERY ACTION
========================================================= */

const insertRecoveryActionStatement = db.prepare(`
  INSERT INTO recovery_actions (
    customer_id,
    risk,
    priority,
    action,
    channel,
    expected_recovery,
    reasoning,
    status,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

/* =========================================================
   UPDATE RECOVERY ACTION
========================================================= */

const updateRecoveryActionStatement = db.prepare(`
  UPDATE recovery_actions
  SET
    risk = ?,
    priority = ?,
    action = ?,
    channel = ?,
    expected_recovery = ?,
    reasoning = ?
  WHERE id = ?
`);

/* =========================================================
   UPDATE STATUS
========================================================= */

const updateRecoveryActionStatusStatement = db.prepare(`
  UPDATE recovery_actions
  SET status = ?
  WHERE id = ?
`);

/* =========================================================
   DELETE DUPLICATE ACTIVE ACTIONS
========================================================= */

const deleteRecoveryActionStatement = db.prepare(`
  DELETE FROM recovery_actions
  WHERE id = ?
`);

/* =========================================================
   RECOVERY ACTION CLEANUP
========================================================= */

function consolidateActiveRecoveryActions() {
  const customersWithDuplicates = db.prepare(`
    SELECT
      customer_id
    FROM recovery_actions
    WHERE status != 'Recovered'
    GROUP BY customer_id
    HAVING COUNT(*) > 1
  `).all();

  const cleanupTransaction = db.transaction(() => {
    for (const customer of customersWithDuplicates) {
      const actions =
        getActiveRecoveryActionsStatement.all(
          customer.customer_id
        );

      const actionToKeep = actions[0];

      if (!actionToKeep) {
        continue;
      }

      for (
        let i = 1;
        i < actions.length;
        i += 1
      ) {
        deleteRecoveryActionStatement.run(
          actions[i].id
        );
      }

      console.log(
        `Recovery action cleanup: kept action ${actionToKeep.id} for ${customer.customer_id}`
      );
    }
  });

  cleanupTransaction();
}

/* Run cleanup once when database loads. */
consolidateActiveRecoveryActions();

/* =========================================================
   SAVE / UPSERT RECOVERY ACTION
========================================================= */

function saveRecoveryAction({
  customerId,
  risk,
  priority,
  action,
  channel,
  expectedRecovery,
  reasoning,
  status = "Recommended",
}) {
  if (!customerId) {
    throw new Error(
      "customerId is required"
    );
  }

  const allowedStatuses = [
    "Recommended",
    "In Progress",
    "Recovered",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error(
      "Invalid recovery action status"
    );
  }

  const transaction = db.transaction(() => {
    const activeActions =
      getActiveRecoveryActionsStatement.all(
        customerId
      );

    const existingAction =
      activeActions[0];

    /* Delete duplicate active actions. */
    if (activeActions.length > 1) {
      for (
        let i = 1;
        i < activeActions.length;
        i += 1
      ) {
        deleteRecoveryActionStatement.run(
          activeActions[i].id
        );
      }
    }

    /* Update existing active action. */
    if (existingAction) {
      updateRecoveryActionStatement.run(
        risk,
        priority,
        action,
        channel,
        Number(expectedRecovery || 0),
        reasoning || "",
        existingAction.id
      );

      return getRecoveryActionById(
        existingAction.id
      );
    }

    /* Create a new action. */
    const result =
      insertRecoveryActionStatement.run(
        customerId,
        risk,
        priority,
        action,
        channel,
        Number(expectedRecovery || 0),
        reasoning || "",
        status,
        now()
      );

    return getRecoveryActionById(
      result.lastInsertRowid
    );
  });

  return transaction();
}

/* =========================================================
   GET ALL RECOVERY ACTIONS
========================================================= */

function getRecoveryActions() {
  return getRecoveryActionsStatement.all();
}

/* =========================================================
   GET RECOVERY ACTION BY ID
========================================================= */

function getRecoveryActionById(id) {
  return getRecoveryActionByIdStatement.get(
    Number(id)
  );
}

/* =========================================================
   UPDATE RECOVERY ACTION STATUS
========================================================= */

function updateRecoveryActionStatus(
  id,
  status
) {
  const allowedStatuses = [
    "Recommended",
    "In Progress",
    "Recovered",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error(
      "Invalid recovery action status"
    );
  }

  const actionId = Number(id);

  const existing =
    getRecoveryActionById(actionId);

  if (!existing) {
    return null;
  }

  updateRecoveryActionStatusStatement.run(
    status,
    actionId
  );

  return getRecoveryActionById(actionId);
}

/* =========================================================
   DATABASE STATUS
========================================================= */

function isDatabaseConnected() {
  try {
    db.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  db,

  getAllCustomers,
  getCustomerById,
  getCustomerByName,
  findCustomer,

  saveRecoveryAction,
  getRecoveryActions,
  getRecoveryActionById,
  updateRecoveryActionStatus,

  isDatabaseConnected,
};