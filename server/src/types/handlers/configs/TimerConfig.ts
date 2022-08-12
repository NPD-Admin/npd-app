import { HandlerConfig } from "./HandlerConfig";

export interface TimerConfig extends HandlerConfig {
  frequency: number;
  time?: string;
};