"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectCreateResponseSchema = exports.projectCreateRequestSchema = void 0;
const zod_1 = require("zod");
exports.projectCreateRequestSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(200),
});
exports.projectCreateResponseSchema = zod_1.z.object({
    projectId: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    createdAt: zod_1.z.string(),
});
