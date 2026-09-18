CareFlow AI

AI-assisted care coordination with safe, auditable patient-intake triage and clinician-in-the-loop workflows.






Overview

CareFlow AI is a full-stack healthcare workflow platform for managing patient intake and care journeys from initial submission through triage, clinician review, approval, appointment scheduling, and completion.

The platform uses Google Gemini to convert unstructured intake information into a structured workflow recommendation. It classifies operational urgency, generates a concise summary and rationale, identifies risk indicators, and recommends whether the case can remain in triage or must be escalated to a clinician.

CareFlow AI is designed around a human-in-the-loop model: AI assists with prioritization and routing, while clinicians retain responsibility for review and decisions.

Important: This project is a demonstration application that uses synthetic data. It does not provide medical diagnoses, treatment recommendations, or emergency services and is not presented as a HIPAA-compliant production system.

Live Application

Demo: careflow-ai-delta.vercel.app/dashboard

Source: github.com/dev-08/careflow-ai

Core Features

Structured patient-intake collection

Patient and care-journey dashboards

Versioned care-journey state transitions

AI-assisted intake triage using Google Gemini

Urgency classification: LOW, MEDIUM, HIGH, or CRITICAL

Confidence scores, summaries, rationales, and risk indicators

Automatic escalation of risky or uncertain cases to clinician review

Authenticated clinician workflows using Supabase Auth

Idempotent API operations that prevent duplicate AI requests

Optimistic concurrency control for stale-update protection

Care-event history and audit logging

Responsive interface deployed on Vercel

How AI Is Used

The AI triage pipeline evaluates the following synthetic intake fields:

Reason for care

Reported symptoms

Symptom duration

Patient-provided urgency rating

Additional notes

Gemini returns a structured result containing:

{
  "urgencyLevel": "LOW | MEDIUM | HIGH | CRITICAL",
  "confidence": 0.0,
  "recommendedState": "TRIAGE_PENDING | CLINICIAN_REVIEW",
  "requiresHumanReview": true,
  "summary": "Neutral intake summary",
  "rationale": "Reason for the workflow recommendation",
  "riskIndicators": []
}

The output supports workflow routing only. The model is explicitly instructed not to diagnose patients or provide medical advice.

AI Safety Guardrails

CareFlow AI does not rely solely on the model's recommendation. The application adds deterministic safeguards around the LLM:

Treats all intake text as untrusted data rather than executable instructions

Requests schema-constrained JSON from Gemini

Validates every response with Zod before using it

Routes HIGH and CRITICAL cases to clinician review

Routes results with confidence below 0.85 to clinician review

Routes any result containing risk indicators to clinician review

Detects predefined high-risk language independently of the model

Records the model name, prompt version, output, events, and audit data

Uses idempotency keys to avoid duplicate model calls and database records

Workflow

flowchart TD
    A[Patient intake] --> B[Gemini triage]
    B --> C[Schema validation]
    C --> D[Deterministic safety checks]
    D --> E{Risky or uncertain?}
    E -- Yes --> F[Clinician review]
    E -- No --> G[Triage queue]
    F --> H[Care-journey actions]
    G --> H
    H --> I[Appointment and completion]

Every accepted transition updates the care journey, records a care event, and writes audit information in the database.

Technology Stack

Layer

Technologies

Frontend

Next.js 16, React 19, TypeScript, Tailwind CSS

Backend

Next.js Route Handlers, REST APIs, Zod

AI

Google Gemini, @google/genai, structured JSON output

Authentication

Supabase Auth, server-side session validation

Database

Supabase PostgreSQL, PL/pgSQL functions

Reliability

Idempotency keys, optimistic concurrency, transactional updates

Deployment

Vercel and Supabase

Architecture

flowchart LR
    UI[Next.js UI] --> API[Route handlers]
    API --> AUTH[Supabase Auth]
    API --> AI[Gemini API]
    API --> DB[(PostgreSQL)]
    AI --> API
    DB --> UI

Main Data Entities

patient_intakes — patient-provided intake information

care_journeys — current workflow state and version

care_events — append-only journey event history

ai_triage_results — structured AI outputs and model metadata

audit_logs — traceable system and agent activity

staff_profiles — clinician role and access information

API Routes

Method

Route

Purpose

POST

/api/intakes

Create a patient intake and associated care journey

POST

/api/journeys/{journeyId}/triage

Run AI-assisted triage and record the result

POST

/api/journeys/{journeyId}/transition

Apply an authorized care-journey transition

GET

/api/ai/test

Test Gemini triage in development only

Getting Started

Prerequisites

Node.js 20 or later

npm

Supabase CLI

Docker-compatible runtime for local Supabase

Google Gemini API key

1. Clone the repository

git clone https://github.com/dev-08/careflow-ai.git
cd careflow-ai

2. Install dependencies

npm install

3. Start Supabase locally

npx supabase start
npx supabase db reset

The reset command applies the migrations and loads the synthetic seed data.

4. Configure environment variables

Create .env.local in the project root:

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

# Use one supported server-side secret variable.
SUPABASE_SECRET_KEY=your_supabase_secret_key
# SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_supported_gemini_model

Never commit .env.local or expose the Supabase secret/service-role key in client-side code.

5. Start the application

npm run dev

Open http://localhost:3000.

Reliability and Security Design

Server-side authentication is required for protected AI and workflow operations.

Zod validates API input and AI-generated output.

Journey versions prevent conflicting or stale updates.

Idempotency keys make repeated requests safe.

PostgreSQL functions atomically store AI results, update journey state, create events, and write audit logs.

AI recommendations are explainable through stored summaries, rationales, confidence scores, and risk indicators.

Available Scripts

npm run dev    # Start the development server
npm run build  # Create a production build
npm run start  # Run the production build
npm run lint   # Run ESLint

Future Improvements

Add automated unit, integration, and end-to-end tests

Add clinician feedback for evaluating AI recommendations

Introduce monitoring for model latency, failures, and routing quality

Support standards-based healthcare integrations such as FHIR

Add configurable triage policies and prompt-version experiments

Complete security and compliance reviews before handling real patient data


Dev Patel

GitHub: @dev-08

License

This repository does not currently declare an open-source license. All rights are reserved unless a license is added by the repository owner.
