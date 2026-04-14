# Phase 5: Frontend Manual Testing Guide

**Test URL**: http://localhost:3000
**Admin Credentials**: username=`admin`, password=`admin123`
**Test User**: username=`testuser`, password=`testpass123`

---

## Pre-Test Setup

1. Open browser (Chrome, Firefox, or Edge recommended)
2. Open DevTools (F12)
3. Go to Console tab to monitor for errors
4. Go to Application → Cookies to view session cookies
5. Navigate to http://localhost:3000

---

## Test Suite 1: Unauthenticated State

### Test 1.1: Initial Page Load
**Steps**:
1. Load http://localhost:3000
2. Observe the page

**Expected Results**:
- ✅ Page loads without errors
- ✅ Header displays "Homestead Tracker" title
- ✅ Header shows "Login" and "Register" buttons (NOT username/logout)
- ✅ Main navigation shows 7 tabs: Design, Calendar, Indoor Garden, Inventory, Tracking, Weather, Winter
- ✅ Loading spinner appears briefly during auth check
- ✅ No console errors in DevTools

**Pass Criteria**: All expected results met

---

### Test 1.2: Tab Protection - Design Tab
**Steps**:
1. Click on "Design" tab (🎨)
2. Observe the content area

**Expected Results**:
- ✅ Tab activates (green highlight)
- ✅ Content area shows "Login Required" message
- ✅ Lock icon (🔒) displayed
- ✅ Message: "Please login or create an account to access this feature."
- ✅ Blue "Login / Register" button displayed
- ✅ NO garden designer content visible
- ✅ NO sub-tabs visible

**Pass Criteria**: Login Required message displays, no actual content

---

### Test 1.3: Tab Protection - All Other Tabs
**Steps**:
Repeat for each tab:
1. Calendar (📅)
2. Indoor Garden (🌱)
3. Inventory (📦)
4. Tracking (📊)
5. Weather (🌤️)
6. Winter (❄️)

**Expected Results** (for EACH tab):
- ✅ Tab activates (green highlight)
- ✅ "Login Required" message displays
- ✅ Lock icon and message consistent across all tabs
- ✅ "Login / Register" button present
- ✅ NO actual content visible

**Pass Criteria**: All 7 tabs show Login Required message

---

## Test Suite 2: Login Flow

### Test 2.1: Open Login Modal
**Steps**:
1. Click "Login" button in header
2. Observe modal

**Expected Results**:
- ✅ Modal appears with dark backdrop
- ✅ Modal title: "Login"
- ✅ Subtitle: "Welcome back! Please login to your account."
- ✅ Username input field (empty)
- ✅ Password input field (empty, masked)
- ✅ "Remember me" checkbox
- ✅ "Login" button (enabled if fields filled)
- ✅ "Cancel" button
- ✅ "Don't have an account? Register here" link at bottom

**Pass Criteria**: Modal displays correctly with all elements

---

### Test 2.2: Modal UX - Escape Key
**Steps**:
1. With login modal open, press Escape key
2. Observe result

**Expected Results**:
- ✅ Modal closes
- ✅ Returns to main page
- ✅ No errors in console

**Pass Criteria**: Escape key closes modal

---

### Test 2.3: Modal UX - Backdrop Click
**Steps**:
1. Click "Login" button to reopen modal
2. Click on dark area outside modal (backdrop)
3. Observe result

**Expected Results**:
- ✅ Modal closes
- ✅ Returns to main page
- ✅ No errors in console

**Pass Criteria**: Backdrop click closes modal

---

### Test 2.4: Login with Wrong Credentials
**Steps**:
1. Open login modal
2. Enter username: `admin`
3. Enter password: `wrongpassword`
4. Click "Login" button
5. Observe result

**Expected Results**:
- ✅ Error message displays in red box
- ✅ Error says "Invalid username or password" (or similar)
- ✅ Modal stays open
- ✅ Form fields remain filled
- ✅ No navigation occurs

**Pass Criteria**: Error message displays, login fails gracefully

---

### Test 2.5: Login with Correct Credentials (Admin)
**Steps**:
1. Clear form if needed
2. Enter username: `admin`
3. Enter password: `admin123`
4. Click "Login" button
5. Observe result

**Expected Results**:
- ✅ "Logging in..." text appears on button (brief)
- ✅ Modal closes automatically
- ✅ Header now shows "admin" username
- ✅ Header shows "Admin" badge (small green text)
- ✅ Header shows "Logout" button
- ✅ Header NO LONGER shows "Login" / "Register" buttons
- ✅ Current tab (Design) now shows actual content
- ✅ No console errors

**Pass Criteria**: Login successful, UI updates correctly

---

## Test Suite 3: Authenticated State

### Test 3.1: Design Tab - Garden Designer
**Steps**:
1. Ensure logged in as admin
2. Click "Design" tab
3. Click "Garden Designer" sub-tab

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Garden Designer interface displays
- ✅ 5 garden beds visible in the list (admin's beds from migration)
- ✅ Beds: "4' x 8' Bed", "4' x 12' Bed", "3' x 6' Bed", etc.
- ✅ Can click on beds to select them
- ✅ Canvas shows bed visualizations

**Pass Criteria**: Full garden designer functionality accessible

---

### Test 3.2: Design Tab - Property Designer
**Steps**:
1. Click "Property Designer" sub-tab
2. Observe content

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Property Designer interface displays
- ✅ Property list shows admin's properties
- ✅ Map or canvas displays

**Pass Criteria**: Full property designer functionality accessible

---

### Test 3.3: Calendar Tab
**Steps**:
1. Click "Calendar" tab (📅)
2. Observe content

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Planting calendar displays
- ✅ Timeline view shows planting events
- ✅ Controls for adding crops, viewing timeline, etc.

**Pass Criteria**: Full calendar functionality accessible

---

### Test 3.4: Indoor Garden Tab
**Steps**:
1. Click "Indoor Garden" tab (🌱)
2. Observe content

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Indoor garden interface displays
- ✅ Seed starting tracking visible

**Pass Criteria**: Indoor garden functionality accessible

---

### Test 3.5: Inventory Tab - Seeds
**Steps**:
1. Click "Inventory" tab (📦)
2. Click "Seed Inventory" sub-tab (should be default)
3. Observe content

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Seed inventory list displays
- ✅ 900+ seed varieties visible (global catalog + admin's seeds)
- ✅ Can search and filter seeds
- ✅ Can view seed details

**Pass Criteria**: Full seed inventory accessible (global + personal)

---

### Test 3.6: Inventory Tab - Livestock
**Steps**:
1. Click "Livestock" sub-tab
2. Observe content

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Livestock management interface displays
- ✅ Can manage chickens, ducks, beehives, etc.

**Pass Criteria**: Full livestock functionality accessible

---

### Test 3.7: Tracking Tab - Harvests
**Steps**:
1. Click "Tracking" tab (📊)
2. Click "Harvests" sub-tab
3. Observe content

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Harvest tracker displays
- ✅ Can view/add harvest records

**Pass Criteria**: Harvest tracking accessible

---

### Test 3.8: Tracking Tab - Compost
**Steps**:
1. Click "Compost" sub-tab
2. Observe content

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Compost tracking interface displays

**Pass Criteria**: Compost tracking accessible

---

### Test 3.9: Tracking Tab - Photos
**Steps**:
1. Click "Photos" sub-tab
2. Observe content

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Photo gallery interface displays

**Pass Criteria**: Photo gallery accessible

---

### Test 3.10: Weather Tab
**Steps**:
1. Click "Weather" tab (🌤️)
2. Observe content

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Weather alerts interface displays
- ✅ Weather information visible (if configured)

**Pass Criteria**: Weather features accessible

---

### Test 3.11: Winter Tab
**Steps**:
1. Click "Winter" tab (❄️)
2. Observe content

**Expected Results**:
- ✅ NO "Login Required" message
- ✅ Winter garden planning interface displays

**Pass Criteria**: Winter planning accessible

---

## Test Suite 4: Session Persistence

### Test 4.1: Browser Refresh
**Steps**:
1. Ensure logged in as admin
2. Note current tab
3. Press F5 or click browser refresh
4. Wait for page to reload
5. Observe state

**Expected Results**:
- ✅ Page reloads successfully
- ✅ Still logged in (header shows "admin" and "Logout")
- ✅ Session persists (no login prompt)
- ✅ Can access all tabs immediately
- ✅ No "Login Required" messages

**Pass Criteria**: Session persists across refresh

---

### Test 4.2: Navigation Between Tabs
**Steps**:
1. Click through all 7 tabs multiple times
2. Observe each tab content

**Expected Results**:
- ✅ All tabs remain accessible
- ✅ No re-login required
- ✅ Content loads correctly for each tab
- ✅ Session remains active

**Pass Criteria**: Session stable across navigation

---

## Test Suite 5: Logout Flow

### Test 5.1: Logout Confirmation
**Steps**:
1. Click "Logout" button in header
2. Observe dialog

**Expected Results**:
- ✅ Browser confirmation dialog appears
- ✅ Message: "Are you sure you want to logout?"
- ✅ "OK" and "Cancel" buttons present

**Pass Criteria**: Confirmation dialog displays

---

### Test 5.2: Cancel Logout
**Steps**:
1. In confirmation dialog, click "Cancel"
2. Observe result

**Expected Results**:
- ✅ Dialog closes
- ✅ Still logged in
- ✅ Header still shows "admin" and "Logout"
- ✅ Content still accessible

**Pass Criteria**: Cancel preserves logged-in state

---

### Test 5.3: Confirm Logout
**Steps**:
1. Click "Logout" button again
2. Click "OK" in confirmation dialog
3. Observe result

**Expected Results**:
- ✅ Dialog closes
- ✅ Logged out successfully
- ✅ Header now shows "Login" and "Register" buttons
- ✅ Header NO LONGER shows username or "Logout"
- ✅ Current tab shows "Login Required" message
- ✅ All tabs now protected (show login required)

**Pass Criteria**: Logout successful, all guards reactivate

---

## Test Suite 6: Registration Flow

### Test 6.1: Open Register Modal
**Steps**:
1. Ensure logged out
2. Click "Register" button in header
3. Observe modal

**Expected Results**:
- ✅ Modal appears with dark backdrop
- ✅ Modal title: "Create Account"
- ✅ Subtitle: "Join Homestead Planner to track your garden!"
- ✅ Username input field (with validation hint)
- ✅ Email input field
- ✅ Password input field (with min length hint)
- ✅ Confirm Password input field
- ✅ "Create Account" button (green)
- ✅ "Cancel" button
- ✅ "Already have an account? Login here" link at bottom

**Pass Criteria**: Register modal displays correctly

---

### Test 6.2: Registration Validation - Short Password
**Steps**:
1. Enter username: `newuser`
2. Enter email: `new@example.com`
3. Enter password: `short` (less than 8 characters)
4. Enter confirm password: `short`
5. Click "Create Account"
6. Observe result

**Expected Results**:
- ✅ Validation error displays
- ✅ Error message: "Password must be at least 8 characters"
- ✅ Form does not submit
- ✅ Modal stays open

**Pass Criteria**: Validation prevents short passwords

---

### Test 6.3: Registration Validation - Password Mismatch
**Steps**:
1. Clear form
2. Enter username: `newuser`
3. Enter email: `new@example.com`
4. Enter password: `password123`
5. Enter confirm password: `different123`
6. Blur from confirm password field
7. Observe result

**Expected Results**:
- ✅ Validation error displays under confirm password
- ✅ Error message: "Passwords do not match"
- ✅ Red border on confirm password field

**Pass Criteria**: Validation catches password mismatch

---

### Test 6.4: Successful Registration
**Steps**:
1. Clear form
2. Enter username: `newuser2`
3. Enter email: `new2@example.com`
4. Enter password: `password123`
5. Enter confirm password: `password123`
6. Click "Create Account"
7. Observe result

**Expected Results**:
- ✅ "Creating Account..." text appears on button (brief)
- ✅ Modal closes automatically
- ✅ Header shows "newuser2" username
- ✅ Header shows "Logout" button
- ✅ NO "Admin" badge (regular user)
- ✅ Automatically logged in after registration
- ✅ Content accessible immediately

**Pass Criteria**: Registration successful, auto-login works

---

## Test Suite 7: Accessibility

### Test 7.1: Keyboard Navigation - Login Modal
**Steps**:
1. Logout if needed
2. Click "Login" button
3. Press Tab key repeatedly
4. Observe focus movement

**Expected Results**:
- ✅ Focus moves through form fields in order:
  - Username input
  - Password input
  - Remember me checkbox
  - Login button
  - Cancel button
  - Register link
- ✅ Visible focus indicator on each element
- ✅ Can submit form with Enter key

**Pass Criteria**: Keyboard navigation works correctly

---

### Test 7.2: Screen Reader Labels (Manual Check)
**Steps**:
1. Inspect modal element in DevTools
2. Check for ARIA attributes

**Expected Results**:
- ✅ Modal has `role="dialog"`
- ✅ Modal has `aria-modal="true"`
- ✅ Modal has `aria-labelledby` pointing to title
- ✅ Form inputs have proper `label` elements
- ✅ Buttons have descriptive text or `aria-label`

**Pass Criteria**: Proper ARIA labels present

---

### Test 7.3: Console Errors Check
**Steps**:
1. Open DevTools Console
2. Perform full login/logout cycle
3. Navigate all tabs
4. Check console

**Expected Results**:
- ✅ NO red error messages
- ✅ NO yellow warning messages (or only minor warnings)
- ✅ NO 401 unauthorized errors
- ✅ NO failed network requests

**Pass Criteria**: Console clean of errors

---

### Test 7.4: Loading Spinner Accessibility
**Steps**:
1. Logout
2. Refresh page
3. Watch for loading spinner during auth check
4. Inspect loading element in DevTools

**Expected Results**:
- ✅ Loading spinner has `role="status"`
- ✅ Loading element has `aria-live="polite"`
- ✅ Spinner animates smoothly (green spinning circle)

**Pass Criteria**: Loading state accessible

---

## Test Summary Checklist

### Unauthenticated State
- [ ] All 7 tabs show Login Required message
- [ ] No actual content accessible
- [ ] Header shows Login/Register buttons

### Login Flow
- [ ] Modal opens correctly
- [ ] Escape key closes modal
- [ ] Backdrop click closes modal
- [ ] Wrong credentials show error
- [ ] Correct credentials log in successfully
- [ ] UI updates correctly after login

### Authenticated State
- [ ] All 7 tabs show actual content
- [ ] Garden Designer shows admin's 5 beds
- [ ] Seed Inventory shows 900+ seeds
- [ ] All features accessible

### Session Persistence
- [ ] Browser refresh maintains login
- [ ] Navigation maintains login

### Logout Flow
- [ ] Confirmation dialog appears
- [ ] Cancel preserves session
- [ ] Confirm logs out successfully
- [ ] All guards reactivate after logout

### Registration Flow
- [ ] Register modal opens correctly
- [ ] Validation works (short password, mismatch)
- [ ] Successful registration auto-logs in

### Accessibility
- [ ] Keyboard navigation works
- [ ] ARIA labels present
- [ ] No console errors
- [ ] Loading spinner accessible

---

## Notes for Tester

- Perform tests in order for best results
- Use Chrome DevTools Console to monitor for errors
- Take screenshots of any failures
- Note any unexpected behavior
- Test in multiple browsers if possible (Chrome, Firefox, Edge)

---

## Expected Test Duration

- Unauthenticated State: 5 minutes
- Login Flow: 10 minutes
- Authenticated State: 15 minutes
- Session Persistence: 3 minutes
- Logout Flow: 5 minutes
- Registration Flow: 10 minutes
- Accessibility: 10 minutes

**Total**: ~60 minutes for comprehensive manual testing
