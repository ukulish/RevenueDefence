const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");

require("dotenv").config();

/* =========================================================
   DATABASE
========================================================= */

const {
  getAllCustomers,
  findCustomer,
  saveRecoveryAction,
  getRecoveryActions,
  updateRecoveryActionStatus,
  getRecoveryActionById,
} = require("./db");

/* =========================================================
   APP
========================================================= */

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/* =========================================================
   HELPERS
========================================================= */

function normalizeRisk(value) {
  const risk = String(value || "")
    .trim()
    .toLowerCase();

  if (risk === "high") return "High";
  if (risk === "medium") return "Medium";
  if (risk === "low") return "Low";

  return "";
}

function resolveRisk(
  risk,
  riskScore,
  customerRecord = null
) {
  const normalizedRisk = normalizeRisk(risk);
  const score = Number(riskScore);

  /*
    Score always takes priority when available.
  */

  if (Number.isFinite(score) && score >= 75) {
    return "High";
  }

  if (Number.isFinite(score) && score >= 50) {
    return "Medium";
  }

  if (normalizedRisk) {
    return normalizedRisk;
  }

  if (customerRecord?.risk) {
    return (
      normalizeRisk(customerRecord.risk) ||
      "Low"
    );
  }

  return "Low";
}

/* =========================================================
   PERSISTENT ML WORKER
========================================================= */

const pythonScript = path.join(
  __dirname,
  "ml",
  "worker.py"
);

const pythonCommand =
  process.platform === "win32"
    ? "py"
    : "python3";

console.log(
  "Starting persistent ML worker..."
);

const mlWorker = spawn(
  pythonCommand,
  [pythonScript],
  {
    cwd: __dirname,
    windowsHide: true,
  }
);

let mlWorkerReady = false;
let mlWorkerBuffer = "";
let mlWorkerRequests = [];
let mlWorkerRequestId = 0;

/* =========================================================
   ML WORKER REQUEST MANAGEMENT
========================================================= */

function rejectPendingMLRequests(error) {
  const pending =
    mlWorkerRequests;

  mlWorkerRequests = [];

  pending.forEach((request) => {
    request.reject(error);
  });
}

mlWorker.stdout.on("data", (data) => {
  mlWorkerBuffer += data.toString();

  const lines =
    mlWorkerBuffer.split("\n");

  mlWorkerBuffer =
    lines.pop() || "";

  for (const line of lines) {
    const trimmedLine =
      line.trim();

    if (!trimmedLine) {
      continue;
    }

    try {
      const result =
        JSON.parse(trimmedLine);

      /*
        Worker startup message
      */

      if (
        result.type === "ready"
      ) {
        mlWorkerReady = true;

        console.log(
          "ML worker ready - model loaded once"
        );

        continue;
      }

      /*
        Normal prediction response
      */

      const pendingRequest =
        mlWorkerRequests.shift();

      if (!pendingRequest) {
        console.warn(
          "Received ML result without a pending request"
        );

        continue;
      }

      if (result.error) {
        pendingRequest.reject(
          new Error(result.error)
        );
      } else {
        pendingRequest.resolve(
          result
        );
      }
    } catch (error) {
      console.error(
        "Invalid ML worker response:",
        trimmedLine
      );
    }
  }
});

mlWorker.stderr.on(
  "data",
  (data) => {
    const message =
      data.toString().trim();

    if (message) {
      console.error(
        "ML worker:",
        message
      );
    }
  }
);

mlWorker.on(
  "error",
  (error) => {
    console.error(
      "ML worker process error:",
      error
    );

    mlWorkerReady = false;

    rejectPendingMLRequests(
      error
    );
  }
);

mlWorker.on(
  "close",
  (code) => {
    console.error(
      `ML worker stopped with exit code ${code}`
    );

    mlWorkerReady = false;

    rejectPendingMLRequests(
      new Error(
        `ML worker stopped with exit code ${code}`
      )
    );
  }
);

function predictWithML(data) {
  return new Promise(
    (resolve, reject) => {
      if (!mlWorkerReady) {
        reject(
          new Error(
            "ML worker is not ready yet"
          )
        );

        return;
      }

      const requestId =
        ++mlWorkerRequestId;

      mlWorkerRequests.push({
        id: requestId,
        resolve,
        reject,
      });

      try {
        mlWorker.stdin.write(
          JSON.stringify(data) +
            "\n"
        );
      } catch (error) {
        const index =
          mlWorkerRequests.findIndex(
            (request) =>
              request.id ===
              requestId
          );

        if (index !== -1) {
          mlWorkerRequests.splice(
            index,
            1
          );
        }

        reject(error);
      }
    }
  );
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "RevenueDefence API is running",
    version: "1.0.0",
    mlEngine:
      mlWorkerReady
        ? "online"
        : "starting",
    database:
      "SQLite connected",
  });
});

/* =========================================================
   DASHBOARD
========================================================= */

app.get(
  "/api/dashboard",
  (req, res) => {
    res.json({
      success: true,
      data: {
        revenueProtected: 248420,
        atRiskRevenue: 42680,
        recoveryRate: 87.4,
        customersSaved: 1284,
      },
    });
  }
);

/* =========================================================
   ANALYTICS
========================================================= */

app.get(
  "/api/analytics",
  (req, res) => {
    res.json({
      success: true,
      data: {
        revenueProtected: 248420,
        atRiskRevenue: 42680,
        recoveryRate: 87.4,
        customersSaved: 1284,

        monthlyRevenue: [
          {
            month: "Jan",
            revenue: 182000,
          },
          {
            month: "Feb",
            revenue: 195000,
          },
          {
            month: "Mar",
            revenue: 207000,
          },
          {
            month: "Apr",
            revenue: 218000,
          },
          {
            month: "May",
            revenue: 231000,
          },
          {
            month: "Jun",
            revenue: 248420,
          },
        ],

        riskDistribution: {
          low: 52,
          medium: 31,
          high: 17,
        },
      },
    });
  }
);

/* =========================================================
   CUSTOMERS
   NOW READS FROM SQLITE
========================================================= */

app.get(
  "/api/customers",
  (req, res) => {
    try {
      const customerList =
        getAllCustomers();

      res.json({
        success: true,
        customers:
          customerList,
      });
    } catch (error) {
      console.error(
        "Customer database error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to load customers",
        error: error.message,
      });
    }
  }
);

/* =========================================================
   AI RISK ANALYSIS
========================================================= */

app.post(
  "/api/risk-analysis",
  async (req, res) => {
    const {
      customer,
      amount,
      paymentHistory,
      daysOverdue,
    } = req.body;

    /*
      Find customer from SQLite.
    */

    const customerRecord =
      findCustomer(customer);

    /*
      Prefer request values.
      Fall back to database values.
    */

    const revenue =
      Number(amount) ||
      Number(
        customerRecord?.amount
      ) ||
      0;

    const overdue =
      Number(daysOverdue) ||
      Number(
        customerRecord?.daysOverdue
      ) ||
      0;

    const history =
      Number(paymentHistory) ||
      Number(
        customerRecord?.paymentHistory
      ) ||
      100;

    try {
      /*
        Send customer data to the
        persistent ML worker.
      */

      const result =
        await predictWithML({
          revenue,
          daysOverdue: overdue,
          paymentHistory: history,
        });

      const risk =
        result.risk ||
        "Low";

      const riskScore =
        Number(
          result.riskScore
        ) || 0;

      let explanation =
        "Customer shows stable payment behavior with relatively low revenue risk.";

      if (risk === "High") {
        explanation =
          "High-value revenue combined with delayed payments or weak payment history creates a significant probability of revenue loss.";
      } else if (
        risk === "Medium"
      ) {
        explanation =
          "Several risk indicators are present. Personalized intervention can improve the probability of successful recovery.";
      }

      return res.json({
        success: true,

        data: {
          customer:
            customer ||
            customerRecord?.name ||
            "Unknown Customer",

          amount: revenue,

          risk,

          riskScore,

          recommendedAction:
            result.recommendedAction ||
            "Automated reminder",

          explanation,

          factors: {
            revenueImpact:
              revenue >= 10000
                ? "High"
                : revenue >= 5000
                ? "Medium"
                : "Low",

            paymentDelay:
              overdue >= 30
                ? "Severe"
                : overdue >= 15
                ? "Moderate"
                : "Low",

            paymentReliability:
              history < 50
                ? "Poor"
                : history < 75
                ? "Moderate"
                : "Good",
          },

          mlProbabilities:
            result.probabilities ||
            null,
        },
      });
    } catch (error) {
      console.error(
        "ML risk analysis failed:",
        error
      );

      /*
        Safe database fallback.
      */

      const fallbackRisk =
        customerRecord?.risk ||
        "Low";

      const fallbackScore =
        Number(
          customerRecord?.score
        ) || 0;

      let recommendedAction =
        "Continue regular payment monitoring";

      if (
        fallbackRisk === "High"
      ) {
        recommendedAction =
          "Immediate recovery action recommended";
      } else if (
        fallbackRisk === "Medium"
      ) {
        recommendedAction =
          "Follow-up and payment reminder recommended";
      }

      return res.json({
        success: true,

        data: {
          customer:
            customer ||
            customerRecord?.name ||
            "Unknown Customer",

          amount: revenue,

          risk: fallbackRisk,

          riskScore: fallbackScore,

          recommendedAction,

          explanation:
            "The RevenueDefence risk engine evaluated revenue exposure, payment reliability and overdue payment behavior.",

          factors: {
            revenueImpact:
              revenue >= 10000
                ? "High"
                : revenue >= 5000
                ? "Medium"
                : "Low",

            paymentDelay:
              overdue >= 30
                ? "Severe"
                : overdue >= 15
                ? "Moderate"
                : "Low",

            paymentReliability:
              history < 50
                ? "Poor"
                : history < 75
                ? "Moderate"
                : "Good",
          },

          mlProbabilities:
            null,
        },
      });
    }
  }
);

/* =========================================================
   RECOVERY RECOMMENDATIONS
========================================================= */

app.post(
  "/api/recovery",
  (req, res) => {
    const {
      customer,
      risk,
      amount,
      riskScore,
    } = req.body;

    /*
      Find selected customer from SQLite.
    */

    const customerRecord =
      findCustomer(customer);

    const revenue =
      Number(amount) ||
      Number(
        customerRecord?.amount
      ) ||
      0;

    const score =
      Number(riskScore);

    /*
      Final risk resolution:
      ML score > supplied risk > DB
    */

    const finalRisk =
      resolveRisk(
        risk,
        score,
        customerRecord
      );

    console.log(
      "Recovery request:",
      {
        customer,
        suppliedRisk: risk,
        riskScore: score,
        finalRisk,
      }
    );

    let recommendation;

    if (
      finalRisk === "High"
    ) {
      recommendation = {
        priority: "High",

        action:
          "Human escalation",

        channel:
          "Account manager",

        expectedRecovery:
          Math.round(
            revenue * 0.72
          ),

        reasoning:
          "High-risk revenue requires direct human intervention to maximize recovery probability.",
      };
    } else if (
      finalRisk === "Medium"
    ) {
      recommendation = {
        priority: "Medium",

        action:
          "Personalized payment reminder",

        channel:
          "Email + SMS",

        expectedRecovery:
          Math.round(
            revenue * 0.55
          ),

        reasoning:
          "A personalized reminder and flexible payment option may recover the account.",
      };
    } else {
      recommendation = {
        priority: "Low",

        action:
          "Automated reminder",

        channel:
          "Email",

        expectedRecovery:
          Math.round(
            revenue * 0.35
          ),

        reasoning:
          "Low-risk accounts can be handled automatically without expensive intervention.",
      };
    }

    /*
      SAVE RECOVERY ACTION TO SQLITE
    */

    if (customerRecord) {
      try {
        saveRecoveryAction({
          customerId:
            customerRecord.id,

          risk: finalRisk,

          priority:
            recommendation.priority,

          action:
            recommendation.action,

          channel:
            recommendation.channel,

          expectedRecovery:
            recommendation.expectedRecovery,

          reasoning:
            recommendation.reasoning,

          status:
            "Recommended",
        });
      } catch (error) {
        console.error(
          "Unable to save recovery action:",
          error
        );
      }
    }

    return res.json({
      success: true,

      customer:
        customer ||
        customerRecord?.name ||
        "Customer",

      recommendation,

      risk: finalRisk,

      riskScore:
        Number.isFinite(score) &&
        score > 0
          ? score
          : Number(
              customerRecord?.score ||
                0
            ),
    });
  }
);

/* =========================================================
   RECOVERY ACTIONS
========================================================= */

/*
   GET ALL RECOVERY ACTIONS

   Used by the frontend to load
   saved recovery recommendations
   from SQLite.
*/

app.get(
  "/api/recovery-actions",
  (req, res) => {
    try {
      const actions =
        getRecoveryActions();

      return res.json({
        success: true,
        actions,
      });
    } catch (error) {
      console.error(
        "Unable to load recovery actions:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load recovery actions",
        error: error.message,
      });
    }
  }
);

/*
   UPDATE RECOVERY ACTION STATUS

   Allowed statuses:

   Recommended
        ↓
   In Progress
        ↓
   Recovered
*/

app.patch(
  "/api/recovery/:id/status",
  (req, res) => {
    try {
      const actionId =
        Number(req.params.id);

      const { status } =
        req.body;

      const allowedStatuses = [
        "Recommended",
        "In Progress",
        "Recovered",
      ];

      /*
        Validate ID
      */

      if (
        !Number.isInteger(actionId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid recovery action ID",
        });
      }

      /*
        Validate status
      */

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Use Recommended, In Progress, or Recovered.",
        });
      }

      /*
        Check that action exists
      */

      const existingAction =
        getRecoveryActionById(
          actionId
        );

      if (!existingAction) {
        return res.status(404).json({
          success: false,
          message:
            "Recovery action not found",
        });
      }

      /*
        Update SQLite
      */

      const updatedAction =
        updateRecoveryActionStatus(
          actionId,
          status
        );

      return res.json({
        success: true,
        message:
          "Recovery action status updated successfully",
        action: updatedAction,
      });
    } catch (error) {
      console.error(
        "Unable to update recovery action status:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update recovery action status",
        error: error.message,
      });
    }
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      message:
        "API endpoint not found",
    });
  }
);

/* =========================================================
   SERVER
========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `RevenueDefence API running on http://localhost:${PORT}`
    );
  }
);