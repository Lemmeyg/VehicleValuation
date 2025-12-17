# Test Data for Vehicle Valuation SaaS

**Purpose:** Use this test data to verify all features of the application during development and testing.

---

## Table of Contents

1. [Test User Accounts](#test-user-accounts)
2. [Valid VIN Numbers](#valid-vin-numbers)
3. [Invalid VIN Numbers (Error Testing)](#invalid-vin-numbers-error-testing)
4. [Mock Vehicle Data](#mock-vehicle-data)
5. [Test Payment Scenarios](#test-payment-scenarios)
6. [Rate Limiting Test Cases](#rate-limiting-test-cases)
7. [Admin Testing](#admin-testing)

---

## Test User Accounts

### Regular User Account

```
Email: test@example.com
Password: TestPassword123!
Full Name: John Doe
Company: Test Motors Inc.
```

### Second User (for multi-user testing)

```
Email: jane.smith@example.com
Password: TestPassword456!
Full Name: Jane Smith
Company: Smith Auto Group
```

### Admin User Account

```
Email: admin@example.com
Password: AdminPassword123!
Full Name: Admin User
Company: Vehicle Valuation SaaS

⚠️ IMPORTANT: After creating this user in Supabase, set admin flag:
1. Go to Supabase Dashboard → Authentication → Users
2. Find admin@example.com
3. Edit user_metadata
4. Add: { "is_admin": true }
```

---

## Valid VIN Numbers

### VIN Format: 17 characters (letters + numbers, no I, O, Q)

### Test VIN 1 - 2019 Honda Civic

```
VIN: 2HGFC2F59KH123456
Year: 2019
Make: Honda
Model: Civic
Trim: EX
Mileage: 45,000
Body Style: Sedan
Engine: 2.0L 4-Cylinder
Transmission: CVT
Drivetrain: FWD
Fuel Type: Gasoline
Color: Silver
```

### Test VIN 2 - 2020 Toyota Camry

```
VIN: 4T1B11HK1LU123456
Year: 2020
Make: Toyota
Model: Camry
Trim: LE
Mileage: 32,000
Body Style: Sedan
Engine: 2.5L 4-Cylinder
Transmission: Automatic
Drivetrain: FWD
Fuel Type: Gasoline
Color: Blue
```

### Test VIN 3 - 2018 Ford F-150

```
VIN: 1FTEW1EP9JFC12345
Year: 2018
Make: Ford
Model: F-150
Trim: XLT
Mileage: 62,000
Body Style: Pickup Truck
Engine: 3.5L V6 EcoBoost
Transmission: 10-Speed Automatic
Drivetrain: 4WD
Fuel Type: Gasoline
Color: Red
```

### Test VIN 4 - 2021 Tesla Model 3

```
VIN: 5YJ3E1EA5MF123456
Year: 2021
Make: Tesla
Model: Model 3
Trim: Long Range AWD
Mileage: 18,000
Body Style: Sedan
Engine: Electric Dual Motor
Transmission: Single-Speed Direct Drive
Drivetrain: AWD
Fuel Type: Electric
Color: White
```

### Test VIN 5 - 2017 Chevrolet Silverado 1500

```
VIN: 1GCVKREC9HZ123456
Year: 2017
Make: Chevrolet
Model: Silverado 1500
Trim: LT
Mileage: 78,000
Body Style: Pickup Truck
Engine: 5.3L V8
Transmission: 6-Speed Automatic
Drivetrain: 4WD
Fuel Type: Gasoline
Color: Black
```

### Test VIN 6 - 2022 Subaru Outback (High Value)

```
VIN: 4S4BTAFC5N3123456
Year: 2022
Make: Subaru
Model: Outback
Trim: Limited
Mileage: 8,000
Body Style: SUV/Wagon
Engine: 2.5L 4-Cylinder
Transmission: CVT
Drivetrain: AWD
Fuel Type: Gasoline
Color: Gray
```

### Test VIN 7 - 2015 BMW 328i (Luxury)

```
VIN: WBA3B5G59FN123456
Year: 2015
Make: BMW
Model: 328i
Trim: xDrive
Mileage: 95,000
Body Style: Sedan
Engine: 2.0L 4-Cylinder Turbo
Transmission: 8-Speed Automatic
Drivetrain: AWD
Fuel Type: Gasoline
Color: White
```

---

## Invalid VIN Numbers (Error Testing)

### Test Invalid VIN Formats

```
Invalid VIN 1 (Too Short):
VIN: 1HGBH41JXMN12345
Error Expected: "VIN must be exactly 17 characters"

Invalid VIN 2 (Contains Invalid Letter 'I'):
VIN: 1HGBH41JXMNI09876
Error Expected: "VIN contains invalid characters"

Invalid VIN 3 (Contains Invalid Letter 'O'):
VIN: 1HGBH41JXMNO09876
Error Expected: "VIN contains invalid characters"

Invalid VIN 4 (Contains Invalid Letter 'Q'):
VIN: 1HGBH41JXMNQ09876
Error Expected: "VIN contains invalid characters"

Invalid VIN 5 (Too Long):
VIN: 1HGBH41JXMN1098765432
Error Expected: "VIN must be exactly 17 characters"

Invalid VIN 6 (Contains Special Characters):
VIN: 1HGBH41-JXMN10987
Error Expected: "VIN contains invalid characters"

Invalid VIN 7 (Contains Spaces):
VIN: 1HGBH41 JXMN10987
Error Expected: "VIN contains invalid characters"

Invalid VIN 8 (Empty):
VIN:
Error Expected: "VIN is required"

Invalid VIN 9 (Only Numbers):
VIN: 12345678901234567
Error Expected: May pass format validation but fail VIN check digit
```

---

## Mock Vehicle Data

### Expected API Responses for Test VINs

**For VIN: 2HGFC2F59KH123456 (Honda Civic)**

```json
{
  "vehicle_data": {
    "vin": "2HGFC2F59KH123456",
    "year": 2019,
    "make": "Honda",
    "model": "Civic",
    "trim": "EX",
    "body_style": "Sedan",
    "engine": "2.0L 4-Cylinder",
    "transmission": "CVT",
    "drivetrain": "FWD",
    "fuel_type": "Gasoline",
    "mileage": 45000,
    "exterior_color": "Silver",
    "interior_color": "Black"
  },
  "valuation_result": {
    "retail_value": 18500,
    "trade_in_value": 15200,
    "private_party_value": 16800,
    "mileage_adjustment": -500,
    "condition_rating": "Good"
  },
  "accident_details": {
    "accidents": [
      {
        "date": "2021-03-15",
        "severity": "Minor",
        "damage_location": "Front Bumper",
        "airbags_deployed": false,
        "estimate_amount": 2500
      }
    ],
    "total_accidents": 1,
    "structural_damage": false
  }
}
```

**For VIN: 4T1B11HK1LU123456 (Toyota Camry - Clean History)**

```json
{
  "vehicle_data": {
    "vin": "4T1B11HK1LU123456",
    "year": 2020,
    "make": "Toyota",
    "model": "Camry",
    "trim": "LE",
    "mileage": 32000
  },
  "valuation_result": {
    "retail_value": 24500,
    "trade_in_value": 21000,
    "private_party_value": 22800
  },
  "accident_details": {
    "accidents": [],
    "total_accidents": 0,
    "structural_damage": false
  }
}
```

**For VIN: 1FTEW1EP9JFC12345 (Ford F-150 - Multiple Accidents)**

```json
{
  "vehicle_data": {
    "vin": "1FTEW1EP9JFC12345",
    "year": 2018,
    "make": "Ford",
    "model": "F-150",
    "mileage": 62000
  },
  "valuation_result": {
    "retail_value": 32000,
    "trade_in_value": 27500,
    "private_party_value": 29800
  },
  "accident_details": {
    "accidents": [
      {
        "date": "2020-06-10",
        "severity": "Major",
        "damage_location": "Driver Side",
        "airbags_deployed": true,
        "estimate_amount": 12000
      },
      {
        "date": "2022-01-20",
        "severity": "Minor",
        "damage_location": "Rear Bumper",
        "airbags_deployed": false,
        "estimate_amount": 1800
      }
    ],
    "total_accidents": 2,
    "structural_damage": true
  }
}
```

---

## Test Payment Scenarios

### Lemon Squeezy Test Mode

**Test Card Numbers (Lemon Squeezy):**

```
Success Card:
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)

Decline Card:
Card Number: 4000 0000 0000 0002
Expiry: Any future date
CVC: Any 3 digits
Expected: Payment declined

Insufficient Funds:
Card Number: 4000 0000 0000 9995
Expiry: Any future date
CVC: Any 3 digits
Expected: Insufficient funds error
```

### Test Payment Flow

**Basic Report ($29):**

```
1. Login with: test@example.com
2. Enter VIN: 2HGFC2F59KH123456
3. View preview report
4. Click "Select Basic Report ($29)"
5. Complete checkout with test card
6. Verify PDF generated
7. Download from dashboard
```

**Premium Report ($49):**

```
1. Login with: test@example.com
2. Enter VIN: 4T1B11HK1LU123456
3. View preview report
4. Click "Select Premium Report ($49)"
5. Complete checkout with test card
6. Verify PDF generated with accident history
7. Download from dashboard
```

**Payment Failure Test:**

```
1. Login with: test@example.com
2. Enter VIN: 1FTEW1EP9JFC12345
3. Click "Select Basic Report ($29)"
4. Use decline test card: 4000 0000 0000 0002
5. Verify error message displayed
6. Report remains in "draft" status
```

---

## Rate Limiting Test Cases

### Login Rate Limiting (5 attempts/minute)

**Test Case 1: Brute Force Protection**

```
Action: Attempt 6 logins in 1 minute
Email: test@example.com
Password: WrongPassword123!

Expected Result:
- Attempts 1-5: "Invalid email or password" (401)
- Attempt 6: "Too many login attempts. Please try again in a minute." (429)

Verification:
- Wait 61 seconds
- Attempt 7: Should work (back to normal 401 for wrong password)
```

### Signup Rate Limiting (3 attempts/minute)

**Test Case 2: Spam Prevention**

```
Action: Attempt 4 signups in 1 minute
Emails: spam1@test.com, spam2@test.com, spam3@test.com, spam4@test.com

Expected Result:
- Attempts 1-3: Normal signup flow
- Attempt 4: "Too many signup attempts. Please try again in a minute." (429)
```

### Report Creation Rate Limiting (10 reports/hour)

**Test Case 3: API Abuse Prevention**

```
Action: Create 11 reports in 1 hour (same user)
VINs: Use different valid VINs from above

Expected Result:
- Reports 1-10: Successfully created
- Report 11: "Too many reports created. Please try again in an hour." (429)

Verification:
- Wait 61 minutes
- Report 12: Should work normally
```

---

## Admin Testing

### Admin Dashboard Access

**Test Case 1: Admin Access (Authorized)**

```
Login: admin@example.com
Password: AdminPassword123!
Navigate to: /admin

Expected Result:
- Access granted
- Dashboard displays metrics:
  - Total users
  - Total reports
  - Total revenue
  - Reports by type (Basic vs Premium)
```

**Test Case 2: Admin Access (Unauthorized)**

```
Login: test@example.com (regular user)
Password: TestPassword123!
Navigate to: /admin

Expected Result:
- Redirected to /dashboard
- Error message: "Unauthorized access"
```

### Admin Features to Test

**1. View All Reports**

```
Navigate to: /admin/reports
Expected: List of all reports from all users
Verify: Can filter by status, date, report type
```

**2. View Payment History**

```
Navigate to: /admin/payments
Expected: List of all payments with amounts and statuses
Verify: Total revenue calculation is correct
```

**3. User Analytics**

```
Navigate to: /admin/users
Expected: List of all users with stats
Verify: Report count per user is accurate
```

**4. Manual PDF Generation**

```
Navigate to: /admin/reports
Select: Any completed report
Action: Click "Regenerate PDF"
Expected: PDF regenerated successfully
```

---

## Testing Checklist

### Authentication Flow

- [ ] Signup with valid email/password
- [ ] Login with correct credentials
- [ ] Login with incorrect password (error message)
- [ ] Logout successfully
- [ ] Session persists on page refresh
- [ ] Protected routes redirect to login
- [ ] Rate limiting prevents brute force (6 login attempts)

### VIN Validation

- [ ] Valid 17-character VIN accepted
- [ ] VIN with invalid characters rejected
- [ ] VIN too short rejected
- [ ] VIN too long rejected
- [ ] Empty VIN rejected
- [ ] VIN sanitization (spaces removed)

### Report Creation

- [ ] Create report with valid VIN
- [ ] View report preview
- [ ] Mock vehicle data displayed correctly
- [ ] Accident history shown (if applicable)
- [ ] Market valuation displayed
- [ ] Can create 10 reports/hour (rate limit test)
- [ ] 11th report blocked with 429 error

### Payment Processing

- [ ] Basic report checkout ($29)
- [ ] Premium report checkout ($49)
- [ ] Successful payment creates payment record
- [ ] PDF generated after payment
- [ ] Payment webhook handled correctly
- [ ] Failed payment handled gracefully
- [ ] Can't purchase same report twice

### PDF Generation

- [ ] Basic report PDF includes all sections
- [ ] Premium report PDF includes accident history
- [ ] PDF download link works
- [ ] PDF stored in Supabase Storage
- [ ] PDF accessible from dashboard
- [ ] Manual PDF regeneration works (admin)

### Admin Dashboard

- [ ] Admin user can access /admin
- [ ] Regular user redirected from /admin
- [ ] Metrics displayed correctly
- [ ] View all reports (all users)
- [ ] View all payments
- [ ] Filter reports by status/date
- [ ] User analytics accurate
- [ ] Manual PDF regeneration works

### Security Features

- [ ] Security headers present (check DevTools)
- [ ] Rate limiting works on login (5/min)
- [ ] Rate limiting works on signup (3/min)
- [ ] Rate limiting works on reports (10/hour)
- [ ] HTTPS enforced (production)
- [ ] XSS protection active
- [ ] Clickjacking protection (X-Frame-Options)
- [ ] Admin-only routes protected

### Error Handling

- [ ] Invalid VIN shows user-friendly error
- [ ] Network errors handled gracefully
- [ ] Payment failures show clear message
- [ ] 429 rate limit errors display properly
- [ ] 401 unauthorized redirects to login
- [ ] 500 errors don't leak sensitive info

---

## Environment Variables Required for Testing

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Lemon Squeezy (Test Mode)
LEMONSQUEEZY_API_KEY=your-test-api-key
LEMONSQUEEZY_STORE_ID=your-store-id
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret
NEXT_PUBLIC_LEMONSQUEEZY_BASIC_VARIANT_ID=basic-variant-id
NEXT_PUBLIC_LEMONSQUEEZY_PREMIUM_VARIANT_ID=premium-variant-id

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Quick Test Script

**Run this sequence for comprehensive testing:**

```bash
1. Start dev server: npm run dev
2. Navigate to: http://localhost:3000
3. Create test user: test@example.com / TestPassword123!
4. Create admin user: admin@example.com / AdminPassword123!
   (Set is_admin: true in Supabase user_metadata)
5. Login as test user
6. Create report with VIN: 2HGFC2F59KH123456
7. View preview
8. Click "Select Basic Report ($29)"
9. Complete payment with: 4242 4242 4242 4242
10. Verify PDF generated
11. Download PDF from /dashboard
12. Test rate limiting: Create 11 reports quickly
13. Logout
14. Login as admin
15. Navigate to /admin
16. Verify metrics and all reports visible
17. Test manual PDF regeneration
```

---

## Common Issues & Solutions

**Issue: VIN not validating**

- Check VIN is exactly 17 characters
- Ensure no I, O, Q characters
- Verify no spaces or special characters

**Issue: Payment webhook not working**

- Check Lemon Squeezy webhook secret matches .env
- Verify webhook URL in LS dashboard
- Check webhook signature verification in logs

**Issue: PDF not generating**

- Check Supabase Storage bucket exists: `vehicle-reports`
- Verify public access policy set on bucket
- Check service role key is correct

**Issue: Rate limiting not working**

- Verify lru-cache installed: `npm list lru-cache`
- Check rate limiter imported correctly in routes
- Server restart may be needed

**Issue: Admin access denied**

- Verify user_metadata.is_admin = true in Supabase
- Check admin-auth.ts using supabaseAdmin client
- Clear browser cookies and re-login

---

**Last Updated:** December 11, 2025
**Test Coverage:** Authentication, VIN Validation, Payments, PDFs, Admin, Security, Rate Limiting
