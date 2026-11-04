# Velan stage consistency fix

Base: upstream c123e5e5d939d65d7bbb8e1d46545dc11762a8f9.
Branch: velan/stage-consistency.

PipelinePage now uses useFunnelConfig stages for board columns, labels, colors, order, branch styling and the New Lead stage selector. The backend board endpoint and Table already use configured stages. Funnel shows ordered progression stages and configured branch stages (Lost) separately.

Tests: 7 sales component/funnel tests passed; targeted ESLint passed; production Vite build passed. Regression tests cover custom/empty Sanctioned stage, live rename/reorder, stage selection and drag/drop key routing.

Deployment: frontend only. Image forgegrowth-velan-web:stage-config-20261104 is pinned in /home/dino/forgegrowth/compose.proxy.yml with pull_policy: never. Original image retained as forgegrowth-velan-web:upstream-c123e5e. No backend/database change.

Build: build frontend with locked dependencies, then docker build -t forgegrowth-velan-web:stage-config-20261104 -f deploy/velan-web.Dockerfile frontend/dist. Dockerfile overlays assets onto the previously deployed image to preserve nginx/proxy configuration.

Rollback: restore /home/dino/forgegrowth/compose.proxy.before-stage-fix.yml over compose.proxy.yml, then run docker compose up -d --no-deps --pull never web in /home/dino/forgegrowth. The original upstream image remains cached.

Updates: fetch upstream, merge/rebase the branch or cherry-pick the fix onto the desired release, run tests/build, then update the pinned web image. The current compose override intentionally prevents an upstream image pull from silently discarding this fix.
