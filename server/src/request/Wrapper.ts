import { Request, Response } from "express";
import { ErrorGenerator } from "../utils/ErrorGenerator";

export function Wrapper(cb: (req: Request, res: Response) => void) {
  return (req: Request, res: Response) => {
    try {
      cb(req, res);
    } catch (e) {
      const error = ErrorGenerator.generate({ e, message: 'Error handling request:' });
      res.status(503).json({
        error: error.message
      });
    }
  }
}