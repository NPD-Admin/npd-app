export class ErrorGenerator {
  static generate(e: any, message: string) {
    console.error(e);
    return new Error(`${message}\n${e}`);
  }
}
