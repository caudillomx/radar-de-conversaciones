<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

<!-- AGENT-MEMORY:BEGIN -->
- Social URL detection/validation lives in `src/lib/platforms.ts` (tested); reuse it for any ingest path.
- Data lives in Lovable Cloud (studies, sources, comments); all access goes through server functions in `src/lib/listening.functions.ts` using the admin client (no auth yet, tables have no anon/authenticated grants). Client hooks/query keys in `src/lib/listening.ts`.
- Apify: one specialized Actor per platform in `src/lib/apify.server.ts` (gateway). Async extraction polls partial datasets, idempotently inserts new comments and persists actual counts before completion; sequential browser polls avoid overlapping requests. Progress uses configured comment targets, not completed-source counts, so partial collection is visible.
- AI analysis (`src/lib/ai/analysis.server.ts`) runs one synthesis call plus parallel per-comment classification batches on a platform-stratified sample; sentiment/demographics are computed by counting labels, and stats + methodology are stored inside `analyses.result` (shape in `src/lib/analysis-types.ts`). Comment indexes map to stored quotes to prevent invented verbatims.
- User-facing copy never names third-party tools or models (say "motor de extracción/análisis").
- Presentation deck is `/presentacion/$studyId`: 1920x1080 slides scaled on screen, exported via browser print with `@page` size.
- Analysis expiry is shared in `src/lib/analysis-lifecycle.ts`; expire stored attempts and conditionally save only processing rows so late results cannot replace expired attempts or retries. Never abort upstream generation with a timer: it may still be billed.
- Routes: `/` Quick Pulse bar + chooser, `/estudios` deep studies list, `/estudios/$studyId` detail for both kinds (Study.kind quick|deep, missing = deep). Global typography and palette live as tokens in styles.css, with remote fonts loaded from __root head links.
<!-- AGENT-MEMORY:END -->
