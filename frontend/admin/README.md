# DevConX Admin Frontend

Administrative dashboards for DevConX (e.g., adapter analytics, audit logs) will live in this directory. The admin interface is optional and disabled by default. Teams that need advanced observability can mount a static HTML bundle here and reference it from a custom VS Code command or external deployment.

Guidelines:

- Avoid heavy frameworks; prefer static HTML + progressive enhancement.
- Reuse the neon Alsania colour system defined for the client control panel.
- Authenticate via the MCP proxy rather than embedding credentials in the frontend.

Document any admin assets added to this folder so downstream operators know how to deploy them.
