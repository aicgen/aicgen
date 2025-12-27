/**
 * Framework detection
 *
 * Detects frameworks from dependencies and file patterns
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { readFile } from 'fs/promises';
import type { FrameworkDetectionResult } from '../types.js';

/**
 * Known framework patterns
 */
const FRAMEWORK_PATTERNS = {
  frontend: {
    react: ['react', 'react-dom'],
    vue: ['vue'],
    angular: ['@angular/core'],
    svelte: ['svelte'],
    'next.js': ['next'],
    'nuxt': ['nuxt'],
    'solid': ['solid-js'],
    'preact': ['preact'],
    'lit': ['lit'],
  },
  backend: {
    express: ['express'],
    fastify: ['fastify'],
    nestjs: ['@nestjs/core', '@nestjs/common'],
    koa: ['koa'],
    hapi: ['@hapi/hapi'],
    fastapi: ['fastapi'],
    django: ['django'],
    flask: ['flask'],
    gin: ['github.com/gin-gonic/gin'],
    echo: ['github.com/labstack/echo'],
    fiber: ['github.com/gofiber/fiber'],
    actix: ['actix-web'],
    rocket: ['rocket'],
    axum: ['axum'],
  },
  testing: {
    jest: ['jest', '@jest/globals'],
    vitest: ['vitest'],
    mocha: ['mocha'],
    jasmine: ['jasmine'],
    'testing-library': ['@testing-library/react', '@testing-library/vue'],
    cypress: ['cypress'],
    playwright: ['@playwright/test', 'playwright'],
    pytest: ['pytest'],
    'go test': [], // Built-in for Go
    rspec: ['rspec'],
  },
  orm: {
    prisma: ['prisma', '@prisma/client'],
    typeorm: ['typeorm'],
    sequelize: ['sequelize'],
    'mongoose': ['mongoose'],
    'drizzle': ['drizzle-orm'],
    sqlalchemy: ['sqlalchemy'],
    gorm: ['gorm.io/gorm'],
    diesel: ['diesel'],
  },
  stateManagement: {
    redux: ['redux', '@reduxjs/toolkit'],
    zustand: ['zustand'],
    pinia: ['pinia'],
    mobx: ['mobx'],
    'recoil': ['recoil'],
    'jotai': ['jotai'],
    'xstate': ['xstate'],
  },
  uiLibraries: {
    'material-ui': ['@mui/material', '@material-ui/core'],
    'ant-design': ['antd'],
    'chakra-ui': ['@chakra-ui/react'],
    'tailwindcss': ['tailwindcss'],
    'bootstrap': ['bootstrap'],
    'shadcn-ui': ['@radix-ui/react-dialog'], // Common shadcn dependency
  },
  bundlers: {
    vite: ['vite'],
    webpack: ['webpack'],
    rollup: ['rollup'],
    parcel: ['parcel'],
    esbuild: ['esbuild'],
    turbopack: ['turbopack'],
  },
};

/**
 * Detect frameworks from dependencies
 *
 * @param projectPath - Absolute path to project root
 * @returns Framework detection result
 */
export async function detectFrameworks(
  projectPath: string
): Promise<FrameworkDetectionResult> {
  // Read dependencies from package.json
  const allDeps = await readDependencies(projectPath);

  const result: FrameworkDetectionResult = {};

  // Detect frontend frameworks
  const frontend = detectCategory(allDeps, FRAMEWORK_PATTERNS.frontend);
  if (frontend.length > 0) {
    result.frontend = frontend;
  }

  // Detect backend frameworks
  const backend = detectCategory(allDeps, FRAMEWORK_PATTERNS.backend);
  if (backend.length > 0) {
    result.backend = backend;
  }

  // Detect testing frameworks
  const testing = detectCategory(allDeps, FRAMEWORK_PATTERNS.testing);
  // Add Go test if go.mod exists
  if (existsSync(join(projectPath, 'go.mod'))) {
    testing.push('go test');
  }
  if (testing.length > 0) {
    result.testing = testing;
  }

  // Detect ORM/Database libraries
  const orm = detectCategory(allDeps, FRAMEWORK_PATTERNS.orm);
  if (orm.length > 0) {
    result.orm = orm;
  }

  // Detect state management
  const stateManagement = detectCategory(allDeps, FRAMEWORK_PATTERNS.stateManagement);
  if (stateManagement.length > 0) {
    result.stateManagement = stateManagement;
  }

  // Detect UI libraries
  const uiLibraries = detectCategory(allDeps, FRAMEWORK_PATTERNS.uiLibraries);
  if (uiLibraries.length > 0) {
    result.uiLibraries = uiLibraries;
  }

  // Detect bundlers
  const bundlers = detectCategory(allDeps, FRAMEWORK_PATTERNS.bundlers);
  if (bundlers.length > 0) {
    result.bundlers = bundlers;
  }

  return result;
}

/**
 * Detect frameworks in a specific category
 */
function detectCategory(
  dependencies: Record<string, string>,
  patterns: Record<string, string[]>
): string[] {
  const detected: string[] = [];

  for (const [framework, depNames] of Object.entries(patterns)) {
    // Check if any of the required dependencies are present
    if (depNames.length === 0) {
      // Special case: no dependencies needed (like Go test)
      continue;
    }

    const hasFramework = depNames.some(depName => depName in dependencies);
    if (hasFramework) {
      detected.push(framework);
    }
  }

  return detected;
}

/**
 * Read dependencies from package.json
 */
async function readDependencies(projectPath: string): Promise<Record<string, string>> {
  const packageJsonPath = join(projectPath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {};
  }

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    return {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
  } catch {
    return {};
  }
}
