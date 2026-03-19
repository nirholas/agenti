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
const cloudfront_stack_1 = require("../lib/cloudfront-stack");
const app = new cdk.App();
cdk.Aspects.of(app).add(new cdk_nag_1.AwsSolutionsChecks());
new cloudfront_stack_1.X402SellerStack(app, 'X402SellerStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: 'us-east-1', // Lambda@Edge must be deployed to us-east-1
    },
    description: 'x402 Seller Infrastructure with CloudFront and Lambda@Edge',
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMscUNBQTZDO0FBQzdDLDhEQUEwRDtBQUUxRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUMxQixHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSw0QkFBa0IsRUFBRSxDQUFDLENBQUM7QUFFbEQsSUFBSSxrQ0FBZSxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsRUFBRTtJQUMxQyxHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7UUFDeEMsTUFBTSxFQUFFLFdBQVcsRUFBRSw0Q0FBNEM7S0FDbEU7SUFDRCxXQUFXLEVBQUUsNERBQTREO0NBQzFFLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBBd3NTb2x1dGlvbnNDaGVja3MgfSBmcm9tICdjZGstbmFnJztcbmltcG9ydCB7IFg0MDJTZWxsZXJTdGFjayB9IGZyb20gJy4uL2xpYi9jbG91ZGZyb250LXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcbmNkay5Bc3BlY3RzLm9mKGFwcCkuYWRkKG5ldyBBd3NTb2x1dGlvbnNDaGVja3MoKSk7XG5cbm5ldyBYNDAyU2VsbGVyU3RhY2soYXBwLCAnWDQwMlNlbGxlclN0YWNrJywge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsIC8vIExhbWJkYUBFZGdlIG11c3QgYmUgZGVwbG95ZWQgdG8gdXMtZWFzdC0xXG4gIH0sXG4gIGRlc2NyaXB0aW9uOiAneDQwMiBTZWxsZXIgSW5mcmFzdHJ1Y3R1cmUgd2l0aCBDbG91ZEZyb250IGFuZCBMYW1iZGFARWRnZScsXG59KTtcblxuYXBwLnN5bnRoKCk7XG4iXX0=