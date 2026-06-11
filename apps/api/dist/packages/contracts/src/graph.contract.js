"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphResponseSchema = exports.graphEdgeSchema = void 0;
const zod_1 = require("zod");
exports.graphEdgeSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    fromArtifactId: zod_1.z.string().uuid(),
    toArtifactId: zod_1.z.string().uuid(),
    type: zod_1.z.enum(['CALLS', 'REFERENCES', 'IMPORTS', 'TESTS']),
});
exports.graphResponseSchema = zod_1.z.object({
    edges: zod_1.z.array(exports.graphEdgeSchema),
});
