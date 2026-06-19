# ReqImpact RAG Sample Export v0

- Run ID: rag-sample:current_hybrid:reqimpact-case-006-squareboat-default-includes:2026-06-19T06-51-49-353Z
- Mode: CURRENT_HYBRID_BENCHMARK
- Case ID: reqimpact-case-006-squareboat-default-includes
- Repo: squareboat/nestjs-boilerplate

## Requirement Text

fix: default includes in transformer class

## Ground Truth Note

Changed files are proxy ground truth. This single-case current-hybrid benchmark export is not an aggregate research conclusion.

## Snapshot Metadata

- Snapshot ID: b8676c81-b19b-4c97-93a5-38125b9b525b
- Repository ID: b8687312-ed36-4bca-b519-32b6e49b31f4
- Project ID: a89660ef-6a15-4f65-a53d-2dbb1218a2ea
- Commit SHA: 33ca78792610f1b0ece552767ef370bcb1978205
- Case Base SHA: 33ca78792610f1b0ece552767ef370bcb1978205
- Analyzer Version: analyzer@0.3.0
- Coverage Status: READY
- Index Status: VECTOR_READY
- Created At: 2026-06-18T07:13:24.588Z

## Embedding State

- Query Profile ID: google-gemini-001-1536
- Query Provider: google
- Query Embedding Model: gemini-embedding-001
- Query Dimensions: 1536
- Query Config Hash: ae7b397d6b6fce4573794e52c1daa56d7daed714bdc75898b8a54e4d588565d5
- Artifact Profile ID: google-gemini-001-1536
- Artifact Provider: google
- Artifact Embedding Model: gemini-embedding-001
- Artifact Dimensions: 1536
- Artifact Config Hash: ae7b397d6b6fce4573794e52c1daa56d7daed714bdc75898b8a54e4d588565d5
- Chunk count: 67
- Artifact embedding models: gemini-embedding-001
- Chunker versions: artifact-chunker@0.1.0
- Alignment verified: yes

## Ground Truth Artifact Coverage

- Status: OK
- Indexed ground-truth files: libs/boat/src/transformers/transformer.ts
- Missing indexed ground-truth files: none

## Summary

- Top-K count: 4
- Ground-truth hits in top-K: 1
- Recall@10: 1
- Evidence coverage: 1
- Location-only evidence count: 0
- Code-like evidence count: 4
- Missed ground-truth files: none
- Unexpected top-K files: libs/boat/src/interfaces/transformer.ts, src/transformer/user/detail.ts, libs/boat/src/rest/restController.ts

## Top-K

| Rank | File | Type | Kind | Score | Final | Lexical | Vector | Graph | Kind Boost | Domain Boost | Signals | Evidence | Location-only | Code-like | Preview |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | libs/boat/src/transformers/transformer.ts | FILE | UNKNOWN | 0.4266 | 0.4266 | 0.0000 | 0.7904 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | import { Transformer$IncludeMethodOptions } from '../interfaces';
import { Context } from '../utils/context';
import { ExpParser } from '../utils/expParser';

export abstract cl... |
| 2 | libs/boat/src/interfaces/transformer.ts | FILE | UNKNOWN | 0.4203 | 0.4203 | 0.0000 | 0.7722 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | export class Transformer$IncludeMethodOptions {
  include?: string[];
} |
| 3 | src/transformer/user/detail.ts | FILE | UNKNOWN | 0.4111 | 0.4111 | 0.0000 | 0.7460 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | import { Transformer } from '@libs/boat';

export class UserDetailTransformer extends Transformer {
  availableIncludes = ['extra', 'address', 'pin'];
  defaultIncludes = ['pin'... |
| 4 | libs/boat/src/rest/restController.ts | FILE | UNKNOWN | 0.4023 | 0.4023 | 0.0000 | 0.7207 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | import { Transformer } from '../transformers/transformer';
import { get } from 'lodash';

export class RestController {
  /**
   * Transform a object
   *
   * @param obj
   * @... |

## Warnings

- Changed files are proxy ground truth. This export is not a final research conclusion.
- CURRENT_HYBRID benchmark mode alignment was verified.
