import { TimerConfig } from "../handlers/configs/TimerConfig";
import { IHandler } from "../handlers/IHandler";

type TimerEventProps = {
  timerId?: string;
  timerSuffix?: string;
  precision?: number;
  setNext?: Date | string;
};

export class TimerEvent {
  private done: boolean = false;
  private timerId: string = Date.now().toString();
  private precision: number;
  private setNext: Date;

  get id() { return this.timerId }
  get next() { return this.setNext }
  get interval() { return this.precision }
  get isDone() { return this.done }

  constructor(private handler: IHandler, options?: TimerEventProps) {
    const config = handler.config as TimerConfig;
    this.timerId = options?.timerId || `${config.name}:::${options?.timerSuffix || Date.now()}`;
    this.precision = options?.precision || config.frequency;
    
    if (options?.setNext || config.time)
      this.setNext = (options?.setNext instanceof Date && options.setNext)
        || new Date(`${new Date().toLocaleDateString()} ${options?.setNext || config.time}`);
    else this.setNext = new Date(0);
  }

  async run(): Promise<void> {
    if (!this.setNext.getTime()) {
      await this.handler.callback(this);
      setTimeout(async () => await this.run(), this.precision);
    } else {
      if (this.checkTime()) await this.handler.callback(this);
      
      setTimeout(async () => await this.run(), this.precision);
    }
  }

  private checkTime(): boolean {
    const now = new Date();

    if (Math.abs(now.getTime() - this.setNext.getTime()) < this.precision) {
      if (!this.done) return this.done = true;
    } else {
      if (now > this.setNext) this.setNext = new Date(this.setNext.getTime() + (24*60*60*1000));
      this.done = false;
    }
    
    return false;
  }

  toJSON(): string {
    return JSON.stringify({
      id: this.timerId,
      next: this.setNext,
      interval: this.precision,
      done: this.done
    }, arguments[0], arguments[1] || 2)
  }
}