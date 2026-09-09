// Decorator metadata (used by class-validator/class-transformer) is only populated
// once this runs — needed for specs that validate a decorated DTO/input class directly,
// outside a full Nest app bootstrap (main.ts imports this too, but that never runs in unit tests).
import 'reflect-metadata';
import * as matchers from 'jest-extended';
import { expect } from 'vitest';

expect.extend(matchers);
