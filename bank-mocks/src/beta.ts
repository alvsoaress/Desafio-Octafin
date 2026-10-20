import express, { type Express } from 'express';

export function createBetaApp(): Express {
  const app = express();
  app.use(express.json());
  return app;
}
