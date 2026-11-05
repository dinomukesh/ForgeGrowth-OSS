# Preserve the deployed runtime and replace only the reviewed source files.
FROM forgegrowth-velan-backend:before-visibility
COPY backend/src/routes/messages.js /app/src/routes/messages.js
COPY backend/src/routes/leads.js /app/src/routes/leads.js
COPY backend/src/services/followUps.js /app/src/services/followUps.js
