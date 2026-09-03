import sys
import json
import os
import joblib
import numpy as np


# ============================================================
# LOAD MODEL ONCE
# ============================================================

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "risk_model.pkl"
)

try:
    MODEL = joblib.load(MODEL_PATH)
    MODEL_LOAD_ERROR = None
except Exception as error:
    MODEL = None
    MODEL_LOAD_ERROR = str(error)


# ============================================================
# PREDICTION
# ============================================================

def predict_risk(data):
    if MODEL is None:
        raise RuntimeError(
            f"Unable to load ML model: {MODEL_LOAD_ERROR}"
        )

    revenue = float(
        data.get("revenue", 0)
    )

    days_overdue = float(
        data.get("daysOverdue", 0)
    )

    payment_history = float(
        data.get("paymentHistory", 100)
    )

    outstanding_ratio = float(
        data.get(
            "outstandingRatio",
            min(
                max(
                    revenue / max(
                        revenue * 1.25,
                        1
                    ),
                    0.05
                ),
                1.0
            )
        )
    )

    features = np.array(
        [[
            revenue,
            days_overdue,
            payment_history,
            outstanding_ratio
        ]],
        dtype=float
    )

    prediction = int(
        MODEL.predict(features)[0]
    )

    probabilities = MODEL.predict_proba(
        features
    )[0]

    risk_map = {
        0: "Low",
        1: "Medium",
        2: "High"
    }

    risk = risk_map.get(
        prediction,
        "Low"
    )

    risk_score = round(
        float(
            probabilities[1] * 50
            + probabilities[2] * 100
        )
    )

    if risk == "High":
        action = (
            "Immediate recovery action recommended"
        )
    elif risk == "Medium":
        action = (
            "Follow-up and payment reminder recommended"
        )
    else:
        action = (
            "Continue regular payment monitoring"
        )

    return {
        "risk": risk,
        "riskScore": risk_score,
        "probabilities": {
            "low": round(
                float(probabilities[0]),
                4
            ),
            "medium": round(
                float(probabilities[1]),
                4
            ),
            "high": round(
                float(probabilities[2]),
                4
            )
        },
        "recommendedAction": action
    }


# ============================================================
# PERSISTENT WORKER
#
# IMPORTANT:
# Read ONE JSON line at a time.
# Node.js keeps this Python process alive and sends
# multiple requests through stdin.
# ============================================================

if MODEL is not None:
    print(
        json.dumps({
            "type": "ready"
        }),
        flush=True
    )
else:
    print(
        json.dumps({
            "type": "ready",
            "error": MODEL_LOAD_ERROR
        }),
        flush=True
    )


for line in sys.stdin:
    line = line.strip()

    if not line:
        continue

    try:
        data = json.loads(line)

        result = predict_risk(data)

        print(
            json.dumps(result),
            flush=True
        )

    except Exception as error:
        print(
            json.dumps({
                "error": str(error)
            }),
            flush=True
        )