"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphModule = void 0;
const common_1 = require("@nestjs/common");
const graph_controller_1 = require("./api/graph.controller");
const get_graph_usecase_1 = require("./application/get-graph.usecase");
const graph_repository_1 = require("./infrastructure/graph.repository");
const prisma_module_1 = require("../prisma/prisma.module");
const prisma_service_1 = require("../prisma/prisma.service");
let GraphModule = class GraphModule {
};
exports.GraphModule = GraphModule;
exports.GraphModule = GraphModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [graph_controller_1.GraphController],
        providers: [
            {
                provide: graph_repository_1.GraphRepository,
                useFactory: (prisma) => new graph_repository_1.GraphRepository(prisma),
                inject: [prisma_service_1.PrismaService],
            },
            {
                provide: get_graph_usecase_1.GetGraphUseCase,
                useFactory: (repo, prisma) => new get_graph_usecase_1.GetGraphUseCase(repo, prisma),
                inject: [graph_repository_1.GraphRepository, prisma_service_1.PrismaService],
            },
        ],
    })
], GraphModule);
