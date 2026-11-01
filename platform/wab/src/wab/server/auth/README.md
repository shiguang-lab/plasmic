# auth

Plasmic authentication uses [Passport](https://www.passportjs.org/) to handle
multiple strategies for signing in, such as password, Google, Okta, etc.

## Studio API identity and permissions

The Shiguang identity middleware verifies `X-SG-Identity` when present. A request
without that identity can continue to public resources and token-authorized APIs.
Missing identity is rejected when a protected operation actually requires it:

- `401 UnauthorizedError`: no user identity for a protected project, organization,
  workspace, account, admin or data-source operation.
- `403 ForbiddenError`: a signed-in caller lacks access, has the wrong actor type,
  or is denied by a feature/publishing policy. Explicit project/CMS token permission
  failures also retain their token-specific 403 responses.
- Public/unowned-project grants and valid project/CMS token grants are evaluated
  before an anonymous resource access is rejected. Public startup endpoints can
  continue returning their anonymous responses.

These rules live in DbMgr's common identity and resource checks, plus the HTTP
admin guard. Comment, project/revision, library code/model, organization/workspace
and presentation/publication handlers propagate these errors. The presentation
handler does not translate permission errors based on whether `req.user` exists.
WebSocket project checks treat unauthorized access as a denied subscription/event
and disconnect the socket without sending protected events.

Comment-author privileges require a nonempty author ID matching the normal user,
or a superuser. Anonymous and team-token actors do not qualify as authors, and a
missing author does not match any user. Resolve/delete operations for non-authors
continue through project permissions; editing a comment requires user identity
and the author/superuser check.

Desktop handles Studio API 401 responses through its existing session recovery:
it confirms expiry with `/api/auth/session`, attempts device-session restoration,
then opens sign-in if necessary. Concurrent failures share recovery. A 403,
network failure or unconfirmed expiry does not initiate this flow. Web error
presentation distinguishes the sign-in-required 401 message from permission 403.

Regression coverage: `db/permission-checks.test.ts`,
`routes/authentication-status.test.ts`, `routes/projects-socket-permissions.test.ts`,
`routes/util.test.ts`, and `desktop/tests/session-recovery.test.cjs`.

## Google

To set up Google sign-in for local development, follow these instructions:

1. Sign in to https://console.cloud.google.com/.
2. Create a separate project for Plasmic development.
3. Go to the Credentials page and create a new "Oauth client ID".
4. Fill in the following fields:
   - Application type: Web application
   - Name: App name, e.g. "Plasmic Dev (my_username)"
   - Authorized JavaScript origins: http://localhost:3003
   - Authorized redirect URIs: http://localhost:3003/api/v1/oauth2/google/callback
5. Copy the "Client ID" and "Client secret", and paste them into your
   secrets.json file ([docs about secrets](/platform/wab/src/wab/server/secrets.ts).
   ```json
   {
     "google": {
       "clientId": "copy from Google",
       "clientSecret": "copy from Google"
     }
   }
   ```

Now go to http://localhost:3003/login and sign in with Google!

## Okta

We have a shared Okta dev instance at https://dev-2205008.okta.com/.

In Bitwarden, you'll find 3 accounts that you can use:

- Admin user: for configuring the Okta dev instance
- Test user: for manual testing and development
- Test user for CI/CD: for automated testing

To set up Okta SSO for local development, follow these instructions:

1. Go to the [Plasmic Generic SSO Test app](https://dev-2205008-admin.okta.com/admin/app/oidc_client/instance/0oa7xfuoxgo9Jsfu45d7/).
2. Sign in as the admin user (credentials in Bitwarden).
   You should see a client ID and client secret, which you'll need later.
3. Go to http://localhost:3003/admin/teams.
4. Lookup a team and open it.
5. Scroll down, open the "Misc" tab, and click "Configure SSO".
6. Fill in the following fields:
   - Domain: dev-2205008.okta.com
   - Provider: Okta
   - Config:
     ```json
     {
       "audience": "https://dev-2205008.okta.com",
       "clientID": "copy from Okta",
       "clientSecret": "copy from Okta"
     }
     ```
7. There should now be a new row in the `sso_config` table.
   Update the `tenantId` to `6RB4POx0y1gr7rCNvTDMMc`.

Now go to http://localhost:3003/sso and use the test user to sign in.
