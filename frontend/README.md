# CampusPulse frontend

React + Vite frontend for the deployed CampusPulse API.

## Run locally

```sh
npm install
npm run dev
```

The API URL defaults to `https://gnu-d7vm.onrender.com`. To override it, copy
`.env.example` to `.env` and set `VITE_API_URL` before starting/building.

## Deploy to Vercel

- Import the repository into Vercel and set the project root to `frontend`.
- Vercel detects Vite; the build command is `npm run build` and output directory is `dist` (also set in `vercel.json`).
- Add `VITE_API_URL` in Vercel's project environment variables, for Production and Preview, with the deployed backend's base URL (for example, `https://gnu-d7vm.onrender.com`). Do not include a trailing slash.
- Redeploy after changing the variable; Vite embeds it into the frontend during the build.

No authentication is included. Enter a database user ID in the header to
create a registration and view registrations for that ID. The API currently
allows cross-origin requests with `Access-Control-Allow-Origin: *`.
