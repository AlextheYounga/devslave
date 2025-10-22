import { Request, Response } from "express";

export default class HealthController {
  constructor(private req: Request, private res: Response) {}

  check() {
    this.res.json({ status: "ok", timestamp: new Date().toISOString() });
  }
}
