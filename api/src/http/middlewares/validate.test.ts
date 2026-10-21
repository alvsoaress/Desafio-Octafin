import { simulationRequestSchema, validationMessages } from '@consignado/shared';
import { fictitiousCnpjs, fictitiousCpfs, fictitiousCustomer } from '@consignado/shared/fixtures';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requestId } from './request-id';
import { validateBody } from './validate';

const [cpf] = fictitiousCpfs;
const [cnpj] = fictitiousCnpjs;

const validBody = {
  name: fictitiousCustomer.name,
  email: fictitiousCustomer.email,
  cpf: cpf.masked,
  employerCnpj: cnpj.masked,
  salaryCents: 500000,
  existingDeductionsCents: 50000,
  requestedAmountCents: 1000000,
  termMonths: 24,
};

function createTestApp() {
  const app = express();
  app.use(requestId());
  app.use(express.json());
  app.post('/simulations', validateBody(simulationRequestSchema), (request, response) => {
    response.json({ body: request.body as unknown });
  });
  return app;
}

describe('validateBody', () => {
  it('troca o corpo pelo resultado validado, com o CPF normalizado', async () => {
    const response = await request(createTestApp()).post('/simulations').send(validBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      body: { ...validBody, cpf: cpf.digits, employerCnpj: cnpj.digits },
    });
  });

  it('responde 400 com o erro de cada campo e o requestId', async () => {
    const response = await request(createTestApp())
      .post('/simulations')
      .send({ ...validBody, cpf: '381.927.465-01', foo: 1 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'validation_error',
      fields: { cpf: validationMessages.cpf, foo: validationMessages.unknownField },
      requestId: response.headers['x-request-id'],
    });
  });

  it('responde 400 na chave body quando o corpo não é JSON', async () => {
    const response = await request(createTestApp())
      .post('/simulations')
      .set('Content-Type', 'text/plain')
      .send('cpf=1');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'validation_error',
      fields: { body: expect.any(String) as string },
    });
  });
});
