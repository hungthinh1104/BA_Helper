"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repositoryCreateResponseSchema = exports.repositoryCreateRequestSchema = void 0;
const zod_1 = require("zod");
exports.repositoryCreateRequestSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
});
exports.repositoryCreateResponseSchema = zod_1.z.object({
    repositoryId: zod_1.z.string().uuid(),
    projectId: zod_1.z.string().uuid(),
    canonicalUrl: zod_1.z.string().url(),
    createdAt: zod_1.z.string(),
});
