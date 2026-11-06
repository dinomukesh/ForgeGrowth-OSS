FROM forgegrowth-velan-backend:visibility-20261105
COPY backend/src/routes/templates.js /app/src/routes/templates.js
COPY backend/src/integrations/metaTemplates.js /app/src/integrations/metaTemplates.js
COPY backend/src/services/templateImport.js /app/src/services/templateImport.js
