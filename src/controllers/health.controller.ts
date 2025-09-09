import { Request, Response } from 'express';

function healthController(req: Request, res: Response) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}

export default healthController;