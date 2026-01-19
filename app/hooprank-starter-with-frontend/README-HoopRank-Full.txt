HoopRank — Full Starter + Updated Frontend

This package contains the original starter plus the updated amateur-only frontend (with profile onboarding and 1–5 HoopRank).

Quickstart (Windows PowerShell):
1) cd to this folder after extracting:
   cd "<EXTRACTED_PATH>\hooprank-starter-with-frontend\hooprank-frontend"

2) Install and run:
   npm install
   npm run dev
   # open http://localhost:5173

Notes:
- The dev server is configured with strictPort:5173. If 5173 is in use, stop the other server or change the port in vite.config.ts.
- Mock data are all amateur players; no NBA/WNBA names remain.
- First-time login redirects to /profile/setup to capture Age/ZIP/Height/Position.
