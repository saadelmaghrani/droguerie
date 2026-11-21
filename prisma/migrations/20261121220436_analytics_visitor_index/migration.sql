-- CreateIndex
CREATE INDEX "analytics_events_visitor_hash_created_at_idx" ON "analytics_events"("visitor_hash", "created_at");
