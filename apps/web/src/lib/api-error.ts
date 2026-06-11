export class ApiError extends Error {
  public status: number
  public code: string
  public details?: unknown

  constructor({ status, code, message, details }: { status: number; code: string; message: string; details?: unknown }) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}
