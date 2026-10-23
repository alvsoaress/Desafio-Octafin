import { fictitiousCnpjs, fictitiousCpfs } from '@consignado/shared/fixtures';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  ALPHA_MAX_AMOUNT_CENTS,
  ALPHA_MIN_SCORE,
  ALPHA_PARTNER_EMPLOYERS,
  ALPHA_PRIME_SCORE,
  alphaRate,
  createAlphaApp,
} from './alpha';
import { BETA_PARTNER_EMPLOYERS } from './beta';

const [cpf, lowScoreCpf, betaOnlyScoreCpf, standardScoreCpf] = fictitiousCpfs;
const [partnerCnpj, outsiderCnpj, otherPartnerCnpj] = fictitiousCnpjs;

const silentLog = () => {};

const validBody = {
  document: cpf.digits,
  employerDocument: partnerCnpj.digits,
  amountCents: 1000000,
  termMonths: 24,
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type AlphaQuote = {
  quoteId: string;
  decision: string;
  annualInterestRate?: string;
  reasonCode?: string;
};

function postQuote(body: unknown) {
  return request(createAlphaApp({ delayMs: 0, log: silentLog }))
    .post('/v1/loan-quotes')
    .send(body as object);
}

async function quote(body: unknown): Promise<AlphaQuote> {
  const response = await postQuote(body);

  return response.body as AlphaQuote;
}

describe('alphaRate', () => {
  it.each([
    [6, '0.24'],
    [24, '0.24'],
    [25, '0.26'],
    [60, '0.26'],
    [61, '0.28'],
    [96, '0.28'],
  ])('com score alto, prazo de %i meses usa a taxa %s', (termMonths, rate) => {
    expect(alphaRate(termMonths, ALPHA_PRIME_SCORE)).toBe(rate);
  });

  it.each([
    [24, '0.30'],
    [60, '0.32'],
    [96, '0.34'],
  ])('com score médio, prazo de %i meses usa a taxa %s', (termMonths, rate) => {
    expect(alphaRate(termMonths, ALPHA_PRIME_SCORE - 1)).toBe(rate);
  });
});

describe('POST /v1/loan-quotes', () => {
  it.each([
    [24, '0.24'],
    [36, '0.26'],
    [96, '0.28'],
  ])('com prazo de %i meses devolve a taxa %s', async (termMonths, rate) => {
    const response = await postQuote({ ...validBody, termMonths });
    const body = response.body as AlphaQuote;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['annualInterestRate', 'decision', 'quoteId']);
    expect(body.decision).toBe('approved');
    expect(body.annualInterestRate).toBe(rate);
    expect(body.quoteId).toMatch(uuidPattern);
  });

  it('aprova o valor igual ao limite de R$ 100.000,00', async () => {
    const body = await quote({ ...validBody, amountCents: ALPHA_MAX_AMOUNT_CENTS });

    expect(ALPHA_MAX_AMOUNT_CENTS).toBe(10_000_000);
    expect(body.decision).toBe('approved');
  });

  it('recusa com HTTP 200 o valor acima do limite, sem taxa', async () => {
    const response = await postQuote({ ...validBody, amountCents: ALPHA_MAX_AMOUNT_CENTS + 1 });
    const body = response.body as AlphaQuote;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['decision', 'quoteId', 'reasonCode']);
    expect(body.decision).toBe('declined');
    expect(body.reasonCode).toBe('AMOUNT_ABOVE_LIMIT');
    expect(body.quoteId).toMatch(uuidPattern);
  });

  it('tem convênio com o primeiro e o terceiro empregadores fictícios', () => {
    expect([...ALPHA_PARTNER_EMPLOYERS]).toEqual([partnerCnpj.digits, otherPartnerCnpj.digits]);
  });

  it('tem uma lista de convênios diferente da do Beta', () => {
    expect([...ALPHA_PARTNER_EMPLOYERS]).not.toEqual([...BETA_PARTNER_EMPLOYERS]);
  });

  it('aprova o empregador conveniado', async () => {
    const body = await quote({ ...validBody, employerDocument: otherPartnerCnpj.digits });

    expect(body.decision).toBe('approved');
  });

  it('recusa com HTTP 200 o empregador sem convênio, sem taxa', async () => {
    const response = await postQuote({ ...validBody, employerDocument: outsiderCnpj.digits });
    const body = response.body as AlphaQuote;

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['decision', 'quoteId', 'reasonCode']);
    expect(body.decision).toBe('declined');
    expect(body.reasonCode).toBe('EMPLOYER_NOT_COVERED');
    expect(body.quoteId).toMatch(uuidPattern);
    expect(response.text).not.toContain(outsiderCnpj.digits);
  });

  it('confere o convênio antes do limite de valor', async () => {
    const body = await quote({
      ...validBody,
      employerDocument: outsiderCnpj.digits,
      amountCents: ALPHA_MAX_AMOUNT_CENTS + 1,
    });

    expect(body.reasonCode).toBe('EMPLOYER_NOT_COVERED');
  });

  it('aprova com a taxa maior o CPF de score médio', async () => {
    const body = await quote({ ...validBody, document: standardScoreCpf.digits });

    expect(body.decision).toBe('approved');
    expect(body.annualInterestRate).toBe('0.30');
  });

  it.each([
    ['score baixo', lowScoreCpf],
    ['score aceito só pelo Beta', betaOnlyScoreCpf],
  ])('recusa com HTTP 200 o CPF de %s, sem taxa', async (_case, refusedCpf) => {
    const response = await postQuote({ ...validBody, document: refusedCpf.digits });
    const body = response.body as AlphaQuote;

    expect(ALPHA_MIN_SCORE).toBe(500);
    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['decision', 'quoteId', 'reasonCode']);
    expect(body.decision).toBe('declined');
    expect(body.reasonCode).toBe('LOW_SCORE');
    expect(response.text).not.toContain(refusedCpf.digits);
  });

  it('confere o convênio antes do score e o score antes do limite de valor', async () => {
    const outsider = await quote({
      ...validBody,
      document: lowScoreCpf.digits,
      employerDocument: outsiderCnpj.digits,
    });
    const lowScore = await quote({
      ...validBody,
      document: lowScoreCpf.digits,
      amountCents: ALPHA_MAX_AMOUNT_CENTS + 1,
    });

    expect(outsider.reasonCode).toBe('EMPLOYER_NOT_COVERED');
    expect(lowScore.reasonCode).toBe('LOW_SCORE');
  });

  it('não devolve o CPF na resposta', async () => {
    const response = await postQuote(validBody);

    expect(response.text).not.toContain(cpf.digits);
  });

  it('devolve a mesma taxa para a mesma requisição', async () => {
    const first = await quote(validBody);
    const second = await quote(validBody);

    expect(second.annualInterestRate).toBe(first.annualInterestRate);
  });

  it.each([
    ['CPF com máscara', { document: cpf.masked }],
    ['CPF com dígito verificador errado', { document: '38192746501' }],
    ['CPF ausente', { document: undefined }],
    ['CNPJ com máscara', { employerDocument: partnerCnpj.masked }],
    ['CNPJ com dígito verificador errado', { employerDocument: '47182936000145' }],
    ['CNPJ ausente', { employerDocument: undefined }],
    ['valor como string', { amountCents: '1000000' }],
    ['valor zero', { amountCents: 0 }],
    ['valor com casas decimais', { amountCents: 1000000.5 }],
    ['prazo abaixo de 6', { termMonths: 5 }],
    ['prazo acima de 96', { termMonths: 97 }],
    ['prazo não inteiro', { termMonths: 24.5 }],
    ['campo desconhecido', { cpf: cpf.digits }],
  ])('recusa %s com HTTP 400', async (_case, overrides) => {
    const response = await postQuote({ ...validBody, ...overrides });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_request' });
  });

  it('recusa JSON malformado com HTTP 400', async () => {
    const response = await request(createAlphaApp({ delayMs: 0, log: silentLog }))
      .post('/v1/loan-quotes')
      .set('content-type', 'application/json')
      .send('{"document":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_request' });
  });

  it('não repete o corpo recebido na resposta de erro', async () => {
    const response = await postQuote({ ...validBody, termMonths: 5 });

    expect(response.text).not.toContain(cpf.digits);
  });
});
