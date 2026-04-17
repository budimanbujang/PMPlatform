# Microsoft Entra SSO with group-based access control

Replaces Supabase magic-link auth with JCorp's Entra ID (formerly Azure AD). Only members of a specific security group can sign in.

Architecture: browser → Entra ID login (gated by group membership) → Supabase Auth (receives the OIDC token) → JCorp PMO (Supabase session cookie).

**Estimated time:** 45 minutes.

---

## Prerequisites

- You're a Global Admin, Cloud App Admin, or Application Admin in the JCorp Entra tenant (or can ask one to do the clicks with you)
- The Azure App Service (`bbai`) is running and you can load `/login`
- You already have magic-link auth working (good baseline to compare against)

---

## Step 1 — Create a security group for platform access (5 min)

This is the group whose members are allowed to use the platform.

1. <https://entra.microsoft.com> → sign in with your admin account.
2. **Identity → Groups → All groups → New group**.
3. Fill:
   - **Group type**: Security
   - **Group name**: `JCorp PMO Users`
   - **Group description**: `Members who can sign in to the Digital PMO Platform`
   - **Membership type**: Assigned (explicit — add/remove individuals)
4. **Members** → add yourself (`budiman.bujang@jcorp.com.my`) plus the 20 IRIS Champions when ready.
5. **Create**.

Keep the **Group Object ID** visible — you'll reference it later if you want app-level checks (optional).

---

## Step 2 — Register the app in Entra ID (10 min)

1. Entra → **Identity → Applications → App registrations → New registration**.
2. Fill:
   - **Name**: `JCorp PMO Platform`
   - **Supported account types**: **Accounts in this organizational directory only** (single tenant) — restricts to JCorp employees only.
   - **Redirect URI**:
     - Platform: **Web**
     - URL: `https://<supabase-ref>.supabase.co/auth/v1/callback`
       - Find `<supabase-ref>` in Supabase → Settings → General → Reference ID. It's the part before `.supabase.co`.
3. **Register**.

On the app's Overview page, copy these three values to a notepad — you'll paste them into Supabase next:

| Label on page | Save as |
|---|---|
| **Application (client) ID** | `CLIENT_ID` |
| **Directory (tenant) ID** | `TENANT_ID` |

---

## Step 3 — Create a client secret (3 min)

Still on the app registration page:

1. Left sidebar → **Certificates & secrets → Client secrets → + New client secret**.
2. Description: `Supabase OIDC`.
3. Expires: **24 months** (set a calendar reminder to rotate it).
4. **Add**.
5. **Copy the Value column immediately** — this is the only time Entra shows it. Save as `CLIENT_SECRET`.

> ⚠️ The **Value** is what you need, not the Secret ID. Don't mix them up.

---

## Step 4 — Add API permissions (3 min)

Same app registration:

1. Left sidebar → **API permissions**.
2. Defaults include `User.Read` from Microsoft Graph — that's enough to get email + profile. If it's missing, click **+ Add a permission → Microsoft Graph → Delegated permissions →** tick `openid`, `email`, `profile`, `User.Read` → **Add permissions**.
3. Click **Grant admin consent for <tenant>** (requires Global Admin / App Admin). Status column turns green with "Granted for <tenant>".

---

## Step 5 — Lock access to the group (5 min)

This is the gate that enforces "only people in the JCorp PMO Users group can sign in."

1. Entra → **Identity → Applications → Enterprise applications** (note: *Enterprise*, not *App registrations*).
2. In the search box, find and open **JCorp PMO Platform** (the app you just registered has an Enterprise App twin).
3. Left sidebar → **Properties**:
   - **Enabled for users to sign-in?**: **Yes**
   - **Assignment required?**: **Yes** ← this is the critical one
   - **Visible to users?**: Yes (optional — shows in MyApps portal)
   - **Save** at the top.
4. Left sidebar → **Users and groups → + Add user/group**.
5. Under **Users and groups**, pick `JCorp PMO Users`. Click **Select**.
6. Click **Assign**.

Result: only members of `JCorp PMO Users` can authenticate. Anyone else gets an Entra error page — they never reach the Supabase/app layer.

---

## Step 6 — Configure Supabase to use Entra OIDC (5 min)

Supabase → **Authentication → Providers → Azure** (it's listed under "OAuth providers").

1. Toggle **Azure enabled** to **ON**.
2. Fill:
   - **Azure Client ID**: paste `CLIENT_ID` from Step 2
   - **Azure Client Secret**: paste `CLIENT_SECRET` from Step 3
   - **Azure URL / Tenant URL**: `https://login.microsoftonline.com/<TENANT_ID>/v2.0`
     - Replace `<TENANT_ID>` with the value from Step 2.
3. **Callback URL** (for Supabase reference): shows `https://<ref>.supabase.co/auth/v1/callback` — confirm this matches what you entered in Step 2. Copy-paste it back into your Entra app's redirect URI if there's a typo.
4. **Save**.

Supabase → **Authentication → URL Configuration**:
- **Site URL**: your Azure Web App URL (e.g. `https://bbai-hwhghef9d4g3bbgs.malaysiawest-01.azurewebsites.net`)
- **Redirect URLs** should include:
  - `https://bbai-hwhghef9d4g3bbgs.malaysiawest-01.azurewebsites.net/auth/callback`
  - Optional wildcards for preview URLs

---

## Step 7 — Deploy the updated code (2 min)

The code change (Microsoft Sign-in button replacing Google) is already on the branch. It goes live on your next deploy:

```
Actions → Deploy to Azure App Service → Run workflow
```

Wait for the run to finish (~4 min). Hard refresh your Azure app URL.

---

## Step 8 — Test the flow (3 min)

1. Open the app in a **private / incognito** browser window.
2. You land on `/login` with a single button: **Sign in with JCorp Microsoft account**.
3. Click it.
4. Microsoft sign-in page appears — sign in with `budiman.bujang@jcorp.com.my`.
5. First time only: Microsoft consent page asks you to approve the app's requested permissions → **Accept**.
6. You're redirected back to the app and land on the dashboard.

### Test group gating

1. Remove yourself from the `JCorp PMO Users` group in Entra (Identity → Groups → JCorp PMO Users → Members → remove yourself).
2. Sign out, private window, try to sign in again.
3. You should get an Entra error page: **"AADSTS50105: The signed in user is not assigned to a role for the application JCorp PMO Platform."**
4. Add yourself back to the group. Retry — works again.

---

## Turn off the magic-link fallback in production

Once SSO works, hide the magic-link form so users aren't confused.

Azure Portal → `bbai` Web App → **Configuration → Environment variables** → make sure `NEXT_PUBLIC_ENABLE_MAGIC_LINK` is either **absent** or set to `false`. If you added it earlier, remove or flip it.

> The flag is already set so the magic-link form only shows when `NEXT_PUBLIC_ENABLE_MAGIC_LINK=true`. Default = hidden.

For local development, set `NEXT_PUBLIC_ENABLE_MAGIC_LINK=true` in `.env.local` so you can log in without going through Entra during dev work.

---

## Managing who has access going forward

**To add a new user**:
1. Entra → Identity → Groups → `JCorp PMO Users` → Members → **+ Add members** → pick them → Add.
2. Tell them to visit the app URL and click **Sign in with JCorp Microsoft account**.
3. Their Supabase profile auto-creates on first login, attached to the JCorp org (by email domain).
4. (Optional) Make them a project member: go to **Projects → [project] → Members → Add member** using their email.

**To revoke access**:
1. Entra → Groups → `JCorp PMO Users` → remove them.
2. (Optional but recommended for clean audit) Supabase → Authentication → Users → find them → **⋯ → Delete user**. Also deletes their `profiles` row via cascade.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Microsoft button does nothing | Azure provider not enabled in Supabase | Step 6 |
| "AADSTS700016: Application not found in the tenant" | Wrong tenant in the OIDC URL in Supabase | Step 6 — replace `<TENANT_ID>` |
| "AADSTS50011: reply URL does not match" | Entra redirect URI doesn't match Supabase callback | Step 2 — use the exact Supabase callback URL, no trailing slash |
| "AADSTS50105: user not assigned to a role" | User isn't in `JCorp PMO Users` | Step 5 + Step 1 — add them to the group |
| Sign-in works but you land on `/onboarding` | Profile row missing or has no `organisation_id` | SQL: `update public.profiles set organisation_id = (select id from public.organisations where slug = 'jcorp') where id = auth.uid()` (run as your logged-in user in Supabase SQL Editor with the right JWT, or just run the insert/update SQL from earlier) |
| "Invalid state" error on callback | Supabase Site URL and Azure Redirect URL don't agree | Check both are the Azure Web App URL, no trailing slash |
| Token accepted but app shows "not attached to an organisation" | `handle_new_user` trigger didn't match the email domain | Update `organisations.domain` to `jcorp.com.my` (SQL shown earlier) |

---

## Defence-in-depth (optional)

The group gating in Step 5 blocks non-members at the Entra level. If you want a second layer in the app (e.g. to restrict specific pages to specific Entra groups), you can:

1. Configure the Entra app to emit group claims: **App registration → Token configuration → + Add groups claim → Security groups → ID token**.
2. Supabase forwards group IDs in `raw_user_meta_data.groups`.
3. Read that array in `src/lib/current-user.ts` and gate pages by group membership.

I can wire this in when you decide which pages need fine-grained group rules.
