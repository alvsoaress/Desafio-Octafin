import { simulationRequestSchema } from '@consignado/shared';
import { Router } from 'express';
import { createSimulationController, type Simulator } from '../controllers/simulation.controller';
import { validateBody } from '../middlewares/validate';

export function simulationRoutes(service: Simulator): Router {
  const router = Router();
  router.post(
    '/api/simulations',
    validateBody(simulationRequestSchema),
    createSimulationController(service),
  );
  return router;
}
