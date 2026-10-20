import type { SimulationRequest, SimulationResponse } from '@consignado/shared';
import type { RequestHandler } from 'express';
import type { SimulationService } from '../../services/simulation.service';

export type Simulator = Pick<SimulationService, 'simulate'>;

export function createSimulationController(
  service: Simulator,
): RequestHandler<Record<string, string>, SimulationResponse, SimulationRequest> {
  return async (request, response) => {
    const result = await service.simulate(request.body, response.locals.requestId);

    response.status(200).json(result);
  };
}
