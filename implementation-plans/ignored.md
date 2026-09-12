- [ ] **25 — Public API**
      Read-only API exposing dashboard and case-detail data
      (`apps/web/src/lib/dashboard-data.ts`, `case-detail-data.ts`) for
      customers wiring their own BI tools or internal dashboards to it.
      API-key auth, not OAuth — this is machine-to-machine, not a new user
      surface.
- [ ] **26 — SSO/SAML**
      Enterprise auth requirement once deals need it. Layers onto the
      existing minimal email/OAuth auth (step 1) rather than replacing it;
      Phase 10 explicitly kept auth minimal for v1, so this only gets built
      when a specific deal is blocked on it.
