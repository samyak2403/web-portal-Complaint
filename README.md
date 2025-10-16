# Admin Web Portal (static)

This is a lightweight web portal to manage Admins and Complaints backed by Firebase Realtime Database.

Features
- Email/password login (requires the user to be an Approved + active admin in RTDB under admins/{uid})
- Admins view: totals + filter by status (All, Pending, Approved, Rejected), search, approve/reject/activate/deactivate actions
- Complaints view: filter by status, search, update status/priority/admin response

Setup
1) Create a Firebase Web App in the Firebase Console and copy the web config.
2) Open web-portal/app.js and replace the placeholders:
   - {{FIREBASE_API_KEY}}, {{FIREBASE_AUTH_DOMAIN}}, {{FIREBASE_DATABASE_URL}}, {{FIREBASE_PROJECT_ID}}, {{FIREBASE_STORAGE_BUCKET}}, {{FIREBASE_MESSAGING_SENDER_ID}}, {{FIREBASE_APP_ID}}
3) Ensure your Realtime Database contains:
   - admins/{uid} objects with fields: status (Pending/Approved/Rejected), isActive (bool), registrationTimestamp, approvalTimestamp, approvedBy
   - complaints/{id} objects compatible with the mobile app (status, priority, adminResponse, timestamps)
4) Open web-portal/index.html in a browser (no build step needed).

Security rules (recommendation)
- Restrict read/write to authenticated users with admins/{uid}.status == "Approved" and isActive == true.
- Validate allowed status/priority values in rules.

