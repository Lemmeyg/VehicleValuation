# Product Requirements Document (PRD)
## Vehicle Valuation SaaS - MVP

**Version:** 0.1
**Last Updated:** December 9, 2024
**Status:** Draft - User Flow Definition Phase

---

## 1. Executive Summary

### Product Vision
A SaaS platform that enables users to input details of vehicles involved in accidents and receive independent market valuations through comprehensive reports.

### MVP Objectives
1. **Test Critical Assumption**: Will users pay for comprehensive vehicle valuation reports?
2. **Validate Data Accuracy**: Can we obtain accurate valuation data from available sources?
3. **Prove Core Value**: Demonstrate that the platform provides actionable, trustworthy valuations

### Target Market (MVP)
- **Primary**: Individual consumers (B2C) who need vehicle valuations post-accident
- **Future**: Potential expansion to B2B (insurance adjusters, body shops)

---

## 2. User Flow

### Stage 1: Authentication & Onboarding ✓

#### Entry Point
- Users must register/login before accessing any functionality
- Rationale: Handling sensitive accident data; users need to save and retrieve reports

#### Authentication Method
- **MVP**: Email/password authentication only
- **Future**: Social login (Google, Apple), magic links

#### Registration Data Collection
- **Required Fields**:
  - Email address
  - Full name
  - Password (secure, min 8 characters)
- **Optional Fields**:
  - Company name (if business user - for future B2B)
- **Not Collected in MVP**: Phone number, address

#### User Types
- **MVP Focus**: Individual consumers only
- **Account Type**: Single tier (all users have same access level)
- **Future**: B2B accounts with different features/pricing

#### Freemium Model (Recommendation)
- Users can input vehicle details and see a **preview/summary** of valuation
- Full detailed report requires payment
- This allows users to:
  - Validate the platform provides value before paying
  - Reduces purchase friction
  - Tests conversion rate assumption

---

## 3. Critical Assumptions to Test

### Assumption 1: User Willingness to Pay
- **Hypothesis**: Users will pay for a comprehensive vehicle valuation report
- **Test Method**: Track conversion rate from preview to paid report
- **Success Metric**: TBD (to be defined based on monetization strategy)

### Assumption 2: Data Accuracy & Availability
- **Hypothesis**: Available data sources can provide accurate, defensible valuations
- **Test Method**: Compare valuations against known market data; user feedback on accuracy
- **Success Metric**: <10% variance from market comparables; >80% user satisfaction

---

## 4. Data Sources (Reference)

Based on available research, MVP will prioritize:

**Tier 1 - Freemium/Low-Cost Options**:
- VinAudit API (~$0.02/call, B2C commercial OK)
- Auto.dev Listings API (1,000 free calls/month, then $0.002/call)
- CarsXE API (freemium, commercial permitted low volume)
- Vehicle Databases API (freemium tier available)

**Tier 2 - Premium Options** (if budget allows):
- NADAguides API (B2C attribution required)
- Marketcheck API (freemium tier)

**Not Recommended for MVP**:
- KBB, Edmunds (expensive enterprise licensing)
- Web scrapers (ToS violations, unreliable)

*(Full data source analysis in VV Data sources - Sheet1.csv)*

---

## 5. Monetization Strategy

**Status**: TBD - Must remain flexible

**Options Under Consideration**:
1. Pay-per-report (one-time fee)
2. Subscription (monthly/annual with N reports)
3. Freemium + credits (free preview, pay for detailed reports)
4. Tiered pricing (basic/standard/premium reports)

**MVP Approach**:
- Build flexible payment architecture to test multiple models
- Start with pay-per-report to validate willingness to pay
- Iterate based on user feedback and conversion data

---

## 6. Technical Stack (Preliminary)

**Platform**: Web-first (mobile-responsive)
**Budget**: MVP on minimal budget
**Stack Recommendations**: *(To be defined in technical specifications phase)*

---

## 7. User Flow Stages (Complete)

- [x] **Stage 1**: Authentication & Onboarding
- [x] **Stage 2**: Vehicle Information Input
- [x] **Stage 3**: Accident/Total Loss Details Capture
- [x] **Stage 4**: Valuation Report Generation & Display
- [x] **Stage 5**: Payment & Full Report Access
- [x] **Stage 6**: Dashboard & Report Management

---

## 8. Complete User Flow Details

### Stage 2: Vehicle Information Input ✓

**Approach**: Hybrid VIN + Manual Entry
- **Primary**: VIN entry with auto-population via VinAudit API
- **Fallback**: Manual year/make/model/trim dropdown selection

**Required Fields**:
- VIN (with manual fallback option)
- Year
- Make
- Model
- Trim level
- Current mileage
- ZIP code (essential for regional pricing)

**Optional Fields**:
- Pre-accident condition (excellent/good/fair/poor)
- Previous accident history
- Exterior color

**Not in MVP**:
- Photo uploads
- Modifications/upgrades tracking
- Service history
- Number of previous owners

---

### Stage 3: Accident/Total Loss Details ✓

**User Context**:
- Vehicle may or may not be declared total loss yet
- Collision shop may indicate it's "borderline"
- Owner wants independent valuation to understand carrier expectations
- Owner may want to dispute carrier's valuation

**Required Fields**:
- Accident date
- Vehicle current status:
  - Declared total loss by insurance
  - Not yet determined
  - Repair shop says borderline
  - Other

**Optional Fields**:
- ACV report upload (PDF) - helps understand carrier's methodology
- Carrier's settlement offer amount (if received)
- Additional notes/context

**Vehicle Ownership Status** (impacts settlement expectations):
- Own outright
- Financed (may owe more than value)
- Leased
- GAP insurance coverage (yes/no)

**Not in MVP**:
- Insurance company details
- Adjuster contact information
- Salvage value calculation (future feature)
- Detailed damage assessment

---

### Stage 4: Valuation Report Output ✓

**Core Value Proposition**: Independent, data-backed vehicle valuation with transparent methodology and comparable vehicles to justify the valuation.

**Report Structure**:

1. **Legal Disclaimer**
   - No legal or financial advice
   - Clear positioning as independent valuation tool

2. **Executive Summary**
   - Market value range (e.g., "$27,500 - $30,000")
   - Comparison to carrier offer (if provided)
   - Key highlights

3. **Your Vehicle**
   - Full specifications
   - Mileage, condition, location
   - Key features

4. **Market Value Analysis**
   - Algorithm-based valuation range
   - Confidence interval
   - Regional market context

5. **Comparable Vehicles** (5 vehicles)
   - Year/Make/Model/Trim
   - Mileage (with delta vs. user's vehicle)
   - Key features (sunroof, leather, navigation, etc.)
   - List price
   - Location/distance from user
   - **Comparison Notes**: Explain price differences
     - Example: "This vehicle has a sunroof and clean title, which your vehicle lacks, explaining the $1,000 premium"
     - Example: "Lower mileage (15k vs. your 45k) accounts for $3,500 higher price"

6. **Data Sources**
   - List all APIs/sources used (VinAudit, Auto.dev, CarsXE, etc.)
   - Data retrieval timestamp
   - **No weighting shown** - present data sources equally

7. **Methodology**
   - Transparent algorithm explanation
   - Adjustment factors (mileage, condition, features)
   - How final range was calculated

8. **Next Steps**
   - Neutral guidance on using the report
   - **"Get Expert Legal Advice"** CTA (lawyer lead gen)

**Valuation Methodology**:
- Algorithm-based calculation
- Consider: mileage variance, condition, location, features, market comparables
- Present as range with confidence interval
- Adjust for pre-accident condition based on comparable vehicle data
- Equal treatment of all data sources (no weighted averaging in MVP)

**Report Formats**:
- Web view (immediate online access)
- PDF download (professional, printable for insurance adjuster meetings)
- Email PDF copy to user

---

### Stage 5: Payment & Report Access ✓

**Monetization Model**: Pay-per-report with money-back guarantee

**Free Preview** (Before Payment):
- Vehicle details confirmed
- Estimated value range (e.g., "$27,500 - $30,000")
- 2-3 comparable vehicles (limited preview)
- Full report sections visible but **greyed out/blurred**
- Clear CTA: "Unlock Full Report - $XX"

**Payment Strategy**:
- **A/B Testing**: Test $29 vs $49 price points in phases
  - Week 1-2: $29 pricing
  - Week 3-4: $49 pricing
  - Compare conversion rates
- **Early Bird Discount**: Optional discount for MVP testers (e.g., 20% off)
- **Payment Required BEFORE Data Retrieval**: User pays first, then APIs are called and full report generated

**Payment Processing**:
- **Stripe Checkout** (hosted payment page)
- Immediate access upon successful payment
- Failed payments: Save report in "pending payment" status, email user to complete

**Report Access** (After Payment):
- Immediate web view
- Auto-download PDF
- Email PDF copy to user
- Saved to user's account dashboard (lifetime access)

**Money-Back Guarantee** (Key Differentiator):
- **Condition**: If user doesn't settle for more than (carrier offer + report cost)
- **Requirement**: Must submit ACV report from carrier + final settlement documentation
- **VIN Validation**: Settlement must be for same VIN as original report
- **Availability**: Individual reports only (not bulk/subscription)
- **Rationale**: Proves confidence in data accuracy and value
- **Marketing**: "Get at least the cost of this report back in your settlement, or we refund you"

**Not Available for Refund**:
- Cannot refund just because user doesn't like the valuation (they already have the data)
- Bulk/subscription reports (future feature)

---

### Stage 6: Dashboard & Report Management ✓

**Dashboard Features** (`/dashboard`):
- List of all user's reports
  - Display: Vehicle (year/make/model), Date created, Status, Actions
- Actions per report:
  - View Report (web)
  - Download PDF
  - Request Refund (if eligible - individual paid reports only)
- **"Create New Report"** button
- **"Get Expert Legal Advice"** CTA (lawyer lead gen - prominent placement)
- Account settings link

**Multiple Reports**:
- **MVP**: One report = one payment ($29 or $49)
- **Future**: Bulk packages and subscriptions
  - Bulk: 5 or 10 reports at discounted rate
  - Subscription: Monthly plan with X reports/month maximum

**Refund Request Process** (`/reports/{id}/refund`):
- Upload ACV report (required, PDF)
- Upload final settlement letter (required, PDF)
- VIN validation: Must match original report VIN
- Enter carrier offer amount
- Enter final settlement amount
- User explanation (why requesting refund)
- Submit for manual review
- Admin reviews and processes via Stripe Dashboard

**Account Settings** (`/settings`):
- Update email, name, company
- Change password
- Delete account (with data deletion confirmation)

**Data Retention & Privacy**:
- Reports stored indefinitely (user can access anytime)
- Follow GDPR/CCPA best practices
- Users can delete individual reports
- Users can delete entire account (removes all data)

**Not in MVP**:
- Report updates/re-runs
- Public sharing links
- Email report directly to adjuster
- Bulk purchasing
- Subscription plans

---

## 9. Technical Specifications

### Technology Stack

**Frontend**:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components

**Backend**:
- Next.js API Routes (serverless functions)
- TypeScript/Node.js

**Database & Authentication**:
- PostgreSQL (via Supabase)
- Supabase Auth (email/password)
- Supabase Storage (file uploads)

**Payment & Analytics**:
- Stripe Checkout & webhooks
- Google Analytics 4
- Custom event tracking

**External APIs**:
- VinAudit API (~$0.02/call) - VIN decode + market value
- Auto.dev Listings API (1000 free/month, then $0.002/call) - Comparables
- CarsXE API (freemium) - Supplemental market data

**Utilities**:
- @react-pdf/renderer (PDF generation)
- Axios/fetch (API calls)
- Upstash Redis (optional caching)

**Hosting**:
- Vercel (free tier for MVP, $20/month Pro for commercial use)
- Serverless edge functions
- Automatic deployments via Git

---

### Database Schema (Core Tables)

**users** (managed by Supabase Auth)
- id, email, password_hash, name, company, created_at, updated_at

**reports**
- id, user_id, vin, vehicle_data (JSON), accident_details (JSON), valuation_result (JSON), status, price_paid, stripe_payment_id, pdf_url, data_retrieval_status, created_at, updated_at

**payments**
- id, report_id, user_id, stripe_payment_id, amount, status, created_at

**refund_requests**
- id, report_id, user_id, acv_report_url, settlement_report_url, carrier_offer_amount, final_settlement_amount, status, admin_notes, created_at

**api_call_logs** (cost tracking)
- id, report_id, api_provider, endpoint, cost, success, response_time_ms, created_at

---

### API Integration Strategy

**Data Retrieval Flow**:
1. User submits vehicle info → VIN decode (VinAudit)
2. User pays → Trigger full data retrieval
3. Parallel API calls:
   - VinAudit: Market value estimate
   - Auto.dev: 5-7 comparable vehicles (50-mile radius)
   - CarsXE: Supplemental market data
4. Algorithm processes data → valuation range
5. Generate comparison notes for each comparable
6. Store results in database
7. Generate PDF + web view
8. Email PDF to user

**Error Handling & Failover**:
- If one API fails: Generate report with remaining sources, mark as "partial data"
- Schedule background retry for failed APIs
- Update report when complete data available
- Notify user via email
- If all APIs fail: Refund user, log critical error

**Cost Per Report** (estimated):
- VinAudit: $0.02
- Auto.dev: $0.002 (after free tier)
- CarsXE: Free tier or ~$0.01
- **Total API cost: ~$0.03-$0.05 per report**

**Profit Margin** (at $29/report):
- Revenue: $29
- Stripe fee: $1.14 (2.9% + $0.30)
- API costs: ~$0.05
- **Profit: ~$27.81 per report (96% margin)**

---

### Valuation Algorithm (MVP)

**Simplified Algorithm**:
```
1. Get base values from all data sources
2. Calculate median base value
3. Adjust for mileage:
   - If mileage < average comparable: +$X per 1000 miles under
   - If mileage > average comparable: -$X per 1000 miles over
4. Adjust for condition:
   - Excellent: +10%
   - Good: 0% (baseline)
   - Fair: -10%
   - Poor: -20%
5. Adjust for features (based on comparable vehicle deltas)
6. Calculate confidence range (±10% of median)
7. Final output: {low: $X, high: $Y}
```

**Transparency**:
- Show all data sources used
- Explain each adjustment factor
- Display comparable vehicle feature/price deltas
- Make methodology understandable to non-technical users

---

### Analytics & Metrics Tracking

**Google Analytics 4 Events**:
- User journey: registration, login, logout
- Report creation: started, preview viewed, checkout initiated, payment succeeded/failed, report generated, PDF downloaded
- Engagement: comparable clicked, legal advice CTA clicked, refund requested
- Conversions: purchase, refund

**Key Metrics**:
- Conversion rate: preview → payment (Target: >5% at $29, >3% at $49)
- Revenue per user
- API cost per report
- Profit margin per report
- Refund rate (Target: <10%)
- User satisfaction (Target: >80% positive feedback)

---

## 10. Implementation Phases

### Phase 1: Project Setup (Week 1)
- Initialize Next.js + TypeScript
- Set up Supabase project & database
- Configure Tailwind CSS + shadcn/ui
- Set up environment variables
- Deploy skeleton to Vercel

### Phase 2: Authentication (Week 1)
- Implement Supabase Auth
- Build login/register/password reset flows
- Add protected route middleware

### Phase 3: Vehicle Input & VIN Decode (Week 2)
- Build vehicle info form
- Integrate VinAudit API
- Add manual fallback
- Form validation

### Phase 4: Accident Details & Preview (Week 2)
- Build accident details form
- File upload integration
- Generate preview valuation
- Build preview page with paywall

### Phase 5: Payment Integration (Week 3)
- Set up Stripe Checkout
- Build webhook handler
- Test payment flows

### Phase 6: Full Valuation & Report (Week 3-4)
- Integrate Auto.dev & CarsXE APIs
- Build valuation algorithm
- Generate comparison notes
- Build full report view (web + PDF)
- Email confirmation

### Phase 7: Dashboard & Settings (Week 4)
- Build user dashboard
- Report list & actions
- Account settings
- Account deletion

### Phase 8: Refund System (Week 5)
- Refund request form
- File uploads & validation
- Admin review interface
- Manual Stripe refund processing

### Phase 9: Analytics & Testing (Week 5)
- Integrate Google Analytics 4
- Add event tracking
- End-to-end testing
- Bug fixes & UI polish

### Phase 10: Launch Prep (Week 6)
- Legal disclaimer (consult lawyer)
- Privacy policy & terms of service
- Custom domain setup
- Security review
- Soft launch to beta testers

---

## 11. Success Metrics (First 3 Months)

1. **User Acquisition**: 100+ registered users
2. **Paid Reports**: 50+ reports purchased
3. **Conversion Rate**: >5% preview → purchase
4. **Revenue**: $1,000+ total
5. **API Costs**: <20% of revenue
6. **Refund Rate**: <10% of paid reports
7. **User Satisfaction**: >80% positive feedback

---

## 12. Budget Estimate

**Monthly Fixed Costs**:
- Vercel Pro (commercial use): $20
- Supabase (free tier initially): $0
- Domain: ~$1
- **Total: ~$21/month**

**Variable Costs**:
- Stripe: 2.9% + $0.30 per transaction
- APIs: ~$0.03-$0.05 per report
- **Break-even**: ~1 report/month

---

## Next Steps

1. Review and approve PRD + implementation plan
2. Set up required accounts (Supabase, Stripe, Vercel, API providers)
3. Begin Phase 1: Project Setup
4. Iterate based on feedback and testing

---

**Document Status**: Complete - Ready for Implementation
**Next Action**: User approval to proceed with development
