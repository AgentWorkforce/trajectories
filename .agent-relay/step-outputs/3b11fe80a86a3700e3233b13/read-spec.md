# exports.ts — Hono Route Group for Trail Viewer Server

```typescript
import { Hono } from 'hono';
import { TrajectoryService } from '../trajectory-service';

function createExportRoutes(service: TrajectoryService): Hono {
  const app = new Hono();

  // GET /trajectories/:id/markdown
  app.get('/trajectories/:id/markdown', async (c) => {
    try {
      const id = c.req.param('id');
      const markdown = await service.getTrajectoryMarkdown(id);
      if (markdown === '') {
        return c.text('Trajectory not found', 404);
      }
      return c.text(markdown);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return c.text(message, 500);
    }
  });

  // GET /trajectories/:id/timeline
  app.get('/trajectories/:id/timeline', async (c) => {
    try {
      const id = c.req.param('id');
      const timeline = await service.getTrajectoryTimeline(id);
      if (timeline === '') {
        return c.text('Trajectory not found', 404);
      }
      return c.text(timeline);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return c.text(message, 500);
    }
  });

  // GET /trajectories/:id/json
  app.get('/trajectories/:id/json', async (c) => {
    try {
      const id = c.req.param('id');
      const trajectory = await service.getTrajectory(id);
      if (trajectory === null) {
        return c.json({ error: 'Trajectory not found' }, 404);
      }
      return c.json(trajectory);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return c.json({ error: message }, 500);
    }
  });

  return app;
}

export { createExportRoutes };
export default createExportRoutes;
```
