"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
exports.AppError = AppError;
