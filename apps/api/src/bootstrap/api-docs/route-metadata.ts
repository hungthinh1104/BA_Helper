import type { INestApplication } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { IS_PUBLIC_KEY, OPTIONAL_AUTH_KEY } from '../../modules/auth/application/jwt-auth.guard';
import { ROLES_KEY } from '../../modules/auth/api/roles.decorator';

export type RouteMetadata = { isPublic: boolean; optionalAuth: boolean; status?: number; roles: string[] };

export function collectRouteMetadata(app: INestApplication): Map<string, RouteMetadata> {
  const result = new Map<string, RouteMetadata>();
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype;
      if (!controller) continue;
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        result.set(`${controller.name}_${name}`, {
          isPublic: Reflect.getMetadata(IS_PUBLIC_KEY, handler) ?? Reflect.getMetadata(IS_PUBLIC_KEY, controller) ?? false,
          optionalAuth: Reflect.getMetadata(OPTIONAL_AUTH_KEY, handler) ?? Reflect.getMetadata(OPTIONAL_AUTH_KEY, controller) ?? false,
          status: Reflect.getMetadata(HTTP_CODE_METADATA, handler),
          roles: Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, controller) ?? [],
        });
      }
    }
  }
  return result;
}
