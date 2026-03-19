#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const cdk_nag_1 = require("cdk-nag");
const agentcore_stack_1 = require("../lib/agentcore-stack");
const observability_stack_1 = require("../lib/observability-stack");
const app = new cdk.App();
// Main AgentCore infrastructure stack
const agentCoreStack = new agentcore_stack_1.AgentCoreStack(app, 'X402PayerAgentStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
    },
    description: 'x402 Payer Agent - Bedrock AgentCore infrastructure',
});
cdk.Aspects.of(agentCoreStack).add(new cdk_nag_1.AwsSolutionsChecks());
// Observability stack with CloudWatch dashboards
new observability_stack_1.ObservabilityStack(app, 'X402ObservabilityStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
    },
    description: 'x402 Enterprise Demo - CloudWatch Observability Dashboards',
    // These can be overridden via context or environment variables
    cloudfrontDistributionId: app.node.tryGetContext('cloudfrontDistributionId'),
    gatewayLogGroupName: app.node.tryGetContext('gatewayLogGroupName'),
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMscUNBQTZDO0FBQzdDLDREQUF3RDtBQUN4RCxvRUFBZ0U7QUFFaEUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsc0NBQXNDO0FBQ3RDLE1BQU0sY0FBYyxHQUFHLElBQUksZ0NBQWMsQ0FBQyxHQUFHLEVBQUUscUJBQXFCLEVBQUU7SUFDcEUsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7S0FDdEQ7SUFDRCxXQUFXLEVBQUUscURBQXFEO0NBQ25FLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLDRCQUFrQixFQUFFLENBQUMsQ0FBQztBQUU3RCxpREFBaUQ7QUFDakQsSUFBSSx3Q0FBa0IsQ0FBQyxHQUFHLEVBQUUsd0JBQXdCLEVBQUU7SUFDcEQsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7S0FDdEQ7SUFDRCxXQUFXLEVBQUUsNERBQTREO0lBQ3pFLCtEQUErRDtJQUMvRCx3QkFBd0IsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQywwQkFBMEIsQ0FBQztJQUM1RSxtQkFBbUIsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxxQkFBcUIsQ0FBQztDQUNuRSxDQUFDLENBQUM7QUFFSCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQXdzU29sdXRpb25zQ2hlY2tzIH0gZnJvbSAnY2RrLW5hZyc7XG5pbXBvcnQgeyBBZ2VudENvcmVTdGFjayB9IGZyb20gJy4uL2xpYi9hZ2VudGNvcmUtc3RhY2snO1xuaW1wb3J0IHsgT2JzZXJ2YWJpbGl0eVN0YWNrIH0gZnJvbSAnLi4vbGliL29ic2VydmFiaWxpdHktc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBNYWluIEFnZW50Q29yZSBpbmZyYXN0cnVjdHVyZSBzdGFja1xuY29uc3QgYWdlbnRDb3JlU3RhY2sgPSBuZXcgQWdlbnRDb3JlU3RhY2soYXBwLCAnWDQwMlBheWVyQWdlbnRTdGFjaycsIHtcbiAgZW52OiB7XG4gICAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtd2VzdC0yJyxcbiAgfSxcbiAgZGVzY3JpcHRpb246ICd4NDAyIFBheWVyIEFnZW50IC0gQmVkcm9jayBBZ2VudENvcmUgaW5mcmFzdHJ1Y3R1cmUnLFxufSk7XG5cbmNkay5Bc3BlY3RzLm9mKGFnZW50Q29yZVN0YWNrKS5hZGQobmV3IEF3c1NvbHV0aW9uc0NoZWNrcygpKTtcblxuLy8gT2JzZXJ2YWJpbGl0eSBzdGFjayB3aXRoIENsb3VkV2F0Y2ggZGFzaGJvYXJkc1xubmV3IE9ic2VydmFiaWxpdHlTdGFjayhhcHAsICdYNDAyT2JzZXJ2YWJpbGl0eVN0YWNrJywge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICd1cy13ZXN0LTInLFxuICB9LFxuICBkZXNjcmlwdGlvbjogJ3g0MDIgRW50ZXJwcmlzZSBEZW1vIC0gQ2xvdWRXYXRjaCBPYnNlcnZhYmlsaXR5IERhc2hib2FyZHMnLFxuICAvLyBUaGVzZSBjYW4gYmUgb3ZlcnJpZGRlbiB2aWEgY29udGV4dCBvciBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgY2xvdWRmcm9udERpc3RyaWJ1dGlvbklkOiBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdjbG91ZGZyb250RGlzdHJpYnV0aW9uSWQnKSxcbiAgZ2F0ZXdheUxvZ0dyb3VwTmFtZTogYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZ2F0ZXdheUxvZ0dyb3VwTmFtZScpLFxufSk7XG5cbmFwcC5zeW50aCgpO1xuIl19