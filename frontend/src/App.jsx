import { useEffect, useState } from "react";
import "./App.css";

import {
  getAnalytics,
  getCustomers,
  runRiskAnalysis,
  getRecoveryRecommendations,
} from "./api";

const fallbackData = {
  revenueProtected: 248420,
  atRiskRevenue: 42680,
  recoveryRate: 87.4,
  customersSaved: 1284,
};

const fallbackCustomers = [
  { name: "Acme Corporation", id: "CUST-001", amount: 12500, risk: "High", score: 92, daysOverdue: 34, paymentHistory: 42 },
  { name: "TechNova Solutions", id: "CUST-002", amount: 8750, risk: "Medium", score: 68, daysOverdue: 18, paymentHistory: 67 },
  { name: "GlobalMart", id: "CUST-003", amount: 5240, risk: "Low", score: 31, daysOverdue: 3, paymentHistory: 94 },
  { name: "Vertex Systems", id: "CUST-004", amount: 3890, risk: "Medium", score: 61, daysOverdue: 14, paymentHistory: 72 },
  { name: "Nova Industries", id: "CUST-005", amount: 15600, risk: "High", score: 84, daysOverdue: 27, paymentHistory: 48 },
  { name: "BluePeak Retail", id: "CUST-006", amount: 4250, risk: "Low", score: 24, daysOverdue: 2, paymentHistory: 96 },
]; 

/* =========================================================
   SHARED CUSTOMER PORTFOLIO STATS
   All pages use the same six-customer dataset.
========================================================= */

const totalCustomers = fallbackCustomers.length;

const highRiskCustomers = fallbackCustomers.filter(
  (customer) => String(customer.risk).toLowerCase() === "high"
);

const mediumRiskCustomers = fallbackCustomers.filter(
  (customer) => String(customer.risk).toLowerCase() === "medium"
);

const lowRiskCustomers = fallbackCustomers.filter(
  (customer) => String(customer.risk).toLowerCase() === "low"
);

const highRiskCount = highRiskCustomers.length;
const mediumRiskCount = mediumRiskCustomers.length;
const lowRiskCount = lowRiskCustomers.length;

const highRiskRevenue = highRiskCustomers.reduce(
  (sum, customer) => sum + Number(customer.amount || 0),
  0
);

const totalRiskAccounts = totalCustomers;

const MONTH_NAMES = [
  "January 2026",
  "February 2026",
  "March 2026",
  "April 2026",
  "May 2026",
  "June 2026",
  "July 2026",
  "August 2026",
  "September 2026",
  "October 2026",
  "November 2026",
  "December 2026",
];

const MONTHLY_ANALYTICS = {
  "January 2026": { revenue: 142000, atRisk: 27800, recoveryRate: 82.1, recovered: 22824 },
  "February 2026": { revenue: 158000, atRisk: 30100, recoveryRate: 83.6, recovered: 25164 },
  "March 2026": { revenue: 171000, atRisk: 32600, recoveryRate: 84.8, recovered: 27645 },
  "April 2026": { revenue: 165000, atRisk: 31800, recoveryRate: 85.7, recovered: 27253 },
  "May 2026": { revenue: 194000, atRisk: 35400, recoveryRate: 86.6, recovered: 30656 },
  "June 2026": { revenue: 214000, atRisk: 38700, recoveryRate: 86.9, recovered: 33630 },
  "July 2026": { revenue: 229500, atRisk: 41200, recoveryRate: 87.2, recovered: 35926 },
  "August 2026": { revenue: 248420, atRisk: 42680, recoveryRate: 87.4, recovered: 37302 },
  "September 2026": { revenue: 255800, atRisk: 43800, recoveryRate: 88.1, recovered: 38588 },
  "October 2026": { revenue: 268400, atRisk: 45100, recoveryRate: 88.6, recovered: 39959 },
  "November 2026": { revenue: 279600, atRisk: 46300, recoveryRate: 89.1, recovered: 41238 },
  "December 2026": { revenue: 291800, atRisk: 47800, recoveryRate: 89.6, recovered: 42829 },
};

const ALL_MONTHS_METRICS = MONTH_NAMES.reduce(
  (acc, month) => {
    const metric = MONTHLY_ANALYTICS[month];
    acc.revenue += metric.revenue;
    acc.atRisk += metric.atRisk;
    acc.recovered += metric.recovered;
    return acc;
  },
  { revenue: 0, atRisk: 0, recovered: 0 }
);

ALL_MONTHS_METRICS.recoveryRate = Number(
  ((ALL_MONTHS_METRICS.recovered / ALL_MONTHS_METRICS.atRisk) * 100).toFixed(1)
);

function getCustomersForMonth(month) {
  if (!month || month === "All Months") {
    return fallbackCustomers.map((customer) => ({ ...customer }));
  }

  const metric = MONTHLY_ANALYTICS[month];
  const augustRevenue = MONTHLY_ANALYTICS["August 2026"].revenue;
  const revenueFactor = metric ? metric.revenue / augustRevenue : 1;

  return fallbackCustomers.map((customer) => {
    const overdueFactor = 0.9 + revenueFactor * 0.1;
    const reliabilityShift = Math.round((revenueFactor - 1) * 6);

    return {
      ...customer,
      amount: Math.round(customer.amount * revenueFactor),
      daysOverdue: Math.max(1, Math.round(customer.daysOverdue * overdueFactor)),
      paymentHistory: Math.max(
        20,
        Math.min(99, customer.paymentHistory - reliabilityShift)
      ),
    };
  });
}


function getUniqueRecoveredActions(actions = []) {
  const recovered = actions.filter(
    (item) => String(item?.status || "").toLowerCase() === "recovered"
  );

  const sorted = [...recovered].sort((a, b) => {
    const dateA = new Date(a?.createdAt || 0).getTime() || 0;
    const dateB = new Date(b?.createdAt || 0).getTime() || 0;
    if (dateB !== dateA) return dateB - dateA;
    return Number(b?.id || 0) - Number(a?.id || 0);
  });

  const seenCustomers = new Set();
  const uniqueRecovered = [];

  for (const item of sorted) {
    const customerKey = item?.customerId || `action-${item?.id}`;

    if (seenCustomers.has(customerKey)) {
      continue;
    }

    seenCustomers.add(customerKey);
    uniqueRecovered.push(item);
  }

  return uniqueRecovered;
}

function formatCompactCurrency(value) {
  const amount = Number(value || 0);

  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }

  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }

  return `$${amount.toLocaleString()}`;
}

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [data, setData] = useState(fallbackData);
  const [loading, setLoading] = useState(false);
  const [liveRecoveryActions, setLiveRecoveryActions] = useState([]);
  const [liveRecoveryLoading, setLiveRecoveryLoading] = useState(true);

  const loadLiveRecoveryMetrics = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/recovery-actions");

      if (!response.ok) {
        throw new Error(`Recovery actions request failed: ${response.status}`);
      }

      const result = await response.json();
      const actions = Array.isArray(result?.actions)
        ? result.actions
        : [];

      setLiveRecoveryActions(actions);
    } catch (error) {
      console.error("Failed to load live recovery metrics:", error);
      setLiveRecoveryActions([]);
    } finally {
      setLiveRecoveryLoading(false);
    }
  };

  /* =====================================================
     TOP BAR CONTROLS
     Keep the existing UI exactly the same; only add
     behavior to the three existing buttons.
  ===================================================== */

  const [selectedMonth, setSelectedMonth] = useState("August 2026");
  const [topSearchOpen, setTopSearchOpen] = useState(false);
  const [topSearchQuery, setTopSearchQuery] = useState("");
  const [engineOpen, setEngineOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

  const months = MONTH_NAMES;

  const handleTopSearch = () => {
    setTopSearchOpen((open) => !open);
    setEngineOpen(false);
    setMonthOpen(false);
  };

  const handleTopSearchSubmit = () => {
    const query = topSearchQuery.trim();
    if (!query) return;

    // Always open the Customers page and pass the search term through.
    // This lets the Customers page display “No customers found” when
    // the searched customer/ID does not exist in the six-customer dataset.
    setTopSearchOpen(false);
    setTopSearchQuery("");
    setActivePage("Customers");

    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("revenue-defence-search", {
          detail: { query: query },
        })
      );
    }, 0);
  };

  const handleEngineButton = () => {
    setEngineOpen((open) => !open);
    setTopSearchOpen(false);
    setMonthOpen(false);
  };

  const handleMonthButton = () => {
    setMonthOpen((open) => !open);
    setTopSearchOpen(false);
    setEngineOpen(false);
  };

  const handleMonthSelect = (month) => {
    setSelectedMonth((current) => (current === month ? "All Months" : month));
    setMonthOpen(false);
  };

  /* =====================================================
     LOAD ANALYTICS
  ===================================================== */

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const result = await getAnalytics();

        console.log("Analytics API:", result);

        const analyticsData =
          result?.data ||
          result?.analytics ||
          result ||
          {};

        if (
          analyticsData &&
          typeof analyticsData === "object"
        ) {
          setData((prev) => ({
            ...prev,
            ...analyticsData,
          }));
        }
      } catch (error) {
        console.log("Using demo analytics data");
      }
    };

    loadAnalytics();
  }, []);

  useEffect(() => {
    loadLiveRecoveryMetrics();

    if (activePage !== "Overview") {
      return undefined;
    }

    const refreshTimer = window.setInterval(() => {
      loadLiveRecoveryMetrics();
    }, 10000);

    return () => window.clearInterval(refreshTimer);
  }, [activePage]);

  const recoveredActions = getUniqueRecoveredActions(liveRecoveryActions);

  const liveRecoveredRevenue = recoveredActions.reduce(
    (sum, item) => sum + Number(item.expectedRecovery || 0),
    0
  );

  const liveAtRiskRevenue = Number(data.atRiskRevenue || fallbackData.atRiskRevenue);

  const liveRecoveryRate = liveAtRiskRevenue > 0
    ? Number(((liveRecoveredRevenue / liveAtRiskRevenue) * 100).toFixed(1))
    : 0;

  const liveCustomersSaved = new Set(
    recoveredActions
      .map((item) => item.customerId)
      .filter(Boolean)
  ).size;

  /* =====================================================
     RUN RISK ANALYSIS
  ===================================================== */

  const handleRunRiskAnalysis = () => {
    // Navigate immediately. The Risk Analysis page performs the actual
    // customer-specific ML request after a customer is selected.
    setLoading(false);
    setActivePage("Risk Analysis");
  };

  /* =====================================================
     NAVIGATION
  ===================================================== */

  const menuItems = [
    {
      name: "Overview",
      icon: "◇",
    },
    {
      name: "Risk Analysis",
      icon: "◯",
    },
    {
      name: "Recovery",
      icon: "↗",
    },
    {
      name: "Customers",
      icon: "♙",
    },
    {
      name: "Analytics",
      icon: "▥",
    },
  ];

  return (
    <div className="app-shell">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-logo">
            ◇
          </div>

          <div className="brand-text">

            <h1>
              RevenueDefence
            </h1>

            <p>
              AI Risk Intelligence
            </p>

          </div>

        </div>


        <nav className="navigation">

          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activePage === item.name
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActivePage(item.name)
              }
            >

              <span className="nav-icon">
                {item.icon}
              </span>

              <span>
                {item.name}
              </span>

            </button>
          ))}

        </nav>


        <div className="sidebar-footer">

          <div className="engine-status">

            <div className="status-dot"></div>

            <div>
              <strong>
                AI Engine Online
              </strong>

              <span>
                Risk model active
              </span>
            </div>

          </div>


          <div className="profile" style={{ position: "relative" }}>

            <div className="profile-avatar">
              RD
            </div>

            <div className="profile-info">

              <strong>
                Revenue Manager
              </strong>

              <span>
                Administrator
              </span>

            </div>

            <button
              type="button"
              className="profile-more"
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-label="Open Revenue Manager menu"
              aria-expanded={profileMenuOpen}
              style={{
                border: "0",
                background: "transparent",
                padding: "8px",
                cursor: "pointer",
                borderRadius: "8px",
              }}
            >
              •••
            </button>

            {profileMenuOpen && (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: "52px",
                  minWidth: "150px",
                  padding: "8px",
                  border: "1px solid #173b51",
                  borderRadius: "12px",
                  background: "#0a1d2c",
                  boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
                  zIndex: 50,
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setProfilePanelOpen(true);
                  }}
                  style={{
                    width: "100%",
                    border: "0",
                    background: "transparent",
                    color: "#dbeafe",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setSettingsPanelOpen(true);
                  }}
                  style={{
                    width: "100%",
                    border: "0",
                    background: "transparent",
                    color: "#dbeafe",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setProfileMenuOpen(false)}
                  style={{
                    width: "100%",
                    border: "0",
                    background: "transparent",
                    color: "#dbeafe",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            )}

          </div>

        </div>

        {profilePanelOpen && (
          <div
            onClick={() => setProfilePanelOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
              padding: "24px",
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "min(420px, 100%)",
                border: "1px solid #1b4259",
                borderRadius: "18px",
                background: "#0a1d2c",
                padding: "28px",
                boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                <div>
                  <p className="section-eyebrow" style={{ marginBottom: "8px" }}>ACCOUNT</p>
                  <h3 style={{ margin: 0, fontSize: "24px" }}>Revenue Manager</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setProfilePanelOpen(false)}
                  style={{
                    border: "1px solid #23475c",
                    background: "transparent",
                    color: "#9bb7cc",
                    borderRadius: "8px",
                    width: "34px",
                    height: "34px",
                    cursor: "pointer",
                    fontSize: "20px",
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ marginTop: "22px", color: "#9bb3c6", lineHeight: 1.7 }}>
                <strong style={{ color: "#edf6ff" }}>Role:</strong> Administrator
                <br />
                <strong style={{ color: "#edf6ff" }}>Status:</strong> Active
                <br />
                <strong style={{ color: "#edf6ff" }}>Accounts monitored:</strong> 6
              </div>
            </div>
          </div>
        )}

        {settingsPanelOpen && (
          <div
            onClick={() => setSettingsPanelOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
              padding: "24px",
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "min(420px, 100%)",
                border: "1px solid #1b4259",
                borderRadius: "18px",
                background: "#0a1d2c",
                padding: "28px",
                boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                <div>
                  <p className="section-eyebrow" style={{ marginBottom: "8px" }}>PREFERENCES</p>
                  <h3 style={{ margin: 0, fontSize: "24px" }}>Settings</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsPanelOpen(false)}
                  style={{
                    border: "1px solid #23475c",
                    background: "transparent",
                    color: "#9bb7cc",
                    borderRadius: "8px",
                    width: "34px",
                    height: "34px",
                    cursor: "pointer",
                    fontSize: "20px",
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ marginTop: "22px" }}>
                <div style={{ color: "#9bb3c6", marginBottom: "16px" }}>Current dashboard settings</div>
                <div style={{ padding: "14px", border: "1px solid #173b51", borderRadius: "12px", color: "#dbeafe", background: "#081a29" }}>
                  AI Risk Engine: Online
                </div>
                <div style={{ marginTop: "10px", padding: "14px", border: "1px solid #173b51", borderRadius: "12px", color: "#dbeafe", background: "#081a29" }}>
                  Monitored customers: 6
                </div>
              </div>
            </div>
          </div>
        )}

      </aside>


      {/* =================================================
          MAIN CONTENT
      ================================================= */}

      <main className="main-content">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="topbar">

          <div className="page-heading">

            <p className="eyebrow">
              REVENUE INTELLIGENCE
            </p>

            <h2>
              {activePage}
            </h2>

          </div>


          <div className="top-actions">

            <div className="top-control search-control">
              <button
                type="button"
                className="icon-button"
                title="Search"
                aria-label="Search"
                onClick={handleTopSearch}
              >
                ⌕
              </button>

              {topSearchOpen && (
                <div className="top-search-popover">
                  <input
                    type="text"
                    autoFocus
                    value={topSearchQuery}
                    placeholder="Search customer or ID..."
                    onChange={(event) =>
                      setTopSearchQuery(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleTopSearchSubmit();
                      }
                      if (event.key === "Escape") {
                        setTopSearchOpen(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleTopSearchSubmit}
                    disabled={!topSearchQuery.trim()}
                  >
                    Search
                  </button>
                </div>
              )}
            </div>

            <div className="top-control engine-control">
              <button
                type="button"
                className={`icon-button ${engineOpen ? "active-control" : ""}`}
                title="AI Engine"
                aria-label="AI Engine"
                onClick={handleEngineButton}
              >
                ◇
              </button>

              {engineOpen && (
                <div className="engine-popover">
                  <span className="status-dot"></span>
                  <div>
                    <strong>AI Engine Online</strong>
                    <span>Risk model active · 6 accounts monitored</span>
                  </div>
                </div>
              )}
            </div>

            <div className="top-control month-control">
              <button
                type="button"
                className="month-button"
                title="Change month"
                aria-label="Change month"
                onClick={handleMonthButton}
              >
                <span>{selectedMonth}</span>
                <span className="chevron">⌄</span>
              </button>

              {monthOpen && (
                <div className="month-popover">
                  <button
                    type="button"
                    className={selectedMonth === "All Months" ? "selected" : ""}
                    onClick={() => handleMonthSelect("All Months")}
                  >
                    All Months
                  </button>
                  {months.map((month) => (
                    <button
                      key={month}
                      type="button"
                      className={month === selectedMonth ? "selected" : ""}
                      onClick={() => handleMonthSelect(month)}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

        </header>


        {/* =================================================
            OVERVIEW
        ================================================= */}

        {activePage === "Overview" && (
          <div className="dashboard-content">

            {/* HERO */}

            <section className="hero">

              <div className="hero-content">

                <p className="hero-eyebrow">
                  AI-POWERED REVENUE PROTECTION
                </p>

                <h3>
                  Protect revenue.
                  <br />
                  <span>
                    Recover smarter.
                  </span>
                </h3>

                <p className="hero-description">
                  RevenueDefence identifies revenue at
                  risk before it is lost and recommends
                  the safest recovery action.
                </p>

                <button
                  className="primary-button"
                  onClick={
                    handleRunRiskAnalysis
                  }
                  disabled={loading}
                >

                  {loading
                    ? "Analyzing..."
                    : "Run Risk Analysis"}

                  <span>
                    →
                  </span>

                </button>

              </div>


              {/* HERO VISUAL */}

              <div className="hero-visual">

                <div className="orbit orbit-one"></div>

                <div className="orbit orbit-two"></div>

                <div className="shield">

                  <span>
                    ◇
                  </span>

                </div>

                <div className="visual-label">

                  <span className="mini-dot"></span>

                  AI MODEL ACTIVE

                </div>

              </div>

            </section>


            {/* STATS */}

            <section className="stats-grid">

              <StatCard
                icon="⬡"
                change={liveRecoveryLoading ? "LIVE" : "SQLite"}
                title="Revenue Protected"
                value={
                  liveRecoveryLoading
                    ? "…"
                    : `$${liveRecoveredRevenue.toLocaleString()}`
                }
                subtitle="from recovered actions"
              />

              <StatCard
                icon="⚠"
                change="-12.4%"
                title="At-Risk Revenue"
                value={`$${liveAtRiskRevenue.toLocaleString()}`}
                subtitle="requires attention"
              />

              <StatCard
                icon="↗"
                change={liveRecoveryLoading ? "LIVE" : `${liveRecoveryRate}%`}
                title="Recovery Rate"
                value={
                  liveRecoveryLoading
                    ? "…"
                    : `${liveRecoveryRate}%`
                }
                subtitle="from recovered actions"
              />

              <StatCard
                icon="♙"
                change={liveRecoveryLoading ? "LIVE" : `${liveCustomersSaved} saved`}
                title="Customers Saved"
                value={
                  liveRecoveryLoading
                    ? "…"
                    : liveCustomersSaved.toLocaleString()
                }
                subtitle="unique recovered accounts"
              />

            </section>

          </div>
        )}


        {/* =================================================
            RISK ANALYSIS
        ================================================= */}

        {activePage === "Risk Analysis" && (
          <RiskAnalysisPage selectedMonth={selectedMonth} />
        )}


        {/* =================================================
            RECOVERY
        ================================================= */}

        {activePage === "Recovery" && (
          <RecoveryPage selectedMonth={selectedMonth} />
        )}


        {/* =================================================
            CUSTOMERS
        ================================================= */}

        {activePage === "Customers" && (
          <CustomersPage selectedMonth={selectedMonth} />
        )}


        {/* =================================================
            ANALYTICS
        ================================================= */}

        {activePage === "Analytics" && (
          <AnalyticsPage data={data} selectedMonth={selectedMonth} />
        )}

      </main>

    </div>
  );
}


/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon,
  change,
  title,
  value,
  subtitle,
}) {
  return (
    <div className="stat-card">

      <div className="stat-top">

        <div className="stat-icon">
          {icon}
        </div>

        <span className="stat-change">
          {change}
        </span>

      </div>

      <p className="stat-title">
        {title}
      </p>

      <h4>
        {value}
      </h4>

      <span className="stat-subtitle">
        {subtitle}
      </span>

    </div>
  );
}


/* =========================================================
   RISK ANALYSIS PAGE
   Six-customer selector + scrollable customer assessment.
========================================================= */

function RiskAnalysisPage({ selectedMonth }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    fallbackCustomers[0]?.id || ""
  );

  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const pageCustomers = getCustomersForMonth(selectedMonth);

  const selectedCustomer =
    pageCustomers.find(
      (customer) => customer.id === selectedCustomerId
    ) || pageCustomers[0];

  const handleReviewCustomer = async () => {
    if (!selectedCustomer) return;

    setAnalyzing(true);

    try {
      // Send the selected customer's actual data to the ML backend.
      const result = await runRiskAnalysis({
        customer: selectedCustomer.name,
        amount: Number(selectedCustomer.amount || 0),
        paymentHistory: Number(selectedCustomer.paymentHistory || 0),
        daysOverdue: Number(selectedCustomer.daysOverdue || 0),
      });

      const resultData =
        result?.data ||
        result?.analysis ||
        result ||
        null;

      if (!resultData || typeof resultData !== "object") {
        throw new Error("Invalid AI response");
      }

      setAnalysis(resultData);
    } catch (error) {
      console.error("Risk analysis failed:", error);

      // Keep the existing local data as a fast fallback if the API is unavailable.
      const risk = String(selectedCustomer.risk || "Low").toLowerCase();

      let recommendedAction =
        "Maintain normal customer monitoring";

      if (risk === "high") {
        recommendedAction =
          "Immediate human review + personalized recovery";
      } else if (risk === "medium") {
        recommendedAction =
          "Send personalized payment reminder";
      }

      setAnalysis({
        riskScore: Number(selectedCustomer.score || 0),
        risk:
          risk.charAt(0).toUpperCase() + risk.slice(1),
        recommendedAction,
        explanation:
          risk === "high"
            ? "High-value revenue combined with delayed payments or weak payment history creates a significant probability of revenue loss."
            : risk === "medium"
              ? "Moderate revenue exposure and payment delay indicate that proactive monitoring and a personalized reminder are appropriate."
              : "The account currently shows healthy payment behavior and low revenue-loss probability.",
        factors: {
          revenueImpact: `$${Number(
            selectedCustomer.amount || 0
          ).toLocaleString()}`,
          paymentDelay: `${Number(
            selectedCustomer.daysOverdue || 0
          )} days`,
          paymentReliability: `${Number(
            selectedCustomer.paymentHistory || 0
          )}%`,
        },
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <section className="risk-page risk-detail-page">
      <div className="risk-detail-card">
        <div className="risk-detail-content">
          <p className="hero-eyebrow">RISK INTELLIGENCE</p>

          <h3>Risk Analysis</h3>

          <p className="risk-detail-description">
            Analyze customer revenue exposure, payment behavior and overdue
            activity to identify potential revenue loss.
          </p>

          <div className="page-period-badge">Reporting period: <strong>{selectedMonth}</strong></div>

          <div className="risk-customer-selector">
            <select
              aria-label="Select customer for risk analysis"
              value={selectedCustomerId}
              onChange={(event) => {
                setSelectedCustomerId(event.target.value);
                setAnalysis(null);
              }}
            >
              {pageCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} — {customer.risk} Risk
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="risk-detail-action"
            onClick={handleReviewCustomer}
            disabled={analyzing || !selectedCustomer}
          >
            {analyzing ? "Analyzing..." : "Review Customer"}
            <span>→</span>
          </button>

          {analysis && selectedCustomer && (
            <div className="risk-detail-result">
              <div className="risk-detail-result-header">
                <div>
                  <p className="section-eyebrow">AI ANALYSIS RESULT</p>
                  <h4>{selectedCustomer.name}</h4>
                </div>

                <strong className={`risk-result-level ${analysis.risk.toLowerCase()}`}>
                  {analysis.risk}
                </strong>
              </div>

              <div className="risk-detail-result-grid">
                <div className="risk-detail-metric">
                  <span>RISK SCORE</span>
                  <strong>{analysis.riskScore}/100</strong>
                </div>

                <div className="risk-detail-metric">
                  <span>REVENUE</span>
                  <strong>
                    ${Number(selectedCustomer.amount || 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="risk-detail-recommendation">
                <span>RECOMMENDED ACTION</span>
                <strong>{analysis.recommendedAction}</strong>
              </div>

              <p className="risk-detail-explanation">
                {analysis.explanation}
              </p>

              <div className="risk-detail-factor-grid">
                <div>
                  <span>PAYMENT DELAY</span>
                  <strong>{analysis.factors.paymentDelay}</strong>
                </div>

                <div>
                  <span>RELIABILITY</span>
                  <strong>{analysis.factors.paymentReliability}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


/* =========================================================
   RISK ROW
========================================================= */

function RiskRow({
  customer,
  id,
  revenue,
  risk,
  score,
  onReview,
}) {
  const riskClass = risk.toLowerCase();

  return (
    <div className="table-row">

      <span>

        <strong>
          {customer}
        </strong>

        <small>
          {id}
        </small>

      </span>


      <span>
        {revenue}
      </span>


      <span>

        <span
          className={`risk-pill ${riskClass}`}
        >
          {risk}
        </span>

      </span>


      <span>
        {score}
      </span>


      <span>

        <button type="button" className="action-button" onClick={onReview}>

          Review

          <span>
            →
          </span>

        </button>

      </span>

    </div>
  );
}


/* =========================================================
   RECOVERY PAGE
   Six-customer selector + scrollable recovery recommendation
   + persistent recovery action tracking.
========================================================= */

const RECOVERY_API_BASE_URL = "http://localhost:5000";

async function loadRecoveryActions() {
  const response = await fetch(
    `${RECOVERY_API_BASE_URL}/api/recovery-actions`
  );

  if (!response.ok) {
    throw new Error("Unable to load recovery actions");
  }

  return response.json();
}

async function changeRecoveryActionStatus(actionId, status) {
  const response = await fetch(
    `${RECOVERY_API_BASE_URL}/api/recovery/${actionId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || "Unable to update recovery action status"
    );
  }

  return result;
}

function RecoveryPage({ selectedMonth }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    fallbackCustomers[0]?.id || ""
  );
  const [recommendation, setRecommendation] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [recoveryAction, setRecoveryAction] = useState(null);
  const [recoveryHistory, setRecoveryHistory] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const pageCustomers = getCustomersForMonth(selectedMonth);

  const selectedCustomer =
    pageCustomers.find(
      (customer) => customer.id === selectedCustomerId
    ) || pageCustomers[0];

  const refreshRecoveryData = async () => {
    try {
      const result = await loadRecoveryActions();
      const actions = Array.isArray(result?.actions)
        ? result.actions
        : [];

      setRecoveryHistory(actions);

      if (!selectedCustomer) {
        setRecoveryAction(null);
        return;
      }

      const matchingActions = actions
        .filter(
          (action) =>
            String(action.customerId) === String(selectedCustomer.id)
        )
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

      setRecoveryAction(matchingActions[0] || null);
    } catch (error) {
      console.error("Recovery action load failed:", error);
      setRecoveryAction(null);
      setRecoveryHistory([]);
    }
  };

  useEffect(() => {
    refreshRecoveryData();
    setActionMessage("");
  }, [selectedCustomerId, selectedMonth]);

  const handleGenerateRecoveryPlan = async () => {
    if (!selectedCustomer) return;

    setGenerating(true);
    setActionMessage("");

    try {
      /* =======================================================
         STEP 1: Get the ML risk analysis for the selected
         customer so Recovery uses the actual AI risk result.
      ======================================================= */

      const riskResult = await runRiskAnalysis({
        customer: selectedCustomer.name,
        amount: Number(selectedCustomer.amount || 0),
        paymentHistory: Number(
          selectedCustomer.paymentHistory || 0
        ),
        daysOverdue: Number(
          selectedCustomer.daysOverdue || 0
        ),
      });

      const riskData =
        riskResult?.data ||
        riskResult?.analysis ||
        riskResult ||
        {};

      const risk =
        riskData.risk ||
        selectedCustomer.risk ||
        "Low";

      const riskScore = Number(
        riskData.riskScore ??
        selectedCustomer.score ??
        0
      );

      /* =======================================================
         STEP 2: Send the AI result to the Recovery API.
         The backend saves the recommendation in SQLite.
      ======================================================= */

      const recoveryResult =
        await getRecoveryRecommendations({
          customer: selectedCustomer.name,
          risk,
          amount: Number(selectedCustomer.amount || 0),
          riskScore,
        });

      console.log(
        "AI Recovery Recommendation:",
        recoveryResult
      );

      const recoveryData =
        recoveryResult?.recommendation ||
        recoveryResult?.data?.recommendation ||
        recoveryResult?.data ||
        recoveryResult ||
        {};

      /* =======================================================
         STEP 3: Display the backend recommendation.
      ======================================================= */

      setRecommendation({
        risk:
          String(risk)
            .charAt(0)
            .toUpperCase() +
          String(risk).slice(1).toLowerCase(),

        title:
          recoveryData.action ||
          "Standard recovery follow-up",

        channel:
          recoveryData.channel ||
          "Email reminder",

        expectedRecovery:
          Number(
            recoveryData.expectedRecovery || 0
          ),

        description:
          recoveryData.reasoning ||
          "Use a personalized recovery approach and continue monitoring payment behavior.",
      });

      /* =======================================================
         STEP 4: Reload the persisted SQLite action.
      ======================================================= */

      await refreshRecoveryData();
    } catch (error) {
      console.error(
        "Recovery plan generation failed:",
        error
      );

      /* =======================================================
         FALLBACK
         Keep the Recovery page functional if the API/ML
         service becomes unavailable.
      ======================================================= */

      const risk = String(
        selectedCustomer.risk || "Low"
      ).toLowerCase();

      const amount = Number(
        selectedCustomer.amount || 0
      );

      let title = "Standard recovery follow-up";
      let channel = "Email reminder";
      let expectedRecovery = Math.round(
        amount * 0.35
      );
      let description =
        "Use a personalized reminder and continue monitoring payment behavior.";

      if (risk === "high") {
        title = "Human escalation";
        channel = "Account manager";
        expectedRecovery = Math.round(
          amount * 0.72
        );
        description =
          "High-risk revenue requires direct human intervention to maximize recovery probability.";
      } else if (risk === "medium") {
        title =
          "Personalized payment reminder";
        channel = "Email + SMS";
        expectedRecovery = Math.round(
          amount * 0.55
        );
        description =
          "A personalized reminder and flexible payment option may recover the account.";
      }

      setRecommendation({
        risk:
          risk.charAt(0).toUpperCase() +
          risk.slice(1),

        title,
        channel,
        expectedRecovery,
        description,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusUpdate = async (nextStatus) => {
    if (!recoveryAction?.id) return;

    setActionLoading(true);
    setActionMessage("");

    try {
      const result = await changeRecoveryActionStatus(
        recoveryAction.id,
        nextStatus
      );

      setRecoveryAction(
        result?.action || {
          ...recoveryAction,
          status: nextStatus,
        }
      );

      await refreshRecoveryData();

      setActionMessage(
        nextStatus === "Recovered"
          ? "Recovery action completed and saved to SQLite."
          : "Recovery action status updated and saved to SQLite."
      );
    } catch (error) {
      console.error(
        "Recovery action status update failed:",
        error
      );

      setActionMessage(
        error.message ||
          "Unable to update recovery action status."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const status = recoveryAction?.status || "";
  const isRecommended = status === "Recommended";
  const isInProgress = status === "In Progress";
  const isRecovered = status === "Recovered";

  return (
    <section className="recovery-page recovery-detail-page">
      <div className="recovery-detail-card">
        <div className="recovery-detail-content">
          <p className="hero-eyebrow">REVENUE RECOVERY</p>

          <h3>Recovery</h3>

          <p className="recovery-detail-description">
            Use AI-powered recommendations to determine the safest recovery
            action for each customer.
          </p>

          <div className="page-period-badge">
            Reporting period: <strong>{selectedMonth}</strong>
          </div>

          <div className="recovery-customer-selector">
            <select
              aria-label="Select customer for recovery"
              value={selectedCustomerId}
              onChange={(event) => {
                setSelectedCustomerId(event.target.value);
                setRecommendation(null);
                setRecoveryAction(null);
                setActionMessage("");
              }}
            >
              {pageCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} — {customer.risk} Risk
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="recovery-detail-action"
            onClick={handleGenerateRecoveryPlan}
            disabled={generating || !selectedCustomer}
          >
            {generating ? "Generating..." : "Generate Recovery Plan"}
            <span>→</span>
          </button>

          {recommendation && selectedCustomer && (
            <div className="recovery-detail-result">
              <div className="recovery-detail-result-header">
                <div>
                  <p className="section-eyebrow">AI RECOVERY RECOMMENDATION</p>
                  <h4>{recommendation.title}</h4>
                </div>

                <strong
                  className={`recovery-result-level ${recommendation.risk.toLowerCase()}`}
                >
                  {recommendation.risk}
                </strong>
              </div>

              <div className="recovery-detail-result-grid">
                <div className="recovery-detail-metric">
                  <span>CHANNEL</span>
                  <strong>{recommendation.channel}</strong>
                </div>

                <div className="recovery-detail-metric">
                  <span>EXPECTED RECOVERY</span>
                  <strong>
                    ${recommendation.expectedRecovery.toLocaleString()}
                  </strong>
                </div>
              </div>

              <p className="recovery-detail-explanation">
                {recommendation.description}
              </p>
            </div>
          )}

          {recoveryAction && (
            <div
              style={{
                marginTop: "22px",
                padding: "24px",
                border: "1px solid #173f55",
                borderRadius: "16px",
                background: "#071a28",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <p className="section-eyebrow" style={{ marginBottom: "8px" }}>
                    RECOVERY ACTION TRACKING
                  </p>
                  <h4 style={{ margin: 0 }}>Action Status</h4>
                </div>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "8px 14px",
                    borderRadius: "999px",
                    background:
                      isRecovered
                        ? "rgba(54,220,152,0.12)"
                        : isInProgress
                        ? "rgba(244,186,79,0.12)"
                        : "rgba(72,178,255,0.12)",
                    border:
                      isRecovered
                        ? "1px solid rgba(54,220,152,0.3)"
                        : isInProgress
                        ? "1px solid rgba(244,186,79,0.3)"
                        : "1px solid rgba(72,178,255,0.3)",
                    color:
                      isRecovered
                        ? "#36dc98"
                        : isInProgress
                        ? "#f4ba4f"
                        : "#72cfff",
                    fontWeight: 700,
                    fontSize: "13px",
                  }}
                >
                  {status}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "14px",
                  marginTop: "18px",
                }}
              >
                <div className="recovery-detail-metric">
                  <span>ACTION</span>
                  <strong>{recoveryAction.action}</strong>
                </div>

                <div className="recovery-detail-metric">
                  <span>EXPECTED RECOVERY</span>
                  <strong>
                    ${Number(recoveryAction.expectedRecovery || 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "18px",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleStatusUpdate("In Progress")}
                  disabled={
                    actionLoading ||
                    isInProgress ||
                    isRecovered
                  }
                >
                  {actionLoading && isRecommended
                    ? "Updating..."
                    : "Mark In Progress"}
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleStatusUpdate("Recovered")}
                  disabled={
                    actionLoading ||
                    isRecovered ||
                    isRecommended
                  }
                >
                  {actionLoading && isInProgress
                    ? "Updating..."
                    : "Mark Recovered"}
                </button>
              </div>

              {actionMessage && (
                <p
                  style={{
                    margin: "14px 0 0",
                    color: isRecovered ? "#36dc98" : "#9bb7cc",
                    fontSize: "14px",
                  }}
                >
                  {actionMessage}
                </p>
              )}
            </div>
          )}

          {recoveryHistory.length > 0 && (
            <div
              style={{
                marginTop: "22px",
                padding: "24px",
                border: "1px solid #173f55",
                borderRadius: "16px",
                background: "#071a28",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <p className="section-eyebrow" style={{ marginBottom: "8px" }}>
                    RECOVERY HISTORY
                  </p>
                  <h4 style={{ margin: 0 }}>Saved Recovery Actions</h4>
                </div>

                <span
                  style={{
                    color: "#7ea5bb",
                    fontSize: "13px",
                  }}
                >
                  {recoveryHistory.length} action{recoveryHistory.length === 1 ? "" : "s"} saved
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  marginTop: "18px",
                }}
              >
                {recoveryHistory.map((historyAction) => {
                  const historyCustomer =
                    fallbackCustomers.find(
                      (customer) =>
                        String(customer.id) ===
                        String(historyAction.customerId)
                    );

                  const historyStatus =
                    String(historyAction.status || "Recommended");

                  const historyStatusColor =
                    historyStatus === "Recovered"
                      ? "#36dc98"
                      : historyStatus === "In Progress"
                      ? "#f4ba4f"
                      : "#72cfff";

                  return (
                    <div
                      key={historyAction.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) auto",
                        gap: "14px",
                        alignItems: "center",
                        padding: "16px",
                        border: "1px solid #173b51",
                        borderRadius: "12px",
                        background: "#081c2b",
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            display: "block",
                            color: "#edf6ff",
                            fontSize: "15px",
                          }}
                        >
                          {historyCustomer?.name ||
                            historyAction.customerId}
                        </strong>
                        <span
                          style={{
                            display: "block",
                            marginTop: "4px",
                            color: "#7393a7",
                            fontSize: "12px",
                          }}
                        >
                          {historyAction.customerId} · Action #{historyAction.id}
                        </span>
                      </div>

                      <div>
                        <strong
                          style={{
                            display: "block",
                            color: "#dbeafe",
                            fontSize: "14px",
                          }}
                        >
                          {historyAction.action}
                        </strong>
                        <span
                          style={{
                            display: "block",
                            marginTop: "4px",
                            color: "#7ea5bb",
                            fontSize: "12px",
                          }}
                        >
                          Expected recovery: ${Number(historyAction.expectedRecovery || 0).toLocaleString()}
                        </span>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "7px 11px",
                            borderRadius: "999px",
                            border: `1px solid ${historyStatusColor}55`,
                            background: `${historyStatusColor}12`,
                            color: historyStatusColor,
                            fontSize: "12px",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {historyStatus}
                        </span>
                        <span
                          style={{
                            display: "block",
                            marginTop: "6px",
                            color: "#6e8b9d",
                            fontSize: "11px",
                          }}
                        >
                          {historyAction.createdAt || ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


/* =========================================================
   CUSTOMERS PAGE
========================================================= */

function CustomersPage({ selectedMonth }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");

  const [selectedCustomer, setSelectedCustomer] =
    useState(null);

  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const customersPerPage = 6;


  /* =======================================================
     LOAD CUSTOMERS
  ======================================================= */

  useEffect(() => {
    // Keep the six-customer portfolio as the single source of truth on every page.
    setLoading(true);
    setCustomers(getCustomersForMonth(selectedMonth));
    setCurrentPage(1);
    setSelectedCustomer(null);
    setAnalysis(null);
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    const handleExternalSearch = (event) => {
      const query = String(event?.detail?.query || "").trim();
      if (!query) return;

      setSearchTerm(query);
      setRiskFilter("All");
      setCurrentPage(1);
    };

    window.addEventListener(
      "revenue-defence-search",
      handleExternalSearch
    );

    return () => {
      window.removeEventListener(
        "revenue-defence-search",
        handleExternalSearch
      );
    };
  }, []);


  /* =======================================================
     HELPERS
  ======================================================= */

  const getName = (customer, index = 0) => {
    return (
      customer.name ||
      customer.customerName ||
      customer.customer ||
      `Customer ${index + 1}`
    );
  };


  const getId = (customer, index = 0) => {
    return (
      customer.id ||
      customer.customerId ||
      customer.customer_id ||
      `CUS-${1024 + index}`
    );
  };


  const getAmount = (customer) => {
    return Number(
      customer.amount ??
      customer.revenue ??
      customer.amountAtRisk ??
      customer.revenueAtRisk ??
      0
    );
  };


  const getScore = (customer) => {
    const score = Number(
      customer.score ??
      customer.riskScore ??
      customer.risk_score ??
      0
    );

    return Math.round(score);
  };


  const getDaysOverdue = (customer) => {
    return Number(
      customer.daysOverdue ??
      customer.days_overdue ??
      customer.overdueDays ??
      0
    );
  };


  const getPaymentHistory = (customer) => {
    return Number(
      customer.paymentHistory ??
      customer.payment_history ??
      customer.paymentReliability ??
      customer.payment_reliability ??
      0
    );
  };


  const getRiskLevel = (customer) => {
    if (customer.risk) {
      return String(customer.risk)
        .toLowerCase()
        .trim();
    }

    const score = getScore(customer);

    if (score >= 70) {
      return "high";
    }

    if (score >= 40) {
      return "medium";
    }

    return "low";
  };


  const formatCurrency = (amount) => {
    return `$${Number(amount || 0).toLocaleString()}`;
  };


  /* =======================================================
     FILTER CUSTOMERS
  ======================================================= */

  const filteredCustomers = customers.filter(
    (customer, index) => {
      const name = getName(customer, index);
      const id = getId(customer, index);
      const risk = getRiskLevel(customer);

      const searchMatches =
        name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        id
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const riskMatches =
        riskFilter === "All" ||
        risk === riskFilter.toLowerCase();

      return searchMatches && riskMatches;
    }
  );


  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredCustomers.length /
        customersPerPage
    )
  );


  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );


  const startIndex =
    (safeCurrentPage - 1) *
    customersPerPage;


  const visibleCustomers =
    filteredCustomers.slice(
      startIndex,
      startIndex + customersPerPage
    );


  /* =======================================================
     CHANGE FILTER
  ======================================================= */

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };


  const handleRiskFilter = (value) => {
    setRiskFilter(value);
    setCurrentPage(1);
  };


  /* =======================================================
     CUSTOMER COUNTS
  ======================================================= */

  const highCount = customers.filter(
    (customer) =>
      getRiskLevel(customer) === "high"
  ).length;


  const mediumCount = customers.filter(
    (customer) =>
      getRiskLevel(customer) === "medium"
  ).length;


  const lowCount = customers.filter(
    (customer) =>
      getRiskLevel(customer) === "low"
  ).length;


  /* =======================================================
     REVIEW CUSTOMER
  ======================================================= */

  const handleReview = async (customer) => {
    setSelectedCustomer(customer);
    setAnalysis(null);
    setAnalyzing(true);

    try {
      const result =
        await runRiskAnalysis({
          customer: getName(customer),
          amount: getAmount(customer),
          paymentHistory:
            getPaymentHistory(customer),
          daysOverdue:
            getDaysOverdue(customer),
        });

      console.log(
        "Customer AI Analysis:",
        result
      );

      const resultData =
        result?.data ||
        result?.analysis ||
        result ||
        null;

      if (
        resultData &&
        typeof resultData === "object"
      ) {
        setAnalysis(resultData);
      } else {
        throw new Error(
          "Invalid AI response"
        );
      }

    } catch (error) {
      console.error(
        "Customer analysis failed:",
        error
      );

      /*
        Local fallback analysis.
        This makes Review work even if
        the AI endpoint is unavailable.
      */

      const score = getScore(customer);
      const risk = getRiskLevel(customer);

      let recommendedAction =
        "Continue monitoring";

      if (risk === "high") {
        recommendedAction =
          "Prioritize immediate recovery action";
      } else if (risk === "medium") {
        recommendedAction =
          "Send personalized payment reminder";
      } else {
        recommendedAction =
          "Maintain normal customer monitoring";
      }

      setAnalysis({
        riskScore: score,
        risk:
          risk.charAt(0).toUpperCase() +
          risk.slice(1),
        recommendedAction,
        explanation:
          "The RevenueDefence AI engine evaluated this customer using revenue exposure, payment reliability and overdue payment behavior.",
        factors: {
          revenueImpact:
            formatCurrency(
              getAmount(customer)
            ),
          paymentDelay:
            `${getDaysOverdue(customer)} days`,
          paymentReliability:
            `${getPaymentHistory(customer)}%`,
        },
      });

    } finally {
      setAnalyzing(false);
    }
  };


  /* =======================================================
     CLOSE DETAILS
  ======================================================= */

  const closeDetails = () => {
    setSelectedCustomer(null);
    setAnalysis(null);
  };


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <section className="customers-page">

        <div className="customer-loading-card">

          <div className="loading-dot"></div>

          <h3>
            Loading Customers
          </h3>

          <p>
            Fetching customer intelligence
            from RevenueDefence...
          </p>

        </div>

      </section>
    );
  }


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section className="customers-page">

      {/* =================================================
          INTRO
      ================================================= */}

      <div className="customers-intro">

        <div>

          <p className="hero-eyebrow">
            CUSTOMER INTELLIGENCE
          </p>

          <h3>
            Customers
          </h3>

          <p>
            Monitor customer health, payment
            behavior, revenue exposure and
            recovery opportunities.
          </p>

        </div>


        <div className="customer-engine-status">

          <span className="status-dot"></span>

          <div>

            <strong>
              AI Customer Engine
            </strong>

            <span>
              {customers.length} accounts monitored
            </span>

          </div>

        </div>

      </div>


      {/* =================================================
          SUMMARY CARDS
      ================================================= */}

      <div className="customer-summary">

        <div className="customer-summary-card">

          <div className="customer-summary-icon">
            ♙
          </div>

          <div>

            <span>
              TOTAL CUSTOMERS
            </span>

            <strong>
              {customers.length}
            </strong>

          </div>

        </div>


        <div className="customer-summary-card high-card">

          <div className="customer-summary-icon">
            !
          </div>

          <div>

            <span>
              HIGH RISK
            </span>

            <strong>
              {highCount}
            </strong>

          </div>

        </div>


        <div className="customer-summary-card medium-card">

          <div className="customer-summary-icon">
            ◉
          </div>

          <div>

            <span>
              MEDIUM RISK
            </span>

            <strong>
              {mediumCount}
            </strong>

          </div>

        </div>


        <div className="customer-summary-card low-card">

          <div className="customer-summary-icon">
            ✓
          </div>

          <div>

            <span>
              LOW RISK
            </span>

            <strong>
              {lowCount}
            </strong>

          </div>

        </div>

      </div>


      {/* =================================================
          CUSTOMER TABLE CARD
      ================================================= */}

      <div className="customers-table-card">

        {/* TABLE HEADER */}

        <div className="customers-table-header">

          <div>

            <p className="section-eyebrow">
              CUSTOMER PORTFOLIO
            </p>

            <h4>
              All Customers
            </h4>

            <p>
              Review customer risk and revenue
              exposure.
            </p>

          </div>

          <span className="model-badge">
            AI POWERED
          </span>

        </div>


        {/* =================================================
            CONTROLS
        ================================================= */}

        <div className="customer-controls">

          <div className="customer-search">

            <span>
              ⌕
            </span>

            <input
              type="text"
              placeholder="Search customer or ID..."
              value={searchTerm}
              onChange={(event) =>
                handleSearchChange(
                  event.target.value
                )
              }
            />

          </div>


          <div className="risk-filters">

            {[
              "All",
              "High",
              "Medium",
              "Low",
            ].map((filter) => (

              <button
                key={filter}
                type="button"
                className={
                  riskFilter === filter
                    ? "active"
                    : ""
                }
                onClick={() =>
                  handleRiskFilter(filter)
                }
              >
                {filter}
              </button>

            ))}

          </div>

        </div>


        {/* =================================================
            TABLE
        ================================================= */}

        <div className="customer-table-wrapper">

          {visibleCustomers.length === 0 ? (

            <div className="customer-empty">

              <strong>
                No customers found
              </strong>

              <span>
                Try changing your search or
                risk filter.
              </span>

            </div>

          ) : (

            <table className="customer-table">

              <thead>

                <tr>

                  <th>
                    CUSTOMER
                  </th>

                  <th>
                    REVENUE
                  </th>

                  <th>
                    RISK
                  </th>

                  <th>
                    SCORE
                  </th>

                  <th>
                    OVERDUE
                  </th>

                  <th>
                    RELIABILITY
                  </th>

                  <th>
                    ACTION
                  </th>

                </tr>

              </thead>


              <tbody>

                {visibleCustomers.map(
                  (customer, index) => {

                    const actualIndex =
                      startIndex + index;

                    const name =
                      getName(
                        customer,
                        actualIndex
                      );

                    const id =
                      getId(
                        customer,
                        actualIndex
                      );

                    const amount =
                      getAmount(customer);

                    const risk =
                      getRiskLevel(customer);

                    const score =
                      getScore(customer);

                    const overdue =
                      getDaysOverdue(customer);

                    const reliability =
                      getPaymentHistory(customer);


                    return (

                      <tr key={id}>

                        <td>

                          <div className="customer-name">
                            {name}
                          </div>

                          <div className="customer-id">
                            {id}
                          </div>

                        </td>


                        <td className="revenue-cell">
                          {formatCurrency(
                            amount
                          )}
                        </td>


                        <td>

                          <span
                            className={`customer-risk-badge ${risk}`}
                          >
                            {risk}
                          </span>

                        </td>


                        <td>

                          <span className="customer-score">
                            {score}%
                          </span>

                        </td>


                        <td>

                          <span
                            className={
                              overdue >= 30
                                ? "overdue-danger"
                                : overdue >= 15
                                ? "overdue-warning"
                                : "overdue-normal"
                            }
                          >
                            {overdue} days
                          </span>

                        </td>


                        <td>

                          <div className="reliability-cell">

                            <div className="reliability-bar">

                              <span
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      reliability
                                    )
                                  )}%`,
                                }}
                              ></span>

                            </div>

                            <span>
                              {reliability}%
                            </span>

                          </div>

                        </td>


                        <td>

                          <button
                            type="button"
                            className="customer-review-button"
                            onClick={() =>
                              handleReview(
                                customer
                              )
                            }
                          >
                            Review →
                          </button>

                        </td>

                      </tr>

                    );
                  }
                )}

              </tbody>

            </table>

          )}

        </div>


        {/* =================================================
            PAGINATION
        ================================================= */}

        {filteredCustomers.length > 0 && (

          <div className="customer-pagination">

            <span>

              Showing{" "}
              {startIndex + 1}
              {" – "}
              {Math.min(
                startIndex +
                  customersPerPage,
                filteredCustomers.length
              )}
              {" of "}
              {filteredCustomers.length}

            </span>


            <div>

              <button
                type="button"
                disabled={
                  safeCurrentPage === 1
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.max(
                        1,
                        page - 1
                      )
                  )
                }
              >
                ←
              </button>


              <strong>
                {safeCurrentPage}
              </strong>


              <span>
                / {totalPages}
              </span>


              <button
                type="button"
                disabled={
                  safeCurrentPage ===
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.min(
                        totalPages,
                        page + 1
                      )
                  )
                }
              >
                →
              </button>

            </div>

          </div>

        )}

      </div>


      {/* =================================================
          CUSTOMER DETAIL MODAL
      ================================================= */}

      {selectedCustomer && (

        <div
          className="customer-modal-overlay"
          onClick={closeDetails}
        >

          <div
            className="customer-detail-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <button
              type="button"
              className="customer-modal-close"
              onClick={closeDetails}
            >
              ×
            </button>


            {/* HEADER */}

            <div className="customer-detail-header">

              <div>

                <p className="section-eyebrow">
                  CUSTOMER RISK PROFILE
                </p>

                <h3>
                  {getName(
                    selectedCustomer
                  )}
                </h3>

                <span>
                  {getId(
                    selectedCustomer
                  )}
                </span>

              </div>


              <span
                className={`customer-risk-badge ${getRiskLevel(
                  selectedCustomer
                )}`}
              >
                {getRiskLevel(
                  selectedCustomer
                )}
              </span>

            </div>


            {/* METRICS */}

            <div className="customer-detail-metrics">

              <div>

                <span>
                  REVENUE EXPOSURE
                </span>

                <strong>
                  {formatCurrency(
                    getAmount(
                      selectedCustomer
                    )
                  )}
                </strong>

              </div>


              <div>

                <span>
                  RISK SCORE
                </span>

                <strong>
                  {getScore(
                    selectedCustomer
                  )}%
                </strong>

              </div>


              <div>

                <span>
                  DAYS OVERDUE
                </span>

                <strong>
                  {getDaysOverdue(
                    selectedCustomer
                  )}
                </strong>

              </div>


              <div>

                <span>
                  RELIABILITY
                </span>

                <strong>
                  {getPaymentHistory(
                    selectedCustomer
                  )}%
                </strong>

              </div>

            </div>


            {/* AI ANALYSIS */}

            <div className="customer-ai-result">

              <div className="customer-ai-heading">

                <div>

                  <p className="section-eyebrow">
                    AI ANALYSIS
                  </p>

                  <h4>
                    Risk Assessment
                  </h4>

                </div>

                <span>
                  AI POWERED
                </span>

              </div>


              {analyzing ? (

                <div className="customer-analysis-loading">

                  <div className="loading-dot"></div>

                  <span>
                    AI is analyzing customer
                    behavior...
                  </span>

                </div>

              ) : analysis ? (

                <>

                  <div className="ai-risk-result">

                    <div>

                      <span>
                        RISK SCORE
                      </span>

                      <strong>
                        {analysis.riskScore ??
                          getScore(
                            selectedCustomer
                          )}
                        %
                      </strong>

                    </div>


                    <div>

                      <span>
                        RECOMMENDED ACTION
                      </span>

                      <strong>
                        {analysis.recommendedAction ||
                          "Review account"}
                      </strong>

                    </div>

                  </div>


                  <div className="ai-explanation">

                    <span>
                      AI EXPLANATION
                    </span>

                    <p>
                      {analysis.explanation ||
                        analysis.reason ||
                        "The AI engine evaluated this customer based on revenue exposure and payment behavior."}
                    </p>

                  </div>


                  {analysis.factors && (

                    <div className="ai-factors">

                      <div>

                        <span>
                          REVENUE IMPACT
                        </span>

                        <strong>
                          {analysis.factors
                            .revenueImpact ||
                            formatCurrency(
                              getAmount(
                                selectedCustomer
                              )
                            )}
                        </strong>

                      </div>


                      <div>

                        <span>
                          PAYMENT DELAY
                        </span>

                        <strong>
                          {analysis.factors
                            .paymentDelay ||
                            `${getDaysOverdue(
                              selectedCustomer
                            )} days`}
                        </strong>

                      </div>


                      <div>

                        <span>
                          RELIABILITY
                        </span>

                        <strong>
                          {analysis.factors
                            .paymentReliability ||
                            `${getPaymentHistory(
                              selectedCustomer
                            )}%`}
                        </strong>

                      </div>

                    </div>

                  )}

                </>

              ) : (

                <div className="customer-analysis-empty">

                  <span>
                    Select Review to run the
                    AI risk assessment.
                  </span>

                </div>

              )}

            </div>


            {/* ACTION */}

            <div className="customer-detail-actions">

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  handleReview(
                    selectedCustomer
                  )
                }
                disabled={analyzing}
              >

                {analyzing
                  ? "Analyzing..."
                  : "Run AI Analysis"}

                <span>
                  →
                </span>

              </button>


              <button
                type="button"
                className="secondary-button"
                onClick={closeDetails}
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </section>
  );
}

/* =========================================================
   ANALYTICS PAGE
========================================================= */

function AnalyticsPage({ data, selectedMonth }) {
  const monthNames = MONTH_NAMES;
  const [recoveryActions, setRecoveryActions] = useState([]);
  const [recoveryActionsLoading, setRecoveryActionsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadRecoveryActions = async () => {
      setRecoveryActionsLoading(true);

      try {
        const response = await fetch("http://localhost:5000/api/recovery-actions");

        if (!response.ok) {
          throw new Error(`Recovery actions request failed: ${response.status}`);
        }

        const result = await response.json();
        const actions = Array.isArray(result?.actions)
          ? result.actions
          : [];

        if (!cancelled) {
          setRecoveryActions(actions);
        }
      } catch (error) {
        console.error("Failed to load recovery actions for analytics:", error);

        if (!cancelled) {
          setRecoveryActions([]);
        }
      } finally {
        if (!cancelled) {
          setRecoveryActionsLoading(false);
        }
      }
    };

    loadRecoveryActions();

    return () => {
      cancelled = true;
    };
  }, []);

  const monthlyAnalytics = MONTHLY_ANALYTICS;

  const isAllMonths = !selectedMonth || selectedMonth === "All Months";
  const selectedIndex = Math.max(0, monthNames.indexOf(selectedMonth));
  const selectedMetrics = isAllMonths
    ? ALL_MONTHS_METRICS
    : monthlyAnalytics[selectedMonth] || monthlyAnalytics["August 2026"];

  const uniqueRecoveredActions = getUniqueRecoveredActions(recoveryActions);

  const liveRecoveredRevenue = uniqueRecoveredActions.reduce(
    (sum, item) => sum + Number(item.expectedRecovery || 0),
    0
  );
  const liveRecoveryRate = selectedMetrics.atRisk
    ? Number(((liveRecoveredRevenue / selectedMetrics.atRisk) * 100).toFixed(1))
    : 0;
  const liveOutstandingRevenue = Math.max(
    0,
    Number(selectedMetrics.atRisk || 0) - liveRecoveredRevenue
  );

  const previousMetrics = !isAllMonths
    ? monthlyAnalytics[monthNames[Math.max(0, selectedIndex - 1)]] || selectedMetrics
    : selectedMetrics;

  const trendPercent = previousMetrics.revenue
    ? (((selectedMetrics.revenue - previousMetrics.revenue) / previousMetrics.revenue) * 100).toFixed(1)
    : "0.0";

  const monthlyRevenue = isAllMonths
    ? monthNames.map((month) => ({
        month: month.slice(0, 3),
        value: monthlyAnalytics[month].revenue,
        fullMonth: month,
      }))
    : [{
        month: selectedMonth.slice(0, 3),
        value: selectedMetrics.revenue,
        fullMonth: selectedMonth,
      }];

  const maxRevenue = Math.max(...monthlyRevenue.map((item) => item.value), 1);

  const riskData = [
    { label: "High Risk", value: highRiskCount, className: "high" },
    { label: "Medium Risk", value: mediumRiskCount, className: "medium" },
    { label: "Low Risk", value: lowRiskCount, className: "low" },
  ];

  return (
    <section className="analytics-page">
      <div className="analytics-intro">
        <div>
          <p className="hero-eyebrow">PERFORMANCE INTELLIGENCE</p>
          <h3>Analytics</h3>
          <p>
            Monitor revenue protection, risk distribution and recovery
            performance across your customer portfolio.
          </p>
        </div>

        <div className="reporting-period">
          <span>Reporting Period</span>
          <strong>{selectedMonth}</strong>
        </div>
      </div>

      <div className="analytics-kpi-grid">
        <AnalyticsKpi
          icon="◇"
          label="Total Revenue"
          value={`$${Number(selectedMetrics.revenue).toLocaleString()}`}
          note="Current portfolio"
        />
        <AnalyticsKpi
          icon="⚠"
          label="Revenue at Risk"
          value={`$${Number(selectedMetrics.atRisk).toLocaleString()}`}
          note="Requires attention"
        />
        <AnalyticsKpi
          icon="↗"
          label="Recovery Rate"
          value={recoveryActionsLoading ? "…" : `${liveRecoveryRate}%`}
          note="Live from recovery actions"
        />
        <AnalyticsKpi
          icon="◆"
          label="Recovered Revenue"
          value={
            recoveryActionsLoading
              ? "…"
              : `$${Number(liveRecoveredRevenue).toLocaleString()}`
          }
          note="Recovered actions in SQLite"
        />
      </div>

      <div className="analytics-main-grid">
        <div className="analytics-card revenue-trend-card">
          <div className="analytics-card-header">
            <div>
              <p>REVENUE TREND</p>
              <h4>Monthly Revenue</h4>
            </div>
            <span className="trend-badge">
              {isAllMonths ? "12-month view" : `${trendPercent}% vs prior month`}
            </span>
          </div>

          <div className="bar-chart">
            <div className="chart-y-axis">
              <span>$300K</span>
              <span>$250K</span>
              <span>$200K</span>
              <span>$150K</span>
              <span>$100K</span>
              <span>$0</span>
            </div>

            <div className="chart-area">
              <div className="chart-grid-lines">
                <i></i><i></i><i></i><i></i><i></i><i></i>
              </div>

              <div className="bars">
                {monthlyRevenue.map((item) => (
                  <div className="bar-column" key={item.fullMonth} title={item.fullMonth}>
                    <span className="bar-value">
                      ${Math.round(item.value / 1000)}K
                    </span>
                    <div
                      className="bar"
                      style={{ height: `${(item.value / maxRevenue) * 100}%` }}
                    ></div>
                    <span className="bar-label">{item.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="analytics-card risk-distribution-card">
          <div className="analytics-card-header">
            <div>
              <p>RISK INTELLIGENCE</p>
              <h4>Risk Distribution</h4>
            </div>
          </div>

          <div className="risk-donut-wrap">
            <div
              className="risk-donut"
              style={{
                background: `conic-gradient(
                  #ff6471 0deg ${(highRiskCount / totalRiskAccounts) * 360}deg,
                  #f4ba4f ${(highRiskCount / totalRiskAccounts) * 360}deg ${((highRiskCount + mediumRiskCount) / totalRiskAccounts) * 360}deg,
                  #36dc98 ${((highRiskCount + mediumRiskCount) / totalRiskAccounts) * 360}deg 360deg
                )`,
              }}
            >
              <div>
                <strong>{totalRiskAccounts}</strong>
                <span>accounts</span>
              </div>
            </div>

            <div className="risk-legend">
              {riskData.map((item) => (
                <div key={item.label}>
                  <span className={`legend-dot ${item.className}`}></span>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="analytics-bottom-grid">
        <div className="analytics-card recovery-performance-card">
          <div className="analytics-card-header">
            <div>
              <p>RECOVERY PERFORMANCE</p>
              <h4>Recovery Performance</h4>
            </div>
            <span className="success-badge">
              {recoveryActionsLoading ? "Loading..." : `${liveRecoveryRate}% successful`}
            </span>
          </div>

          <div className="performance-row">
            <div>
              <span>Revenue Identified</span>
              <strong>${Number(selectedMetrics.atRisk).toLocaleString()}</strong>
            </div>
            <div>
              <span>Revenue Recovered</span>
              <strong>
                {recoveryActionsLoading
                  ? "—"
                  : `$${Number(liveRecoveredRevenue).toLocaleString()}`}
              </strong>
            </div>
            <div>
              <span>Outstanding</span>
              <strong>
                {recoveryActionsLoading
                  ? "—"
                  : `$${Number(liveOutstandingRevenue).toLocaleString()}`}
              </strong>
            </div>
          </div>

          <div className="progress-track">
            <span
              style={{
                width: `${Math.min(100, Math.max(0, liveRecoveryRate))}%`,
              }}
            ></span>
          </div>
        </div>

        <div className="analytics-card portfolio-health-card">
          <div className="analytics-card-header">
            <div>
              <p>PORTFOLIO HEALTH</p>
              <h4>Customer Health</h4>
            </div>
          </div>

          <div className="health-list">
            <div>
              <span>Healthy accounts</span>
              <strong>{lowRiskCount}</strong>
              <em>{((lowRiskCount / totalCustomers) * 100).toFixed(1)}%</em>
            </div>
            <div>
              <span>Accounts to monitor</span>
              <strong>{mediumRiskCount}</strong>
              <em>{((mediumRiskCount / totalCustomers) * 100).toFixed(1)}%</em>
            </div>
            <div>
              <span>Immediate action</span>
              <strong>{highRiskCount}</strong>
              <em>{((highRiskCount / totalCustomers) * 100).toFixed(1)}%</em>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnalyticsKpi({ icon, label, value, note }) {
  return (
    <div className="analytics-kpi">
      <div className="analytics-kpi-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}


/* =========================================================
   PLACEHOLDER PAGE
========================================================= */

function PagePlaceholder({
  eyebrow,
  title,
  description,
  button,
}) {
  return (
    <section className="placeholder-page">

      <div className="placeholder-card">

        <p className="hero-eyebrow">
          {eyebrow}
        </p>

        <h3>
          {title}
        </h3>

        <p>
          {description}
        </p>

        <button className="primary-button">

          {button}

          <span>
            →
          </span>

        </button>

      </div>

    </section>
  );
}


/* =========================================================
   EXPORT
========================================================= */

export default App;
