# KESHAR KALI — BUSINESS OPERATIONS MANAGEMENT PORTAL
> **Tagline:** *Precision in Every Grain*  
> **Brand Identity:** Deep Burgundy (`#5E1010`), Primary Crimson (`#8F1717`), Heritage Gold (`#C69A3B`), Warm White (`#FAF9F6`), Crisp Surfaces (`#FFFFFF`).

---

## 🌾 Overview & Business Workflow

**Keshar Kali** is a complete, production-ready business operations management web application built specifically for independent rice suppliers, wholesalers, and mill brokers.

### The Business Scenario
A supplier receives a purchase order (e.g., **ABC Traders** orders **100 QTL HMT Rice** @ **₹3,200/QTL** delivered to their godown).  
The supplier fulfills this single customer order by sourcing from three different rice processing mills:
* **Industry A (Balaji Modern Mill):** 40 QTL @ ₹2,850/QTL
* **Industry B (Vaishnavi Agro):** 35 QTL @ ₹2,900/QTL
* **Industry C (Kisan Rice Ind):** 25 QTL @ ₹2,820/QTL

The customer only cares about receiving their high-grade HMT Rice product; **all internal sourcing mills, allocations, and purchase rates remain strictly confidential.**

Furthermore, the application authoritatively supports two operational dispatch workflows:
1. **Warehouse Fulfillment:** Rice is transported from the mill into the supplier's warehouse, incrementing physical inventory via a chronological `stock_ledger` entry. Customer dispatches from the warehouse deduct physical stock and release reservations.
2. **Direct Mill Fulfillment:** Rice is dispatched directly from the rice mill to the customer godown without ever entering the supplier warehouse. Fulfillment progress updates automatically without generating false warehouse stock movements.

---

## 🚀 Key Modules & Architecture

### 1. Operational Command Center (Dashboard)
* Live counters derived from actual database records (No hardcoded metrics):
  * Total PO Orders & Total Ordered QTL
  * Total Allocated QTL & Weighted Average Purchase Cost
  * Total Loaded QTL & Pending Mill Loadings
  * Total Dispatched QTL & Net Pending Buyer Fulfillment
  * Total Physical Stock, Reserved Stock & Available Stock
* Low stock alerts based on product safety thresholds.
* Live operational action links (New PO, Add Loading, Confirm Dispatch, Excel Exports).

### 2. Customer Purchase Orders
* Auto-generated sequential numbers (`PO-2026-XXX`).
* Statuses automatically derived from operational records: `New`, `Partially Allocated`, `Allocated`, `Partially Loaded`, `Loaded`, `Partially Dispatched`, `Completed`, `Cancelled`.
* Order drawer with visual fulfillment progress bar, sourcing economics, gross margin calculations, and warehouse stock reservation toggle.

### 3. Industry Sourcing & Multi-Mill Allocations
* One Customer PO $\rightarrow$ Multiple Sourcing Allocations.
* Weighted average purchase rate calculation:
  $$\text{WAC} = \frac{\sum (\text{Allocated QTL} \times \text{Purchase Rate})}{\sum \text{Allocated QTL}}$$
* Estimated gross margin calculation.
* Over-allocation protection with optional authorized override.

### 4. Authoritative Stock Ledger & Inventory Accounting
* Traditional accounting ledger with **immutable chronological running balance**.
* Formulas:
  $$\text{Available Stock} = \text{Physical Stock} - \text{Reserved Stock}$$
* Stock Inward, Stock Outward with available stock validation.
* Stock Reservations (soft commitments that protect stock for buyer orders without premature deduction).
* Inter-Warehouse Transfers (atomic dual-side ledger transactions).
* Stock Audit Adjustments (physical count reconciliation that preserves ledger history).
* Weighted Average Cost (WAC) Stock Valuation.

### 5. Master Loading Register (Flagship Operational Grid)
* Dense Excel-style data grid with sticky headers.
* Keyboard navigation: $\uparrow \downarrow \leftarrow \rightarrow$ arrows, Tab, Enter.
* Multi-row clipboard copy/paste from Microsoft Excel.
* Inline cell editing with auto-save indicator.
* Today's Loading, Total Loading, Pending Loading, and Today's Dispatch totals strip.

### 6. Dispatch Management & Customer Privacy Safeguard
* Loading and Dispatch are two separate operations.
* Supports partial dispatches against single loading entries.
* Available-to-dispatch validation.
* Automatic customer WhatsApp dispatch notifications via backend API.
* **Confidentiality Guarantee:** Internal mill names and purchase rates are strictly scrubbed from customer notifications.
* Idempotency protection prevents duplicate alerts.

### 7. Automatic Genuine Excel Reporting
* Generates genuine `.xlsx` binary workbooks using `exceljs` (not renamed CSVs):
  * Master Loading Register Excel (with header styling, DD-MM-YYYY dates, ₹ currency, totals)
  * Industry-wise Sourcing Report
  * Buyer-wise Performance Report
  * PO Fulfillment Pipeline Report
  * Audited Stock Ledger & Inventory Summary Excel

### 8. Master Directories & Security
* Customer Master (with WhatsApp phone, GSTIN, and lifetime ledger).
* Industry Master (strictly internal sourcing partners and benchmark purchase rates).
* Product Master (rice varieties, brand grades, safety thresholds; $1\text{ QTL} = 100\text{ KG}$).
* Warehouse Master (godowns, capacities, and live utilization).
* User Roles (`Admin` vs `Operator`) with instant toggle in the navbar.
* Audit trail logging all operational mutations.

---

## 🛠️ Tech Stack

* **Runtime:** Node.js v22 (with built-in native `node:sqlite` in WAL mode)
* **Backend:** Express.js, ExcelJS, bcryptjs, jsonwebtoken, CORS
* **Frontend:** React 18, Vite, Tailwind CSS v4, Lucide React icons
* **Design System:** AgroOps Glassmorphic Precision (Stitch design specification)

---

## ⚙️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Database with Realistic Keshar Kali Data
```bash
node --experimental-sqlite server/db/seed.js
```

### 3. Run Automated 22 Business Scenario Test Suite
```bash
npm test
```

### 4. Build Frontend
```bash
npm run build
```

### 5. Start Production Server
```bash
npm start
```
The application will be live at **http://localhost:5000**.

For Vite frontend hot-reload development:
```bash
npm run dev
```
(Runs Vite dev server on **http://localhost:3000** with automatic proxying to backend `/api` on port 5000).

---

## 📜 Default Credentials

| Username | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **Admin** | Full system access, stock adjustments, user management, reports |
| `operator` | `operator123` | **Operator** | PO creation, sourcing, loading register, dispatch confirmation |

*Note: You can also instantly switch roles via the navbar role badge in the top right.*

