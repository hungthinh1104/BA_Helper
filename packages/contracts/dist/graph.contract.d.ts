import { z } from 'zod';
export declare const graphEdgeSchema: z.ZodObject<{
    id: z.ZodString;
    fromArtifactId: z.ZodString;
    toArtifactId: z.ZodString;
    type: z.ZodEnum<["CALLS", "REFERENCES", "IMPORTS", "TESTS"]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "CALLS" | "REFERENCES" | "IMPORTS" | "TESTS";
    fromArtifactId: string;
    toArtifactId: string;
}, {
    id: string;
    type: "CALLS" | "REFERENCES" | "IMPORTS" | "TESTS";
    fromArtifactId: string;
    toArtifactId: string;
}>;
export declare const graphResponseSchema: z.ZodObject<{
    edges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fromArtifactId: z.ZodString;
        toArtifactId: z.ZodString;
        type: z.ZodEnum<["CALLS", "REFERENCES", "IMPORTS", "TESTS"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "CALLS" | "REFERENCES" | "IMPORTS" | "TESTS";
        fromArtifactId: string;
        toArtifactId: string;
    }, {
        id: string;
        type: "CALLS" | "REFERENCES" | "IMPORTS" | "TESTS";
        fromArtifactId: string;
        toArtifactId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    edges: {
        id: string;
        type: "CALLS" | "REFERENCES" | "IMPORTS" | "TESTS";
        fromArtifactId: string;
        toArtifactId: string;
    }[];
}, {
    edges: {
        id: string;
        type: "CALLS" | "REFERENCES" | "IMPORTS" | "TESTS";
        fromArtifactId: string;
        toArtifactId: string;
    }[];
}>;
export type GraphResponse = z.infer<typeof graphResponseSchema>;
