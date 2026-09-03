const API_BASE_URL = "http://localhost:5000";

// =========================================================
// GENERIC API REQUEST HELPER
// =========================================================

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}

// =========================================================
// DASHBOARD
// =========================================================

export async function getDashboard() {
  return request("/api/dashboard");
}

// =========================================================
// ANALYTICS
// =========================================================

export async function getAnalytics() {
  return request("/api/analytics");
}

// =========================================================
// CUSTOMERS
// =========================================================

export async function getCustomers() {
  return request("/api/customers");
}

// =========================================================
// RISK ANALYSIS
// =========================================================

export async function runRiskAnalysis(data = {}) {
  return request("/api/risk-analysis", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// =========================================================
// RECOVERY RECOMMENDATIONS
// =========================================================

export async function getRecoveryRecommendations(data = {}) {
  return request("/api/recovery", {
    method: "POST",
    body: JSON.stringify(data),
  });
}