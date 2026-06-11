"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.artifactListResponseSchema = exports.artifactSchema = void 0;
const zod_1 = require("zod");
exports.artifactSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    artifactKey: zod_1.z.string(),
    name: zod_1.z.string(),
    artifactType: zod_1.z.string(),
    filePath: zod_1.z.string(),
    startLine: zod_1.z.number().nullable(),
    endLine: zod_1.z.number().nullable(),
    language: zod_1.z.string().nullable(),
});
exports.artifactListResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.artifactSchema),
});
