import { Request, Response } from "express";

export function Wrapper(cb: (req: Request, res: Response) => void) {
  return (req: Request, res: Response) => {
    try {
      cb(req, res);
    } catch (e) {
      console.error(e);
      res.status(503).json({
        error: JSON.stringify(e)
      });
    }
  }
}