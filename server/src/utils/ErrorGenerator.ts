interface ErrorProps {
  e?: any;
  message: string;
}

export class ErrorGenerator {
  static generate({ e, message }: ErrorProps) {
    console.error(message);
    if (e) console.error(e);
    return new Error(`${message}\n${e}`);
  }
}
