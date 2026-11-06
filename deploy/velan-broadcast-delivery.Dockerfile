FROM forgegrowth-velan-backend:template-import-20261106
COPY backend/src/queue/sendQueue.js /app/src/queue/sendQueue.js
COPY backend/src/queue/deliveryControl.js /app/src/queue/deliveryControl.js
COPY backend/src/routes/webhook.js /app/src/routes/webhook.js
COPY backend/src/services/broadcastDelivery.js /app/src/services/broadcastDelivery.js
COPY backend/src/routes/broadcasts.js /app/src/routes/broadcasts.js
