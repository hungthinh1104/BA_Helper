# BA Helper: Public Preview Smoke Test

After deploying BA Helper to a public preview environment (e.g., Vercel + Render), follow this checklist to ensure the deployment is healthy and secure.

## 1. Security Gate Validation
- [ ] Visit the deployed Vercel URL.
- [ ] Verify that a browser authentication prompt appears (HTTP Basic Auth).
- [ ] Attempt to login with incorrect credentials. Verify access is denied.
- [ ] Login with the configured `PREVIEW_USERNAME` and `PREVIEW_PASSWORD`.
- [ ] Verify the application loads correctly after successful authentication.

## 2. API Health Validation
- [ ] Ensure the login page shows the "Bypass Login (Dev Mode)" button.
- [ ] Click the bypass button. Verify you are immediately logged in as an Admin.
- [ ] *If this step fails, the API URL is likely misconfigured in Vercel (`NEXT_PUBLIC_API_URL`) or CORS is misconfigured in Render (`CORS_ALLOWED_ORIGINS`).*

## 3. Seeded Data Validation
- [ ] Open the project selector dropdown in the top-left corner.
- [ ] Verify the **BA Helper Demo: Booking Cancellation** project exists.
- [ ] Select the project.
- [ ] Verify that two analyses are visible: one in `WAITING_FOR_REVIEW` and one `COMPLETED`.

## 4. Feature Validation
- [ ] Open the `WAITING_FOR_REVIEW` analysis.
- [ ] Click an impacted artifact and verify the Evidence Inspector opens successfully and renders the code excerpt.
- [ ] Navigate back to the analysis list and open the `COMPLETED` analysis.
- [ ] Open the **Final Review Gate**.
- [ ] Click **View Final Reviewed Report**. Verify the markdown renders properly.
- [ ] Click **Download .md**. Verify the file downloads to your local machine correctly.

## 5. Boot Guard Validation (Backend logs)
- [ ] Check your backend hosting provider's logs (e.g., Render/Railway logs).
- [ ] Verify there are no errors about `BOOT GUARD`.
- [ ] *(Optional but recommended)*: Temporarily inject `OPENAI_API_KEY=test` into your backend environment variables and restart. Verify the application **crashes** with a Boot Guard error, preventing accidental LLM usage. Remove the variable to restore service.
