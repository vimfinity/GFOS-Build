export class StateCompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateCompatibilityError';
  }
}
