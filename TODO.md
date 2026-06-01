# TODO

- [ ] Fix duplicate unlock route in `server/routes.ts` and ensure only one handler remains.
- [x] Remove duplicated `POST /api/admin/users/:id/unlock` handler from `server/routes.ts`.
- [x] Fix Express error middleware to avoid `ERR_HTTP_HEADERS_SENT`.
- [x] Fix TypeScript Stripe apiVersion type mismatch in `server/stripeClient.ts`.
- [ ] Continue debugging session cookie refresh/logout + 401 `Not authenticated` (likely cookie domain/secure/sameSite).

- [ ] After fixes, run `npm run check` / `npm run build` and verify runtime behavior.
- [ ] Create a git commit and open a PR.

