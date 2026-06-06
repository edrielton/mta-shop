# TODO

- [x] Update `Dockerfile` production stage to copy `mta-admin-panel/panel.html` into the final image so `server/mtaAdminStatic.ts` can find it.

- [ ] (Optional) Add a fallback lookup for `panel.html` inside `server/mtaAdminStatic.ts`.
- [ ] Rebuild Docker image and verify `GET /admin` returns HTML (no startup throw).

