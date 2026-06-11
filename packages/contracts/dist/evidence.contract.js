"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evidenceListResponseSchema = exports.evidenceSchema = void 0;
const zod_1 = require("zod");
exports.evidenceSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    sourceType: zod_1.z.enum([
        'CODE',
        'TEST',
        'STATIC_ANALYSIS',
        'REQUIREMENT_INPUT',
        'COVERAGE',
        'HUMAN_NOTE',
    ]),
    filePath: zod_1.z.string().nullable(),
    startLine: zod_1.z.number().nullable(),
    endLine: zod_1.z.number().nullable(),
    excerpt: zod_1.z.string(),
});
exports.evidenceListResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.evidenceSchema),
});
