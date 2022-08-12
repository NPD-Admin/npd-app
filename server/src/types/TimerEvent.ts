export class TimerEvent {
  private done: boolean = false;

  constructor(private timerId: number | string = Date.now(), private precision: number, private setNext?: string) {}

  get id() { return this.timerId }
  get next() { return this.setNext }
  get interval() { return this.precision }
  get isDone() { return this.done }

  async timeCheck(callback: (payload: TimerEvent) => Promise<any>): Promise<void> {
    if (!this.setNext) {
      await callback(this);
      setTimeout(async () => await this.timeCheck(callback), this.precision);
    } else {
      const now = new Date();
      const time = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

      if (Math.abs(Number(time) - Number(this.setNext)) < (this.precision / 6e5)) {
        if (!this.done) {
          await callback(this);
          this.done = true;
        }
      } else {
        this.done = false;
      }
      
      setTimeout(async () => await this.timeCheck(callback), this.interval);
    }
  }

  toJSON(): string {
    return JSON.stringify({
      id: this.timerId,
      next: this.setNext,
      interval: this.precision,
      done: this.done
    }, arguments[1], arguments[2] || 2)
  }
}