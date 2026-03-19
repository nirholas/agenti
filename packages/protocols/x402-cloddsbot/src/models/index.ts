/**
 * Models Module - Model selection and failover
 */

export {
  createModelFailover,
  DEFAULT_CLAUDE_FAILOVER,
} from './failover';
export type { FailoverConfig, ModelFailover } from './failover';

export { selectAdaptiveModel, getModelStrategy } from './adaptive';
export type { AdaptiveModelInput, ModelStrategy } from './adaptive';
