# ReqImpact RAG Sample Export v0

- Run ID: rag-sample:current_hybrid:reqimpact-case-006-squareboat-default-includes:2026-06-18T14-44-41-057Z
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
- Chunk count: 14
- Artifact embedding models: gemini-embedding-001
- Chunker versions: artifact-chunker@0.1.0
- Alignment verified: yes

## Summary

- Top-K count: 10
- Ground-truth hits in top-K: 0
- Recall@10: 0
- Evidence coverage: 1
- Location-only evidence count: 0
- Code-like evidence count: 10
- Missed ground-truth files: libs/boat/src/transformers/transformer.ts
- Unexpected top-K files: libs/boat/src/rest/guards.ts, libs/boat/src/validator/basevalidator.ts, libs/boat/src/validator/basevalidator.ts, libs/boat/src/rest/guards.ts, libs/boat/src/rest/explorer.ts, libs/boat/src/rest/explorer.ts, libs/boat/src/validator/decorators/isValueFromConfig.ts, libs/boat/src/rest/guards.ts, libs/boat/src/validator/decorators/isValueFromConfig.ts, src/user/controllers/user.ts

## Top-K

| Rank | File | Type | Kind | Score | Final | Lexical | Vector | Graph | Kind Boost | Domain Boost | Signals | Evidence | Location-only | Code-like | Preview |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |
| 1 | libs/boat/src/rest/guards.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.3906 | 0.3906 | 0.0000 | 0.6875 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | bindRequestHelpers(request: any): any {
    const all = function (): Record<string, any> {
      const inputs = { ...request.query, ...request.body, ...request.params };

      ... |
| 2 | libs/boat/src/validator/basevalidator.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.3778 | 0.3778 | 0.0000 | 0.6508 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | async fire<T>(inputs: Record<string, any>, schemaMeta: Type<T>): Promise<T> {
    const schema: T = plainToClass(schemaMeta, inputs);
    const errors = await validate(schema as... |
| 3 | libs/boat/src/validator/basevalidator.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.3770 | 0.3770 | 0.0000 | 0.6485 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | parseError(error) {
    const children = [];
    for (const child of error.children \|\| []) {
      children.push(this.parseError(child));
    }

    const messages = [];
    for... |
| 4 | libs/boat/src/rest/guards.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.3768 | 0.3768 | 0.0000 | 0.6480 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | canActivate(
    context: ExecutionContext,
  ): boolean \| Promise<boolean> \| Observable<boolean> {
    this.bindRequestHelpers(context.switchToHttp().getRequest());
    this.bi... |
| 5 | libs/boat/src/rest/explorer.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.3765 | 0.3765 | 0.0000 | 0.6471 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | onModuleInit() {
    HttpMetadata.setBaseUrl(this.config.get('app.url'));

    const wrappers = this.discovery.getControllers();

    wrappers.forEach((w) => {
      const { ins... |
| 6 | libs/boat/src/rest/explorer.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.3764 | 0.3764 | 0.0000 | 0.6467 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | lookupListeners(
    instance: Record<string, GenericFunction>,
    key: string,
    baseRoute?: string,
  ) {
    baseRoute = baseRoute \|\| '';
    const hasRouteName = Reflect.... |
| 7 | libs/boat/src/validator/decorators/isValueFromConfig.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.3743 | 0.3743 | 0.0000 | 0.6409 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | defaultMessage(args: ValidationArguments) {
    const [options] = args.constraints;
    const validValues = this.getValues(options.key);
    return `${args.property} should have... |
| 8 | libs/boat/src/rest/guards.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.3739 | 0.3739 | 0.0000 | 0.6397 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | bindResponseHelpers(response: any): any {
    const success = function (
      data: Record<string, any> \| Array<any> \| string,
      status = 200,
    ) {
      return response... |
| 9 | libs/boat/src/validator/decorators/isValueFromConfig.ts | SERVICE_METHOD | DOMAIN_SERVICE | 0.3715 | 0.3715 | 0.0000 | 0.6328 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | validate(value: string, args: ValidationArguments): boolean {
    const [options] = args.constraints;
    const validValues = this.getValues(options.key);

    if (isEmpty(valid... |
| 10 | src/user/controllers/user.ts | API_ROUTE | API_ENDPOINT | 0.3706 | 0.3706 | 0.0000 | 0.6304 | 1.0000 | 0.0000 | 0.0000 | VECTOR, GRAPH | yes | no | yes | @Get('/profile')
  async getProfile(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<Response> {
    const user = await this.service.get();
    return res.succes... |

## Warnings

- Changed files are proxy ground truth. This export is not a final research conclusion.
- CURRENT_HYBRID benchmark mode alignment was verified.
- The changed ground-truth file libs/boat/src/transformers/transformer.ts was not persisted as a CodeArtifact in the aligned base snapshot. Therefore current-hybrid cannot retrieve the ground-truth artifact. This case is valid as an end-to-end scanner coverage failure, but must not be interpreted as a clean retrieval-only miss.
- Recall@10=0 for this case should be interpreted as scanner coverage / E2E failure, not pure retrieval failure.
