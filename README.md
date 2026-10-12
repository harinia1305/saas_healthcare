# Secure Healthcare Payments & Billing SaaS Platform

A real-time, EHR-integrated SaaS platform built to streamline medical billing, insurance claim processing, and automated refund pipelines while enforcing strict healthcare compliance and data security.

## 🛠️ Tech Stack
* **Frontend:** React.js, Tailwind CSS, Context API, Recharts
* **Backend:** Node.js, Express.js (RESTful service architecture)
* **Database:** MongoDB Atlas, Mongoose ODM
* **Security:** JWT authentication, RBAC middleware, field-level encryption concepts for Protected Health Information (PHI)

---

## 🏛️ System Architecture & Data Flow

```text
[ EHR / External Client ] 
       │ (FHIR JSON Payloads)
       ▼
[ Express API Gateway ] ──(RBAC Middleware)──► [ Route Controllers ]
                                                     │
            ┌────────────────────────────────────────┴────────────────────────────────────────┐
            ▼                                                                                 ▼
[ Billing & Claims Engine ]                                                      [ Automated Refund Pipeline ]
            │                                                                                 │
            ▼                                                                                 ▼
[ MongoDB Atlas (Encrypted PHI Collections) ] ◄─────────────────────────────── [ Immutable Audit Logs ]
